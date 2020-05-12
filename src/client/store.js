import thunkMiddleware from 'redux-thunk'
import {createLogger} from 'redux-logger'
import {applyMiddleware, createStore} from 'redux'
import {createBrowserHistory} from "history";
import audioMiddleware from './middleware/audio';
import wsMiddleware from "./middleware/ws";
import rtcMiddleware from "./middleware/rtc";
import {produce} from "immer";

const loggerMiddleware = createLogger({
    predicate: (getState, {_log}) => _log !== false,
    collapsed: true,
});

const initialState = {
    audioInitialised: false,
    backingTrack: null,
    transport: {
        currentTime: 0,
        state: null,
    },
    conducting: false,
    sending: {},
    calibration: null,
    devices: null,
    user: null,
    users: {},
    rehearsalState: {},
    rtcStarted: false,
    speaking: false,
    speaker: null,
    targetLaneId: null,
    items: {},
    lanes: {},
    room: null,
    muted: true,
    lyrics: {},
};

let rootReducer = produce((state, action) => {
    if (state === undefined)
        return initialState;

    switch (action.type) {

        case "SET_USER":
            state.user = action.user;
            state.users[action.user.userId] = {
                user: action.user,
                state: null,
                online: true,
            };
            break

        case "SET_CONDUCTING":
            state.conducting = action.conducting;
            if (action.conducting && state.room) {
                state.room.conductorUserId = state.user?.userId;
            }
            break;

        case "CONDUCTOR_UPDATED":
            state.room.conductorUserId = action.conductorUserId;
            for (let [uid, user] of Object.entries(state.users)) {
                if (uid === action.conductorUserId) {
                    user.online = true;
                }
            }
            break;

        case "JOINED_ROOM":
            state.room = action.room;
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

        case "CLEAR_PROJECT":
            state.project = null;
            state.targetLaneId = null;
            state.items = {};
            state.lanes = {};
            for (let [uid,user] of Object.entries(state.users)) {
                if (!user.online) {
                    delete state.users[uid];
                }
            }
            break;

        case "PROJECT_LOADED":
            state.project = action.project;
            for (let user of action.users || []) {
                if (!(user.userId in state.users)) {
                    state.users[user.userId] = {
                        user,
                        state: null,
                        online: false,
                    }
                }
            }
            break;

        case "LYRICS_LOADED":
            state.lyrics[action.lyricsUrl] = action.lyrics;
            break;

        case "LANE_ADDED":
            state.lanes[action.lane.laneId] = action.lane;
            break;

        case "ITEM_ADDED":
            state.items[action.item.itemId] = action.item;
            break;

        case "LANE_UPDATED":
            state.lanes[action.lane.laneId] = action.lane;
            break;

        case "ITEM_UPDATED":
            state.items[action.item.itemId] = action.item;
            break;

        case "LANE_DELETED":
            for (let [itemId, item] of Object.entries(state.items || {})) {
                if (item.laneId === action.laneId) {
                    delete state.items[itemId];
                }
            }
            delete state.lanes[action.laneId];
            if (state.targetLaneId === action.laneId) {
                state.targetLaneId = null;
            }
            break;

        case "ITEM_DELETED":
            delete state.items[action.itemId];
            break;

        case "SEEK":
            state.transport.currentTime = action.time;
            break;

        case "SET_TRANSPORT_TIME":
            state.transport.currentTime = action.time;
            break;

        case "PLAYBACK_STARTED":
            state.transport.state = 'playing';
            break;

        case "RECORDING_STARTED":
            state.transport.state = 'recording';
            break;

        case "STOPPED":
            state.transport.state = null;
            break;

        case "SET_TARGET_LANE":
            state.targetLaneId = action.laneId;
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

        case "UPDATE_SINGER_STATE":
            state.users[action.user.userId] = {
                user: action.user,
                state: action.state,
                online: true,
            };
            break;

        case "SINGER_LEFT":
            if (action.userId in state.users) {
                state.users[action.userId].online = false;
            }
            if (state.room && state.room.conductorUserId === action.userId) {
                state.room.conductorUserId = null;
            }
            break;

        case "SINGER_JOINED":

            state.users[action.user.userId] = {
                user: action.user,
                state: null,
                online: true,
            };
            break;

        case "SET_REHEARSAL_STATE":
            state.rehearsalState = action.rehearsalState;

            break;

        case "RTC_STARTED":
            state.rtcStarted = true;
            break;

        case "RTC_SPEAKING":
            state.speaking = action.speaking;
            break;

        case "NOW_SPEAKING":
            state.speaker = action.user;

            if(state.speaker?.userId !== state.user.userId) {
                state.speaking = false;
            }
            break;

        case "SET_MUTED":
            state.muted = action.muted;
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
        rtcMiddleware,
    )
);

window.store = store;