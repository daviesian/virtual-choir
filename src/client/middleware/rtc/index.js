import s from './state';
import {connect, muteOutput, setMe, signal, unmuteOutput} from './core';


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

                case "setMe":
                    await setMe(action.me);
                    break;

                case "mute":
                    await muteOutput();
                    break;

                case "unmute":
                    await unmuteOutput();
                    break;

            }
        } else {
            return next(action);
        }

    }
}