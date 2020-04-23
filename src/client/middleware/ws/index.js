import RSVP from "rsvp";
import log from 'loglevel';
const queryString = require('query-string');
import {
    deleteLayer,
    loadSingerLayer,
    play, seek,
    startRecording,
    stop,
    stopRecording, updateLayer,
} from "../../actions/audioActions";
import {loadBackingTrack, sendProgress, setUser, updateSingerState} from "../../actions";

const BINARY_CHUNK_SIZE = 64000;

export default store => next => {

    let ws = RSVP.defer();

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
            document.location.hash = `userId=${user.id}`;
            store.dispatch(setUser(user));
        },
        loadBackingTrack: ({track}) => {
            store.dispatch(loadBackingTrack(track));
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
        updateSingerState: ({singer, state}) => {
            store.dispatch(updateSingerState(singer, state));
        },
        newSingerLayer: ({layer}) => {
            store.dispatch(loadSingerLayer(layer));
        },
        updateLayer: ({layer}) => {
            store.dispatch(updateLayer(layer));
        },
        deleteLayer: ({id}) => {
            store.dispatch(deleteLayer(id));
        }
    };

    let receiveIncomingMessage = ({data}) => {
        log.debug(`[Server] ${data}`);

        data = JSON.parse(data);

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
            ws.resolve(window.socket);
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

    if (!window.socket) {
        initWs();
    }

    let sendJSON = async obj => {
        (await ws.promise).send(JSON.stringify(obj));
    };

    // Data is a TypedArray
    let sendBinary = async (callId, data) => {
        let w = await ws.promise;
        for (let i = 0; i < data.buffer.byteLength; i += BINARY_CHUNK_SIZE) {
            let chunkLength = Math.min(BINARY_CHUNK_SIZE, data.buffer.byteLength - i)
            w.send(new Uint8Array(data.buffer, i, chunkLength));
            await new Promise(r => setTimeout(r,100));
            store.dispatch(sendProgress(callId, i+chunkLength, data.buffer.byteLength));
        }
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
                case "call":
                    return await call(action.fn, action.kwargs, action.data);
            }
        } else {
            return next(action);
        }
    };
}