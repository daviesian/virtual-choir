import RSVP from "rsvp";
import log from 'loglevel';
import {loadBackingTrack} from "./actions/audioActions";

export default store => next => {

    let ws = RSVP.defer();

    let outstandingCalls = {};
    let nextCallId = 0;

    let commandHandlers = {
        selectBackingTrack: ({url}) => {
            store.dispatch(loadBackingTrack(url));
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
        let socket = new WebSocket(document.location.protocol.replace("http", "ws") + "//" + document.location.host + "/ws");
        log.info("Websocket connecting...");

        socket.onopen = () => {
            log.info("Websocket connected");
            ws.resolve(socket);
        };

        socket.onclose = () => {
            ws.reject("Websocket closed");
            ws = RSVP.defer();
            initWs();
        };

        socket.onerror = (e) => {
            log.error(e);
            socket.close();
        };

        socket.onmessage = receiveIncomingMessage;
    };

    initWs();

    let sendJSON = async obj => {
        (await ws.promise).send(JSON.stringify(obj));
    };

    let call = async (fn, kwargs={}) => {
        let callId = nextCallId++;
        outstandingCalls[callId] = RSVP.defer();
        await sendJSON({fn, kwargs, callId});

        try {
            return await outstandingCalls[callId].promise;
        } catch (e) {
            throw new Error(e);
        }
    };

    return async action => {

        if (action.type.startsWith("ws/")) {
            switch (action.type.substr(3)) {
                case "call":
                    return await call(action.fn, action.kwargs);
                    break;

            }
        } else {
            return next(action);
        }
    };
}