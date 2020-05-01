import s from './state';
import {connect, send, signal} from './core';


window.rtc = s;


export default store => next => {

    return async action => {

        if (action.type.startsWith("rtc/")) {
            switch (action.type.substr(4)) {
                case "connect":
                    return await connect(store.dispatch);

                case "signal":
                    signal(action.data);
                    break;

                case "send":
                    await send(action.myVideo, action.myAudio);
                    break;

            }
        } else {
            return next(action);
        }

    }
}