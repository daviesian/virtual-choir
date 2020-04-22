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
        id: layer.id,
        rms: addedLayer.rms,
        name: "/.layers/" + layer.id, // TODO: Use a nicer name. Username, for example.
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
    if (layer.enabled && !state.layers.find((l) => l.id === layer.id)) {
        await dispatch(loadSingerLayer(layer));
    }

    dispatch({
        type: "audio/enableLayer",
        id: layer.id,
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

export const recordingFinished = (id, audioData, startTime) => async (dispatch, getState) => {

    let addedLayer = await dispatch({
        type: "audio/addLayer",
        audioData,
        startTime,
        id,
    });

    dispatch({
        type: "LAYER_ADDED",
        startTime: startTime,
        duration: addedLayer.duration,
        id,
        rms: addedLayer.rms,
        name: "Layer " + id, // TODO: Use a nicer name. Username, for example.
        conductor: true,
        enabled: false,
    });

    await dispatch({
        type: "ws/call",
        fn: "newLayer",
        kwargs: { id, startTime, backingTrackId: getState().backingTrack.id },
        data: audioData,
    });
};

export const deleteLayer = (id, them) => async (dispatch, getState) => {

    if (them) {
        dispatch({
            type: "ws/call",
            fn: "deleteLayer",
            kwargs: { id },
        });
    }

    await dispatch({
        type: "audio/deleteLayer",
        id: id,
    });

    dispatch({
        type: "LAYER_DELETED",
        id: id,
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