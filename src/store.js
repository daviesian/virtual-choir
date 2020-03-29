import thunkMiddleware from 'redux-thunk'
import {createLogger} from 'redux-logger'
import {applyMiddleware, createStore} from 'redux'
import {createBrowserHistory} from "history";
import audioMiddleware from './audioMiddleware';
import produce from "immer";

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

let rootReducer = (state, action) => {
    if (state === undefined)
        return initialState;

    switch (action.type) {

        case "INIT_DONE":
            return produce(state, newState => {
                newState.audioInitialised = true;
            });

        case "RESET":
            return initialState;

        case "BACKING_TRACK_LOADED":
            return produce(state, newState => {
                newState.backingTrack = {
                    name: action.name,
                    duration: action.duration,
                    id: action.id,
                    rms: action.rms,
                };
            });

        case "SET_TRANSPORT_TIME":
            return produce(state, newState => {
                newState.transport.currentTime = action.time;
            });

        case "PLAYBACK_STARTED":
            return produce(state, newState => {
                newState.transport.playing = true;
            });

        case "PLAYBACK_STOPPED":
            return produce(state, newState => {
                newState.transport.playing = false;
            });

        case "RECORDING_STARTED":
            return produce(state, newState => {
                newState.transport.recording = true;
            });

        case "RECORDING_STOPPED":
            return produce(state, newState => {
                newState.transport.recording = false;
            });

        case "LAYER_ADDED":
            return produce(state, newState => {
                newState.layers.push({
                    startTime: action.startTime,
                    duration: action.duration,
                    id: action.id,
                    name: action.name,
                    rms: action.rms,
                });
            });

        case "LAYER_DELETED":
            return produce(state, newState => {
                newState.layers = newState.layers.filter(layer => layer.id !== action.id);
            });

        default:
            return state;
    }
};

export const history = createBrowserHistory({basename: "/"});

export const store = createStore(
    rootReducer,
    applyMiddleware(
        thunkMiddleware,
        loggerMiddleware,
        audioMiddleware,
    )
);

window.dispatch = store.dispatch;
