import {loadSingerLayer} from "./audioActions";

export const toast = (message, level='info') => ({
    type: "TOAST",
    level,
    message,
});

export const requestJoinRoom = (room) => async (dispatch) => {
    let dbRoom = await dispatch({
        type: "ws/call",
        fn: "joinRoom",
        kwargs: { room },
    });

    log.info(`Joined room '${room}':`, dbRoom);
    if (dbRoom?.currentBackingTrackId) {
        let backingTrack = await dispatch({
            type: "ws/call",
            fn: "getBackingTrack",
            kwargs: { backingTrackId: dbRoom.currentBackingTrackId },
        });
        await dispatch(loadBackingTrack(backingTrack, false));

        let layers = await dispatch({
            type: "ws/call",
            fn: "getLayers",
            kwargs: { roomId: room, backingTrackId: dbRoom.currentBackingTrackId },
        });
        for (let layer of layers) {
            await dispatch(loadSingerLayer(layer))
        }
    }
};

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
    kwargs: {
        state: {
            profile: state.profile,
        }
    },
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


export const loadBackingTrack = ({backingTrackId, name, url}, conduct = false) => async dispatch => {

    if (conduct) {
        dispatch({
            type: "ws/call",
            fn: "loadBackingTrack",
            kwargs: {backingTrackId},
        });
    }

    let {duration, rms} = await dispatch({
        type: "audio/loadBackingTrack",
        url,
    });

    dispatch({
        type: "BACKING_TRACK_LOADED",
        backingTrackId,
        name,
        url,
        duration,
        rms,
    })

};

export const setUser = (user) => ({
    type: "SET_USER",
    user
});

export const updateUser = ({name, voice}) => async (dispatch, getState) => {

    let user = { ...getState().user };
    user.name = name || user.name;
    user.voice = voice || user.voice;

    await dispatch({
        type: "ws/call",
        fn: "updateUser",
        kwargs: {user}
    });

    dispatch({
        type: "SET_USER",
        user,
    })
};