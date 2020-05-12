import {stopCalibration} from "../../actions/audioActions";
import {
    addLayer,
    close, disableLane, enableLane,
    getDevices,
    init,
    loadItem,
    play,
    record,
    seek,
    stop,
    stopRecord,
} from "./core";
import s from "./state";

export default store => next => {

    let initDevicesPromise = null;
    let _initDevices = async (reload=false) => {
        if (!initDevicesPromise || reload) {
            initDevicesPromise = new Promise(async (resolve, reject) => {
                let devices = await getDevices();

                store.dispatch({
                    type: "INIT_AUDIO_DEVICES",
                    inputs: devices.inputs,
                    outputs: devices.outputs,
                    selectedInputId: devices.selectedInput?.id,
                    selectedOutputId: devices.selectedOutput?.id,
                });
                resolve();
            });
        }
        return initDevicesPromise;
    }

    let initPromise = null;
    let _init = async () => {
        if (!initPromise) {
            initPromise = new Promise(async (resolve, reject) => {
                await _initDevices();
                let state = store.getState();
                await init(state.devices.selectedInputId, state.devices.selectedOutputId, store.dispatch);
                resolve();
            });
        }
        return initPromise;
    }

    return async action => {

        if (action.type.startsWith("audio/")) {
            switch (action.type.substr(6)) {

                case "initDevices":
                    await _initDevices(action.reload);
                    break;

                case "init": {
                    await _init();

                    // let state = store.getState();
                    // if (state.backingTrack) {
                    //     await loadBackingTrack(state.backingTrack.url);
                    // }
                    // for (let layer of state.layers || []) {
                    //     await addLayer(layer.layerId, layer.startTime, layer.enabled);
                    // }
                    break;
                }

                case "close":
                    initPromise = null;
                    await close();

                    break;

                case "startCalibration":
                    await _init();
                    s.calibratorNode.parameters.get("enabled").value = 1;
                    break;

                case "stopCalibration":
                    await _init();
                    s.calibratorNode.parameters.get("enabled").value = 0;
                    break;

                // case "loadBackingTrack":
                //     await _init();
                //     return await loadBackingTrack(action.url);


                case "play":
                    if (s.transportStartTime !== null) {
                        return false; // Should also return false here if there are any other reasons we can't start playback
                    }
                    await _init();

                    for (let [itemId, item] of Object.entries(s.items)) {
                        if (item.sourceNode) {
                            item.sourceNode.disconnect();
                        }
                        item.sourceNode = null;
                    }
                    return play(action.startTime || 0);

                case "seek":
                    return seek(action.time);

                case "stop":
                    if (!s.context || s.transportStartTime === null)
                        return false;

                    return stop();


                case "startRecording":
                    if (s.transportStartTime === null) {
                        return false; // Can't start recording if we're not playing.
                    }
                    return record();

                case "stopRecording":
                    if (s.transportStartTime === null || s.videoRecorder.state !== "recording") {
                        return false; // Can't stop recording unless we're already recording.
                    }
                    return stopRecord();

                case "clearAll":
                    for (let item of Object.values(s.items)) {
                        if (item.sourceNode) {
                            item.sourceNode.disconnect();
                        }
                    }
                    s.items = {};
                    s.enabledLanes = {};
                    return true;

                case "loadItem":
                    return await loadItem(action.item);

                case "updateItem":
                    throw new Error("audio/updateItem not implemented");

                case "deleteItem":
                    if (s.items[action.itemId]) {
                        if (s.items[action.itemId].sourceNode) {
                            s.items[action.itemId].sourceNode.disconnect();
                        }
                        delete s.items[action.itemId];
                    }
                    return true;

                case "addTransportTimeCallback":
                    if (s.transportTimeCallbacks.indexOf(action.callback) === -1) {
                        s.transportTimeCallbacks.push(action.callback);
                    }
                    return () => {
                        s.transportTimeCallbacks = s.transportTimeCallbacks.filter(c => c !== action.callback);
                    };

                case "removeTransportTimeCallback":
                    s.transportTimeCallbacks = s.transportTimeCallbacks.filter(c => c !== action.callback);
                    return true;
            }
        } else {
            // We just watch these actions going past.
            switch (action.type) {
                case "LANE_ADDED": // Fall through
                case "LANE_UPDATED":
                    if (action.lane.enabled) {
                        enableLane(action.lane.laneId);
                    } else {
                        disableLane(action.lane.laneId);
                    }
                    break;
                case "LANE_DELETED":
                    disableLane(action.laneId);
                    break;
            }
            return next(action);
        }
    };
}
