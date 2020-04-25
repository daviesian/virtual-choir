import {stopCalibration} from "../../actions/audioActions";
import {addLayer, close, getDevices, init, loadBackingTrack, play, record, seek, stop, stopRecord,} from "./core";
import s from "./state";

export default store => next => {

    let initDevicesPromise = null;
    let _initDevices = async (reload=false) => {
        if (!initDevicesPromise || reload) {
            initDevicesPromise = new Promise(async (resolve, reject) => {
                let devices = await getDevices();

                dispatch({
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

                    let state = store.getState();
                    if (state.backingTrack) {
                        await loadBackingTrack(state.backingTrack.url);
                    }
                    for (let layer of state.layers || []) {
                        await addLayer(layer.layerId, layer.startTime, layer.enabled);
                    }
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

                case "loadBackingTrack":
                    await _init();
                    return await loadBackingTrack(action.url);


                case "play":
                    if (!s.backingTrackAudioBuffer) {
                        throw "Cannot start playback before loading backing track";
                    }
                    await _init();

                    for (let layer of s.layers) {
                        if (layer.sourceNode) {
                            layer.sourceNode.disconnect();
                        }
                        layer.sourceNode = null;
                    }
                    play(action.startTime || 0);


                    return true;

                case "seek":
                    return seek(action.time);

                case "stop":
                    if (!s.context)
                        return;

                    stop();

                    break;

                case "startRecording":
                    if (s.transportStartTime === null) {
                        dispatch({
                            type: "TOAST",
                            level: "warn",
                            message: "Cannot start recording unless backing track is playing",
                        });
                        return false;
                    }
                    await record();
                    return true;

                case "stopRecording":
                    if (s.recorderNode.parameters.get("recording").value !== 1) {
                        // dispatch({
                        //     type: "TOAST",
                        //     level: "warn",
                        //     message: "Cannot stop recording - recording not started",
                        // });
                        return false;
                    }
                    await stopRecord();
                    return true;

                case "addLayer":
                    await _init();
                    return await addLayer(action.layerId, action.startTime, action.enabled, action.audioData);

                case "enableLayer": {
                    let layer = s.layers.find(({layerId}) => layerId === action.layerId);
                    if (layer) {
                        layer.enabled = action.enabled;
                        return true;
                    } else {
                        return false;
                    }
                }

                case "deleteLayer":
                    s.layers = s.layers.filter(layer => layer.layerId !== action.layerId);
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
            return next(action);
        }
    };
}
