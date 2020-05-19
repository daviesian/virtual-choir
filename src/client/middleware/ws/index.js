import RSVP from "rsvp";
import log from 'loglevel';
const queryString = require('query-string');
import {
    deleteItem, deleteLane,
    loadItem,
    play, seek,
    startRecording,
    stop,
    stopRecording, targetLane, updateItem, updateLane,
} from "../../actions/audioActions";
import {
    loadLyrics,
    projectLoaded,
    sendProgress,
    setRehearsalState,
    setUser,
    singerJoined,
    singerLeft,
    updateSingerState
} from "../../actions";
import {nowSpeaking} from "../../actions/rtcActions";

const BINARY_CHUNK_SIZE = 128000;


export default store => next => {

    let ws = RSVP.defer(); // Will be resolved when we get back a user from the server after connecting.

    let outstandingCalls = {};
    let nextCallId = 0;

    // Try to get the userId from localStorage, queryString, and hash. In that order, each overwriting the last.
    let userId = null;
    try {
        userId = localStorage['userId'];
    } catch (e) { }
    try {
        let qs = queryString.parse(document.location.search);
        userId = qs.userId || userId;
    } catch (e) { }
    try {
        let hs = queryString.parse(document.location.hash);
        userId = hs.userId || userId;
    } catch (e) { }

    let commandHandlers = {
        setUser: ({user}) => {
            document.location.hash = `userId=${user.userId}`;
            ws.resolve(window.socket);

            store.dispatch(setUser(user));
        },
        loadProject: (project) => {
            store.dispatch(projectLoaded(project));
        },
        play: ({startTime}) => {
            store.dispatch(play(startTime));
        },
        stop: () => {
            store.dispatch(stop());
        },
        startRecording: () => {
            store.dispatch(startRecording());
        },
        stopRecording: () => {
            store.dispatch(stopRecording());
        },
        seek: ({time}) => {
            store.dispatch(seek(time));
        },
        updateSingerState: ({user, state}) => {
            store.dispatch(updateSingerState(user, state));
        },
        updateLane: ({lane, items, user}) => {
            store.dispatch(updateLane(lane, items, user,false));
        },
        setTargetLane: ({userId, laneId}) => {
            store.dispatch(targetLane(userId, laneId, false));
        },
        updateItem: ({item}) => {
            store.dispatch(updateItem(item, false));
        },
        newItem: ({item, lane, user}) => {
            store.dispatch(loadItem(item, lane, user))
        },
        deleteItem: ({itemId}) => {
            store.dispatch(deleteItem(itemId, false));
        },
        deleteLane: ({laneId}) => {
            store.dispatch(deleteLane(laneId, false));
        },
        singerJoined: ({user}) => {
            store.dispatch(singerJoined(user));
        },
        singerLeft: ({userId}) => {
            store.dispatch(singerLeft(userId));
        },
        setRehearsalState: ({rehearsalState}) => {
            store.dispatch(setRehearsalState(rehearsalState));
        },
        rtcSignal: ({data}) => {
            store.dispatch({
                type: "rtc/signal",
                data,
                _log: false,
            });
        },
        nowSpeaking: ({user}) => {
            store.dispatch(nowSpeaking(user));
        },
        updateRoomConductor: ({conductorUserId}) => {
            store.dispatch({
                type: "CONDUCTOR_UPDATED",
                conductorUserId,
            });
        },
        updateProject: ({project}) => {
            if (project.lyricsUrl !== store.getState().project?.lyricsUrl) {
                store.dispatch(loadLyrics(project.lyricsUrl));
            }
            store.dispatch({
                type: "PROJECT_UPDATED",
                project,
            });
        }
    };

    let receiveIncomingMessage = ({data}) => {

        data = JSON.parse(data);
        if (data?.cmd !== "rtcSignal") {
            log.debug(`[Server]`, data);
        }

        if ('callId' in data) {
            let {callId, response, error} = data;
            if (response) {
                outstandingCalls[callId].resolve(response);
            } else if (error) {
                outstandingCalls[callId].reject(error);
            } else {
                outstandingCalls[callId].resolve();
            }
            delete outstandingCalls[callId];
        } else if ('cmd' in data) {
            commandHandlers[data.cmd](data);
        }
    };

    let initWs = () => {
        if (window.socket) {
            window.socket.close();
        }
        window.socket = new WebSocket(`${document.location.protocol.replace("http", "ws")}//${document.location.host}/ws${userId ? `?userId=${userId}` : ''}`);
        log.info("Websocket connecting...");

        window.socket.onopen = () => {
            log.info("Websocket connected");
            ws.binaryType = 'arrayBuffer';
        };

        window.socket.onclose = (e) => {
            window.socket = null;
            ws.reject("Websocket closed");
            ws = RSVP.defer();
            setTimeout(initWs, 1000);
        };

        window.socket.onerror = (e) => {
            log.error(e);
            window.socket.close();
        };

        window.socket.onmessage = receiveIncomingMessage;


    };

    let sendJSON = async obj => {
        (await ws.promise).send(JSON.stringify(obj));
    };

    // Data is a TypedArray
    let sendBinary = async (callId, data) => {
        let w = await ws.promise;
        let lastCoarseProgressUpdate = null;
        for (let i = 0; i < data.buffer.byteLength; i += BINARY_CHUNK_SIZE) {
            let chunkLength = Math.min(BINARY_CHUNK_SIZE, data.buffer.byteLength - i)
            w.send(new Uint8Array(data.buffer, i, chunkLength));
            await new Promise(r => setTimeout(r,100));
            let progress = (i+chunkLength) / data.buffer.byteLength;
            let coarseUpdate = false;
            if (lastCoarseProgressUpdate === null || (progress - lastCoarseProgressUpdate > 0.05 )) {
                lastCoarseProgressUpdate = progress;
                coarseUpdate = true;
            }
            store.dispatch(sendProgress(callId, i+chunkLength, data.buffer.byteLength, coarseUpdate));
        }
        store.dispatch(sendProgress(callId, data.buffer.byteLength, data.buffer.byteLength, true));
    };

    let call = async (fn, kwargs={}, data=null) => {
        let callId = nextCallId++;
        outstandingCalls[callId] = RSVP.defer();
        let responsePromise = outstandingCalls[callId].promise;

        await sendJSON({fn, kwargs, callId, binaryDataToFollow: data?.buffer.byteLength});
        if (data) {
            await sendBinary(callId, data);
        }

        try {
            return await responsePromise;
        } catch (e) {
            throw new Error(e);
        }
    };

    return async action => {

        if (action.type.startsWith("ws/")) {
            switch (action.type.substr(3)) {
                case "connect":
                    initWs();
                    break;

                case "call":
                    return await call(action.fn, action.kwargs, action.data);
            }
        } else {
            return next(action);
        }
    };
}