
export default {
    audio: null,
    sink: null,
    context: null,
    micStream: null,
    micStreamSourceNode: null,
    backingTrackAudioBuffer: null,
    backingTrackRMS: null,


    transportStartTime: null,
    backingTrackSourceNode: null,

    recorderNode: null,
    calibratorNode: null,
    layers: [],
    transportTimeCallbacks: [],
};