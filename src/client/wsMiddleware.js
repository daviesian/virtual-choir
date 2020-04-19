import RSVP from "rsvp";
import log from 'loglevel';
import {
    deleteLayer,
    loadBackingTrack,
    loadSingerLayer,
    play, seek,
    setTransportTime,
    startRecording,
    stop,
    stopRecording, toggleLayer
} from "./actions/audioActions";
import {sendProgress, updateSingerState} from "./actions";

const BINARY_CHUNK_SIZE = 64000000000000;


export default store => next => {

    let ws = RSVP.defer();

    let outstandingCalls = {};
    let nextCallId = 0;

    let commandHandlers = {
        loadBackingTrack: ({url}) => {
            store.dispatch(loadBackingTrack(url));
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
        newSingerLayer: ({singer, id, startTime}) => {
            store.dispatch(loadSingerLayer(id, startTime));
        },
        toggleLayer: ({id, startTime, enabled}) => {
            store.dispatch(toggleLayer(id, startTime, enabled));
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
        window.socket = new WebSocket(document.location.protocol.replace("http", "ws") + "//" + document.location.host + "/ws");
        log.info("Websocket connecting...");

        window.socket.onopen = () => {
            log.info("Websocket connected");
            ws.binaryType = 'arrayBuffer';
            ws.resolve(window.socket);
        };

        window.socket.onclose = () => {
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