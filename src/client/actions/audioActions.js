import {singerState, toast} from "./index";


export const init = () => async dispatch => {
    await dispatch({type: "audio/init"});
    dispatch({type: "INIT_DONE"});
};

export const reset = () => async dispatch => {
    await dispatch({type: "audio/close"});
    dispatch({type: "RESET_AUDIO"});
};

export const selectInputDevice = (id) => async dispatch => {
    await dispatch(reset());
    await dispatch({
        type: "SELECTED_INPUT_DEVICE",
        id
    });
    await dispatch(init());
};

export const selectOutputDevice = (id) => async dispatch => {
    await dispatch(reset());
    await dispatch({
        type: "SELECTED_OUTPUT_DEVICE",
        id
    });
    await dispatch(init());
};

export const startCalibration = () => async dispatch => {
    await dispatch({
        type: "audio/startCalibration",
    });
};

export const stopCalibration = () => async dispatch => {
    await dispatch({
        type: "audio/stopCalibration",
    });

    dispatch({
        type: "CALIBRATION_DONE"
    });
};

export const loadSingerLayer = (layer) => async (dispatch, getState) => {

    let addedLayer = await dispatch({
        type: "audio/addLayer",
        ...layer,
    });

    dispatch({
        type: "LAYER_ADDED",
        startTime: layer.startTime,
        duration: addedLayer.duration,
        layerId: layer.layerId,
        rms: addedLayer.rms,
        name: "/.layers/" + layer.layerId, // TODO: Use a nicer name. Username, for example.
        enabled: layer.enabled,
    });

};

export const updateLayer = (layer, them=false) => async (dispatch, getState) => {

    if (them) {
        dispatch({
            type: "ws/call",
            fn: "updateLayer",
            kwargs: { layer },
        });
    }

    let state = getState();
    if (layer.enabled && !state.layers.find((l) => l.layerId === layer.layerId)) {
        await dispatch(loadSingerLayer(layer));
    }

    dispatch({
        type: "audio/enableLayer",
        layerId: layer.layerId,
        enabled: layer.enabled,
    });

    dispatch({
        type: "LAYER_UPDATE",
        layer,
    });

    if (!getState().conducting) {
        dispatch(singerState(getState()));
    }
};

export const play = (startTime, me=true, them=false) => async (dispatch, getState) => {

    if (them) {
        dispatch({
            type:"ws/call",
            fn: "play",
            kwargs: {startTime},
        });
    }

    if (me) {
        try {
            await dispatch({type: "audio/play", startTime});
            dispatch({
                type: "PLAYBACK_STARTED",
            });
        } catch (e) {
            dispatch(toast(e, 'error'));
        }
    }

    if (!getState().conducting) {
        dispatch(singerState(getState()));
    }
};

export const stop = (me=true, them=false) => async (dispatch, getState) => {

    if (them) {
        dispatch({
            type:"ws/call",
            fn: "stop",
            kwargs: {},
        });
    }

    if (me) {
        await dispatch({type: "audio/stop"});
        dispatch({
            type: "PLAYBACK_STOPPED",
        });
    }

    if (!getState().conducting) {
        dispatch(singerState(getState()));
    }

};

export const startRecording = (me=true, them=false) => async (dispatch, getState) => {

    if (them) {
        dispatch({
            type:"ws/call",
            fn: "startRecording",
            kwargs: {},
        });
    }

    if (me) {
        try {
            await dispatch({type: "audio/startRecording"});
            dispatch({
                type: "RECORDING_STARTED",
            });
        } catch (e) {
            dispatch(toast(e, 'error'));
        }
    }

    if (!getState().conducting) {
        dispatch(singerState(getState()));
    }

};

export const stopRecording = (me=true, them=false) => async (dispatch, getState) => {

    if (them) {
        dispatch({
            type:"ws/call",
            fn: "stopRecording",
            kwargs: {},
        });
    }

    if (me) {
        await dispatch({type: "audio/stopRecording"});
        dispatch({
            type: "RECORDING_STOPPED",
        });
    }

    if (!getState().conducting) {
        dispatch(singerState(getState()));
    }

};

export const recordingFinished = (layerId, audioData, startTime) => async (dispatch, getState) => {

    let addedLayer = await dispatch({
        type: "audio/addLayer",
        audioData,
        startTime,
        layerId,
    });

    dispatch({
        type: "LAYER_ADDED",
        startTime: startTime,
        duration: addedLayer.duration,
        layerId,
        rms: addedLayer.rms,
        name: "Layer " + layerId, // TODO: Use a nicer name. Username, for example.
        conductor: true,
        enabled: false,
    });

    await dispatch({
        type: "ws/call",
        fn: "newLayer",
        kwargs: { layerId, startTime, backingTrackId: getState().backingTrack.backingTrackId },
        data: audioData,
    });
};

export const deleteLayer = (layerId, them) => async (dispatch, getState) => {

    if (them) {
        dispatch({
            type: "ws/call",
            fn: "deleteLayer",
            kwargs: { layerId },
        });
    }

    await dispatch({
        type: "audio/deleteLayer",
        layerId,
    });

    dispatch({
        type: "LAYER_DELETED",
        layerId,
    });
};


export const seek = (time, them=false) => async (dispatch, getState) => {

    let canSeek = await dispatch({
        type: "audio/seek",
        time,
    });

    if (canSeek) {
        if (them) {
            dispatch({
                type: "ws/call",
                fn: "seek",
                kwargs: { time },
            });
        }


        dispatch({
            type: "SEEK",
            time: time || 0,
        });
    } else {
        dispatch(toast("Cannot seek while recording"));
    }

};