import {loadSingerLayer, targetLane} from "./audioActions";
import parseSRT from 'parse-srt'
import Peer from 'simple-peer';


export const toast = (message, level='info') => ({
    type: "TOAST",
    level,
    message,
});

export const requestJoinRoom = (roomId) => async (dispatch) => {
    let room = await dispatch({
        type: "ws/call",
        fn: "joinRoom",
        kwargs: { roomId },
    });

    await dispatch({
        type: "JOINED_ROOM",
        room,
    });

    log.info(`Joined room '${roomId}':`, room);
    if (room?.currentProjectId) {
        await dispatch(loadProject(room.currentProjectId, false));
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
            user: state.user,
            sending: state.sending,
            state: state.transport?.state,
            projectId: state.project?.projectId,
            loadedItems: Object.keys(state.items),
            targetLaneId: state.targetLaneId,
            muted: state.muted,
        }
    },
});

export const updateSingerState = (user, state) => ({
    type: "UPDATE_SINGER_STATE",
    user,
    state
});

export const singerJoined = (user) => ({
    type: "SINGER_JOINED",
    user,
});

export const singerLeft = (userId) => ({
    type: "SINGER_LEFT",
    userId,
});

export const sendProgress = (transferId, sentBytes, totalBytes, coarseUpdate=false) => (dispatch, getState) => {
    dispatch({
        type: "SEND_PROGRESS",
        _log: false,
        transferId,
        sentBytes,
        totalBytes,
    });

    if (sentBytes === totalBytes) {
        setTimeout(() => {
            dispatch({
                type: "SEND_PROGRESS_DONE",
                transferId,
            });
            dispatch(singerState(getState()));
        }, 1000);
        dispatch(singerState(getState()));
    } else if (coarseUpdate) {
        dispatch(singerState(getState()));
    }

};

export const createProject = name => async dispatch => {

    let project = await dispatch({
        type: "ws/call",
        fn: "createProject",
        kwargs: { name },
    });

    dispatch(projectLoaded(project));
};

export const loadProject = (projectId, conduct = false) => async dispatch => {

    let project = await dispatch({
        type: "ws/call",
        fn: "loadProject",
        kwargs: {projectId, conduct},
    });

    dispatch(projectLoaded(project));
}

export const projectLoaded = ({project, lanes, items, users}) => async (dispatch, getState)=> {

    dispatch({
        type: "CLEAR_PROJECT",
    });
    dispatch({
        type: "audio/clearAll",
    });

    for (let item of items) {
        let audioItem = await dispatch({
            type: "audio/loadItem",
            item,
        });
        item.duration = audioItem.duration;
        item.rms = audioItem.rms;

        dispatch({
            type: "ITEM_ADDED",
            item,
        });
    }

    let myTargetLane = null;
    let myUserId = getState().user?.userId;
    for (let lane of lanes) {
        dispatch({
            type: "LANE_ADDED",
            lane,
        });
        if (lane.userId === myUserId) {
            myTargetLane = lane.laneId;
        }
    }

    if (myTargetLane) {
        dispatch(targetLane(myUserId, myTargetLane, false));
    }

    if (project.lyricsUrl) {
        let lyricsSrt = await (await fetch(project.lyricsUrl.replace(/\.[^.]*$/, ".srt"))).text();
        let lyrics = parseSRT(lyricsSrt);

        dispatch({
            type: "LYRICS_LOADED",
            lyricsUrl: project.lyricsUrl,
            lyrics,
        });
    }


    dispatch({
        type: "PROJECT_LOADED",
        project,
        users,
    });
};

export const uploadItem = file => async (dispatch) => {
    let buffer = new Uint8Array(await file.arrayBuffer());

    dispatch({
        type: "ws/call",
        fn: "uploadItem",
        kwargs: { name: file.name },
        data: buffer,
    });
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

    dispatch(singerState(getState()));
};

export const setRehearsalState = (rehearsalState, conduct=false) => async (dispatch, getState) => {

    if (conduct) {
        dispatch({
            type: "ws/call",
            fn: "setRehearsalState",
            kwargs: {rehearsalState},
        });
    }

    dispatch({
        type: "SET_REHEARSAL_STATE",
        rehearsalState,
    });
}

window.whiteNoise = () => {
    let canvas = Object.assign(document.createElement("canvas"), {width: 320, height: 240});
    let ctx = canvas.getContext('2d');
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let p = ctx.getImageData(0, 0, canvas.width, canvas.height);
    requestAnimationFrame(function draw(){
        for (var i = 0; i < p.data.length; i++) {
            p.data[i++] = p.data[i++] = p.data[i++] = Math.random() * 255;
        }
        ctx.putImageData(p, 0, 0);
        requestAnimationFrame(draw);
    });
    return canvas.captureStream(60).getTracks()[0];
};

export const doWebRTC = () => async dispatch => {
    window.peer = new Peer();

    peer.on("signalingStateChange", state => {
        if (state === "have-remote-offer") {
            peer._pc.getTransceivers()[2].direction = "sendonly";

        }
    });


    peer.on("signal", data => {
        console.log("SIGNAL", data);
        dispatch({
            type: "ws/call",
            fn: "peerSignal",
            kwargs: { data },
        });
    });

    peer.on("connect", async () => {
        console.log("CONNECT");

        //let m = await navigator.mediaDevices.getUserMedia({
        //    video: true,
        //    audio: false
        //});

        //window.m = m;

        //debugger;

        //peer.addStream(m);

        //let t = peer._pc.getTransceivers()[2].sender.replaceTrack(m.getVideoTracks()[0]);

    });

    peer.on("track", (a,b,c) => {
        debugger;
    });

    peer.on("data", e => {
        console.log("DATA", e);
    });

    dispatch({
        type: "ws/call",
        fn: "initPeer"
    });





}