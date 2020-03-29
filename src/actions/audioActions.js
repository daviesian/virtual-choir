import {toast} from "./index";

export const init = () => async dispatch => {
    await dispatch({type: "audio/init"});
    dispatch({type: "INIT_DONE"});
};

export const reset = () => async dispatch => {
    await dispatch({type: "audio/close"});
    dispatch({type: "RESET"});
};

export const loadBackingTrack = url => async dispatch => {
    await dispatch({type:"audio/init"});

    let {duration, rms} = await dispatch({
        type: "audio/loadBackingTrack",
        arrayBuffer: await (await fetch("/stand-by-me.mp3")).arrayBuffer(),
    });

    dispatch({
        type: "BACKING_TRACK_LOADED",
        name: url,
        duration,
        rms,
    })

};

export const play = (startTime) => async dispatch => {
    try {
        await dispatch({type: "audio/play", startTime});
        dispatch({
            type: "PLAYBACK_STARTED",
        });
    } catch (e) {
        dispatch(toast(e, 'error'));
    }
};

export const stop = () => async dispatch => {
    dispatch({type: "audio/stop"});
    dispatch({
        type: "PLAYBACK_STOPPED",
    });
};

export const startRecording = () => async dispatch => {
    try {
        await dispatch({type: "audio/startRecording"});
        dispatch({
            type: "RECORDING_STARTED",
        });
    } catch (e) {
        dispatch(toast(e, 'error'));
    }
};

export const stopRecording = () => async dispatch => {
    dispatch({type: "audio/stopRecording"});
    dispatch({
        type: "RECORDING_STOPPED",
    });
};

export const addLayer = (audioData, startTime) => async (dispatch) => {
    let addedLayer = await dispatch({
        type: "audio/addLayer",
        audioData,
        startTime,
    });

    dispatch({
        type: "LAYER_ADDED",
        startTime: startTime,
        duration: addedLayer.duration,
        id: addedLayer.id,
        rms: addedLayer.rms,
        name: "Layer " + addedLayer.id, // TODO: Use a nicer name. Username, for example.
    });
};

export const deleteLayer = id => async dispatch => {
    await dispatch({
        type: "audio/deleteLayer",
        id: id,
    });

    dispatch({
        type: "LAYER_DELETED",
        id: id,
    });
};

export const setTransportTime = time => ({
    type: "SET_TRANSPORT_TIME",
    time: time || 0,
    _log: false
});