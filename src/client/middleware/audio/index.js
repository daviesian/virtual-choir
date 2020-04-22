import {stopCalibration} from "../../actions/audioActions";
import {getAudioBufferRMSImageURL} from "../../util";
import {
    init,
    close,
    play,
    stop,
    record,
    stopRecord,
    seek, getDevices,
} from "./core";
import s from "./state";

export default store => next => async action => {

    let initWithSelectedDevices = async () => {
        let state = store.getState();
        return await init(state.devices.selectedInputId, state.devices.selectedOutputId, store.dispatch);
    }

    if (action.type.startsWith("audio/")) {
        switch (action.type.substr(6)) {

            case "initDevices": {
                let devices = await getDevices();

                dispatch({
                    type: "INIT_AUDIO_DEVICES",
                    inputs: devices.inputs,
                    outputs: devices.outputs,
                    selectedInputId: devices.selectedInput?.id,
                    selectedOutputId: devices.selectedOutput?.id,
                });

                return;
            }

            case "init":
                return await initWithSelectedDevices();

            case "close":
                await close();

                break;

            case "startCalibration":
                await initWithSelectedDevices();
                s.calibratorNode.parameters.get("enabled").value = 1;
                break;

            case "stopCalibration":
                await initWithSelectedDevices();
                s.calibratorNode.parameters.get("enabled").value = 0;
                break;

            case "loadBackingTrack":
                s.backingTrackAudioBuffer = await s.context.decodeAudioData(action.arrayBuffer);

                return {
                    duration: s.backingTrackAudioBuffer.duration,
                    rms: await getAudioBufferRMSImageURL(s.backingTrackAudioBuffer, s.backingTrackAudioBuffer.duration * 20),
                };

            case "play":
                if (!s.backingTrackAudioBuffer) {
                    throw "Cannot start playback before loading backing track";
                }
                await initWithSelectedDevices();

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
                let audioBuffer = s.context.createBuffer(1, action.audioData.length, s.context.sampleRate);
                audioBuffer.copyToChannel(action.audioData, 0, 0);
                s.layers.push({
                    buffer: audioBuffer,
                    startTime: action.startTime,
                    id: action.id,
                    enabled: action.enabled,
                });
                return {
                    duration: audioBuffer.duration,
                    id: action.id,
                    rms: await getAudioBufferRMSImageURL(audioBuffer, audioBuffer.duration * 20),
                };

            case "toggleLayer": {
                let layer = s.layers.find(({id}) => id === action.id);
                if (layer) {
                    layer.enabled = action.enabled;
                    return true;
                } else {
                    return false;
                }
            }

            case "deleteLayer":
                s.layers = s.layers.filter(layer => layer.id !== action.id);
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
