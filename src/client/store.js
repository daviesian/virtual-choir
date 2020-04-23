import thunkMiddleware from 'redux-thunk'
import {createLogger} from 'redux-logger'
import {applyMiddleware, createStore} from 'redux'
import {createBrowserHistory} from "history";
import audioMiddleware from './middleware/audio';
import wsMiddleware from "./middleware/ws";
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
    },
    conducting: false,
    sending: {},
    calibration: null,
    devices: null,
    user: null,
};

let rootReducer = produce((state, action) => {
    if (state === undefined)
        return initialState;

    switch (action.type) {

        case "SET_USER":
            state.user = action.user;
            break

        case "SET_CONDUCTING":
            state.conducting = action.conducting;
            break;

        case "INIT_AUDIO_DEVICES":
            state.devices = {
                inputs: action.inputs,
                outputs: action.outputs,
                selectedInputId: action.selectedInputId,
                selectedOutputId: action.selectedOutputId,
            };
            break;

        case "SELECTED_INPUT_DEVICE":
            state.devices.selectedInputId = action.id;
            break;

        case "SELECTED_OUTPUT_DEVICE":
            state.devices.selectedOutputId = action.id;
            break;

        case "INIT_DONE":
            state.audioInitialised = true;
            break;

        case "RESET_AUDIO":
            // TODO: Clear audio-related state.
            return state;

        case "CALIBRATION":
            state.calibration = state.calibration || {};
            if (action.calibrationType) {
                state.calibration.type = action.calibrationType;
            }
            if (action.calibration) {
                delete state.calibration.type;
                state.calibration.calibration = action.calibration;
            }
            if (action.sample) {
                state.calibration.samples = state.calibration.samples || [];
                state.calibration.samples.push(action.sample.latency);
                state.calibration.mean = action.sample.mean;
                state.calibration.sd = action.sample.sd;
            }
            break;

        case "CALIBRATION_DONE":
            delete state.calibration;
            return;

        case "BACKING_TRACK_LOADED":
            state.backingTrack = {
                name: action.name,
                duration: action.duration,
                id: action.id,
                url: action.url,
                rms: action.rms
            };
            break;

        case "SEEK":
            state.transport.currentTime = action.time;
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
            state.layers = state.layers.filter(l => l.id !== action.id);
            state.layers.push({
                startTime: action.startTime,
                duration: action.duration,
                id: action.id,
                name: action.name,
                rms: action.rms,
                enabled: action.enabled,
            });
            break;

        case "LAYER_UPDATE": {
            let layer = state.layers.find(({id}) => id === action.layer.id)
            // TODO: Allow updating more stuff
            if (layer) {
                layer.enabled = action.layer.enabled;
            } else {
                throw new Error(`Cannot enable non-existent layer: ${action.layer.id}`);
            }
            break;
        }

        case "LAYER_DELETED":
            state.layers = state.layers.filter(layer => layer.id !== action.id);
            break;

        case "SEND_PROGRESS":
            state.sending[action.transferId] = {
                sentBytes: action.sentBytes,
                totalBytes: action.totalBytes,
            };
            break;
        case "SEND_PROGRESS_DONE":
            delete state.sending[action.transferId];
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
