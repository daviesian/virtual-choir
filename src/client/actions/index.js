
export const toast = (message, level='info') => ({
    type: "TOAST",
    level,
    message,
});

export const requestJoinRoom = (room) => ({
    type: "ws/call",
    fn: "joinRoom",
    kwargs: { room },
});

export const requestLeaveRoom = () => ({
    type: "ws/call",
    fn: "leaveRoom",
});

export const setConducting = (conducting) => async (dispatch, getState) => {

    let nowConducting = await dispatch({
        type: "ws/call",
        fn: "conductRoom",
        kwargs: { conducting },
    });

    if (nowConducting === true) {
        dispatch({
            type: "SET_CONDUCTING",
            conducting: conducting,
        });
    } else {
        dispatch(toast("Cannot become conductor"));
    }
};

export const singerState = state => ({
    type: "ws/call",
    fn: "singerStateUpdate",
    state: {},
});

export const updateSingerState = (singer, state) => ({
    type: "UPDATE_SINGER_STATE",
    singer,
    state
});

export const sendProgress = (transferId, sentBytes, totalBytes) => (dispatch, getState) => {
    dispatch({
        type: "SEND_PROGRESS",
        _log: false,
        transferId,
        sentBytes,
        totalBytes,
    });

    if (sentBytes === totalBytes) {
        setTimeout(() => dispatch({
            type: "SEND_PROGRESS_DONE",
            transferId,
        }), 1000);
    }
};


