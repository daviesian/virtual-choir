import {singerState, toast} from "./index";


export const init = () => async dispatch => {
    await dispatch({type: "audio/init"});
    dispatch({type: "INIT_DONE"});
};

export const reset = () => async dispatch => {
    await dispatch({type: "audio/close"});
    dispatch({type: "RESET"});
};

export const selectInputDevice = (id) => async dispatch => {
    await dispatch(init());
    dispatch({
        type: "SELECTED_INPUT_DEVICE",
        id
    });
};

export const selectOutputDevice = (id) => async dispatch => {
    await dispatch(init());
    dispatch({
        type: "SELECTED_OUTPUT_DEVICE",
        id
    });
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

export const loadBackingTrack = (url, conduct=false) => async dispatch => {

    if (conduct) {
        dispatch({
            type:"ws/call",
            fn: "loadBackingTrack",
            kwargs: {url},
        });
    }
    await dispatch({type:"audio/init"});

    let {duration, rms} = await dispatch({
        type: "audio/loadBackingTrack",
        arrayBuffer: await (await fetch(url)).arrayBuffer(),
    });

    dispatch({
        type: "BACKING_TRACK_LOADED",
        name: url,
        duration,
        rms,
    })

};

export const loadSingerLayer = (id, startTime) => async (dispatch, getState) => {
    let audioData = new Float32Array(await (await fetch(`/.layers/${id}.raw`)).arrayBuffer());

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
        name: "/.layers/" + addedLayer.id, // TODO: Use a nicer name. Username, for example.
    });

};

export const toggleLayer = (id, startTime, enabled, them=false) => async (dispatch, getState) => {

    if (them) {
        dispatch({
            type: "ws/call",
            fn: "toggleLayer",
            kwargs: { id, startTime, enabled },
        });
    }

    let state = getState();
    if (enabled && !state.layers.find((l) => l.id === id)) {
        await dispatch(loadSingerLayer(id, startTime));
    }

    dispatch({
        type: "audio/toggleLayer",
        id: id,
        enabled,
    });

    dispatch({
        type: "LAYER_TOGGLE",
        id,
        enabled,
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

export const stopRecording = (me=true, them=true) => async (dispatch, getState) => {

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
        name: "Layer " + addedLayer.id, // TODO: Use a nicer name. Username, for example.
        conductor: true,
        enabled: false,
    });

    await dispatch({
        type: "ws/call",
        fn: "newLayer",
        kwargs: { id, startTime },
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

export const setTransportTime = (time) => (dispatch, getState) => {

    dispatch({
        type: "SET_TRANSPORT_TIME",
        time: time || 0,
        _log: false
    });

};

export const seek = (time, them=false) => (dispatch, getState) => {

    if (them) {
        dispatch({
            type: "ws/call",
            fn: "seek",
            kwargs: { time },
        });
    }

    dispatch(setTransportTime(time));
};