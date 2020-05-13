import {finishLoading, singerState, startLoading} from "./index";
import {rtcMute, rtcUnmute} from "./rtcActions";

export const initDevices = (reload=false) => async dispatch => {
    await dispatch({
        type: "audio/initDevices",
        reload,
    });
}

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

export const loadItem = (item, lane, user) => async (dispatch, getState) => {
    // TODO: Make sure the user exists

    dispatch(startLoading("Loading audio clip..."));
    try {

        if (!(lane.laneId in getState().lanes)) {
            if (user.userId === getState().user?.userId && !getState().targetLaneId) {
                // This is my lane, and I don't have a target.
                await dispatch(targetLane(user.userId, lane.laneId, false));
            }
            await dispatch({
                type: "LANE_ADDED",
                lane,
            });
        }

        let audioItem = await dispatch({
            type: "audio/loadItem",
            item,
        });

        await dispatch({
            type: "ITEM_ADDED",
            item: {...item, ...audioItem},
        })
    } finally {
        dispatch(finishLoading());
    }
};

export const updateLane = (lane, items, user, them=false) => async (dispatch, getState) => {
    if (them) {
        dispatch({
            type: "ws/call",
            fn: "updateLane",
            kwargs: { lane },
        });
    }

    // Load items we don't know about in a newly-enabled lane
    if (items && lane.enabled) {
        let knownItems = getState().items;
        for (let item of items || []) {
            if (!(item.itemId in knownItems)) {
                await dispatch(loadItem(item, lane, user))
            }
        }
    }

    dispatch({
        type: "LANE_UPDATED",
        lane,
    });

    //if (!getState().conducting) {
    //    dispatch(singerState(getState()));
    //}
};

export const targetLane = (userId, laneId, them) => async (dispatch, getState) => {

    if (them) {
        dispatch({
            type: "ws/call",
            fn: "setTargetLane",
            kwargs: { userId, laneId },
        });
    }

    if (userId === getState().user?.userId) {
        dispatch({
            type: "SET_TARGET_LANE",
            laneId,
        });

        dispatch(singerState(getState()));
    }
};

export const updateItem = (item, them=false) => async (dispatch, getState) => {
    if (them) {
        dispatch({
            type: "ws/call",
            fn: "updateItem",
            kwargs: { item },
        });
    }

    await dispatch({
        type: "audio/updateItem",
        item,
    });

    dispatch({
        type: "ITEM_UPDATED",
        item,
    });

    //if (!getState().conducting) {
    //    dispatch(singerState(getState()));
    //}
};

export const play = (startTime, me=true, them=false) => async (dispatch, getState) => {

    await dispatch(rtcMute());
    if (!await dispatch({type: "audio/play", startTime}))
        return;

    if (them) {
        dispatch({
            type:"ws/call",
            fn: "play",
            kwargs: {startTime},
        });
    }

    if (me) {
        dispatch({
            type: "PLAYBACK_STARTED",
        });

        //if (!getState().conducting) {
            dispatch(singerState(getState()));
        //}
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

    if (me && await dispatch({type: "audio/stop"})) {

        dispatch({
            type: "STOPPED",
        });
        //if (!getState().conducting) {
            dispatch(singerState(getState()));
        //}
    }
    setTimeout(() => {
        dispatch(rtcUnmute());
    },500);

};

export const startRecording = (me=true, them=false) => async (dispatch, getState) => {

    let wasPlaying = getState().playing

    if (!wasPlaying) {
        await dispatch(play(getState().transport.currentTime, me, them));
    }

    if (!await dispatch({type: "audio/startRecording"})) {
        if (!wasPlaying) {
            await dispatch(stop(me, them));
        }
        return;
    }

    if (them) {
        dispatch({
            type:"ws/call",
            fn: "startRecording",
            kwargs: {},
        });
    }

    if (me) {
        dispatch({
            type: "RECORDING_STARTED",
        });

        //if (!getState().conducting) {
            dispatch(singerState(getState()));
        //}
    }
};

export const stopRecording = (me=true, them=false) => async (dispatch, getState) => {

    if (!await dispatch({type: "audio/stopRecording"})) {
        return;
    }

    if (them) {
        dispatch({
            type: "ws/call",
            fn: "stopRecording",
            kwargs: {},
        });
    }

    if (me) {
        dispatch({
            type: "RECORDING_STOPPED",
        });

        //if (!getState().conducting) {
            dispatch(singerState(getState()));
        //}
    }
};

export const recordingFinished = (itemId, videoFileBlobs, referenceOutputData, referenceOutputStartTime) => async (dispatch, getState) => {
    let data = new Uint8Array(videoFileBlobs.reduce((totalSize, blob) => totalSize + blob.size, 0) + referenceOutputData.byteLength);

    let ptr = 0;
    for (let b of videoFileBlobs) {
        let arr = new Uint8Array(await b.arrayBuffer());
        data.set(arr, ptr);
        ptr += arr.byteLength;
    }
    data.set(new Uint8Array(referenceOutputData.buffer), ptr);

    // N.B. We're throwing away the video mime type here. Pass it through if we need it.

    await dispatch({
        type: "ws/call",
        fn: "newItem",
        kwargs: {
            itemId,
            laneId: getState().targetLaneId,
            videoBytes: ptr,
            referenceOutputStartTime,
        },
        data
    });
};

export const deleteItem = (itemId, them) => async (dispatch, getState) => {
    if (them) {
        dispatch({
            type: "ws/call",
            fn: "deleteItem",
            kwargs: { itemId },
        });
    }

    await dispatch({
        type: "audio/deleteItem",
        itemId,
    });

    dispatch({
        type: "ITEM_DELETED",
        itemId,
    });
}

export const deleteLane = (laneId, them) => async (dispatch, getState) => {
    for (let [itemId, item] of Object.entries(getState().items || {})) {
        if (item.laneId === laneId) {
            await dispatch({
                type: "audio/deleteItem",
                itemId,
            });
        }
    }

    if (them) {
        dispatch({
            type: "ws/call",
            fn: "deleteLane",
            kwargs: { laneId },
        });
    }

    dispatch({
        type: "LANE_DELETED",
        laneId,
    })
}


export const seek = (time, me=true, them=false) => async (dispatch, getState) => {
    console.log(them);
    if(!await dispatch({ type: "audio/seek", time })) {
        return;
    }

    if (them) {
        dispatch({
            type: "ws/call",
            fn: "seek",
            kwargs: { time },
        });
    }

    if (me) {
        dispatch({
            type: "SEEK",
            time: time || 0,
        });

        //if (!getState().conducting) {
            dispatch(singerState(getState()));
        //}
    }

};

// TODO: Enable and disable tracks while playing
