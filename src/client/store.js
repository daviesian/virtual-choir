import thunkMiddleware from 'redux-thunk'
import {createLogger} from 'redux-logger'
import {applyMiddleware, createStore} from 'redux'
import {createBrowserHistory} from "history";
import audioMiddleware from './audioMiddleware';
import wsMiddleware from "./wsMiddleware";
import {produce} from "immer";

const loggerMiddleware = createLogger({
    predicate: (getState, {_log}) => _log !== false,
    collapsed: true,
});

const initialState = {
    audioInitialised: false,
    backingTrack: null,
    layers: [],
    transport: {
        currentTime: 0,
        playing: false,
        recording: false,
    }
};

let rootReducer = produce((state, action) => {
    if (state === undefined)
        return initialState;

    switch (action.type) {

        case "INIT_DONE":
            state.audioInitialised = true;
            break;

        case "RESET":
            return initialState;

        case "BACKING_TRACK_LOADED":
            state.backingTrack = {
                name: action.name,
                duration: action.duration,
                id: action.id,
                rms: action.rms,
            };
            break;

        case "SET_TRANSPORT_TIME":
            state.transport.currentTime = action.time;
            break;

        case "PLAYBACK_STARTED":
            state.transport.playing = true;
            break;

        case "PLAYBACK_STOPPED":
            state.transport.playing = false;
            break;

        case "RECORDING_STARTED":
            state.transport.recording = true;
            break;

        case "RECORDING_STOPPED":
            state.transport.recording = false;
            break;

        case "LAYER_ADDED":
            state.layers.push({
                startTime: action.startTime,
                duration: action.duration,
                id: action.id,
                name: action.name,
                rms: action.rms,
            });
            break;

        case "LAYER_DELETED":
            state.layers = newState.layers.filter(layer => layer.id !== action.id);
            break;
    }
}, initialState);

export const history = createBrowserHistory({basename: "/"});

export const store = createStore(
    rootReducer,
    applyMiddleware(
        thunkMiddleware,
        loggerMiddleware,
        audioMiddleware,
        wsMiddleware,
    )
);

window.dispatch = store.dispatch;
