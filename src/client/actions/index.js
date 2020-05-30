import {loadSingerLayer, targetLane} from "./audioActions";
import parseSRT from 'parse-srt'
import Peer from 'simple-peer';
import {produce} from "immer";

export const toast = (message, level='info') => ({
    type: "TOAST",
    level,
    message,
});

export const startLoading = (message) => ({
    type: "START_LOADING",
    message
});
export const updateLoadingMessage = (message) => ({
    type: "UPDATE_LOADING_MESSAGE",
    message
});
export const updateLoadingProgress = (progress, maximum) => ({
    type: "UPDATE_LOADING_PROGRESS",
    progress, maximum,
});
export const finishLoading = () => ({
    type: "FINISH_LOADING",
});

export const requestJoinRoom = (roomId) => async (dispatch) => {
    dispatch(startLoading('Joining room...'));
    try {
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

    } finally {
        dispatch(finishLoading());
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
    dispatch(startLoading());
    try {
        let project = await dispatch({
            type: "ws/call",
            fn: "loadProject",
            kwargs: {projectId, conduct},
        });

        dispatch(projectLoaded(project));
    } finally {
        dispatch(finishLoading());
    }
}

export const projectLoaded = ({project, lanes, items, users}) => async (dispatch, getState)=> {
    dispatch(startLoading("Loading project..."));
    try {
        if (getState().project) {
            dispatch(setRehearsalState({}));
        }
        dispatch({
            type: "CLEAR_PROJECT",
        });

        // Do this first, even though it isn't finished, so the UI looks quicker.
        dispatch({
            type: "PROJECT_LOADED",
            project,
            users,
        });

        dispatch({
            type: "audio/clearAll",
        });

        let i = 0;
        for (let item of items) {
            dispatch(updateLoadingMessage(`Loading audio clip ${++i} of ${items.length}...`))
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
        dispatch(updateLoadingMessage("Reticulating splines..."))

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
            dispatch(loadLyrics(project.lyricsUrl));
        }

    } finally {
        dispatch(finishLoading());
    }
};

export const loadLyrics = lyricsUrl => async dispatch => {
    dispatch(startLoading("Loading lyrics..."));
    try {
        let lyricsSrt = await (await fetch(lyricsUrl.replace(/\.[^.]*$/, ".srt"))).text();
        let lyrics = parseSRT(lyricsSrt);

        dispatch({
            type: "LYRICS_LOADED",
            lyricsUrl,
            lyrics,
        });
    } finally {
        dispatch(finishLoading());
    }

}

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

export const addLyrics = file => async (dispatch, getState) => {
    dispatch(startLoading("Uploading lyrics..."));
    try {
        await dispatch({
            type: "ws/call",
            fn: 'uploadLyrics',
            kwargs: {
                projectId: getState().project?.projectId,
                filename: file.name,
                srtText: await file.text(),
            }
        });
    } finally {
        dispatch(finishLoading());
    }
}

export const addScore = file => async (dispatch, getState) => {
    dispatch(startLoading("Uploading score..."));
    try {
        await dispatch({
            type: "ws/call",
            fn: "uploadScore",
            kwargs: {
                projectId: getState().project?.projectId,
                filename: file.name,
            },
            data: new Uint8Array(await file.arrayBuffer()),
        });
    } finally {
        dispatch(finishLoading());
    }
}

export const annotateScore = annotations => async (dispatch, getState) => {
    // N.B. Don't wait for this to complete.
    dispatch({
        type: "ws/call",
        fn: "annotateScore",
        kwargs: {
            projectId: getState().project?.projectId,
            annotations,
        },
    });

    // This will update our local cache of the project, which will be promptly overwritten by an update from the server
    dispatch({
        type: "SCORE_ANNOTATED",
        annotations,
    });
}

export const addScoreTimingKeyframe = (keyframe) => async (dispatch, getState) => {

    let newAnnotations = produce(getState().project?.scoreAnnotations || {}, annotations => {
        annotations.timing = annotations.timing || {};
        annotations.timing.keyframes = annotations.timing.keyframes || [];
        annotations.timing.keyframes.push(keyframe);
        annotations.timing.keyframes.sort((a,b) => {
            if (a.time < b.time) {
                return -1;
            } else if (a.time === b.time) {
                return 0;
            } else {
                return 1;
            }
        });
    });
    console.log(newAnnotations.timing.keyframes);

    await dispatch(annotateScore(newAnnotations));
}

export const addScoreTimingSystem = (system) => async (dispatch, getState) => {
    let newAnnotations = produce(getState().project?.scoreAnnotations || {}, annotations => {
        annotations.timing = annotations.timing || {};
        annotations.timing.systems = annotations.timing.systems || [];
        annotations.timing.systems.push(system);
    });
    await dispatch(annotateScore(newAnnotations));
}

export const removeScoreKeyframe = kf => async (dispatch, getState) => {
    await dispatch(annotateScore(produce(getState().project?.scoreAnnotations || {}, annotations => {
        if (annotations.timing.keyframes) {
            annotations.timing.keyframes = annotations.timing.keyframes.filter(k => k.x !== kf.x || k.y !== kf.y || k.page !== kf.page);
        }
    })));
}

export const removeScoreSystem = system => async (dispatch, getState) => {
    await dispatch(annotateScore(produce(getState().project?.scoreAnnotations || {}, annotations => {
        if (annotations.timing.systems) {
            annotations.timing.systems = annotations.timing.systems.filter(s => s.x !== system.x || s.y !== system.y || s.width !== system.width || s.height !== system.height || s.page !== system.page);
        }
    })));
}

export const clearScoreAnnotations = () => async (dispatch, getState) => {
    await dispatch(annotateScore({}));
}
export const clearScoreKeyframes = () => async (dispatch, getState) => {
    await dispatch(annotateScore(produce(getState().project?.scoreAnnotations || {}, annotations => {
        if (annotations.timing) {
            delete annotations.timing.keyframes;
        }
    })));
}
export const clearScoreSystems = () => async (dispatch, getState) => {
    await dispatch(annotateScore(produce(getState().project?.scoreAnnotations || {}, annotations => {
        if (annotations.timing) {
            delete annotations.timing.systems;
        }
    })));
}