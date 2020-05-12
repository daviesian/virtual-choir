
export const rtcConnect = () => async (dispatch) => {
    let rtcTracks = await dispatch({
        type: "rtc/connect",
    });

    let me = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    });

    await dispatch({
        type: "rtc/setMe",
        me,
    });

    window.rtcTracks = {
        myVideo: me.getVideoTracks()[0],
        myAudio: me.getAudioTracks()[0],
        ...rtcTracks,
    };

    dispatch({
        type: "RTC_STARTED"
    });
};


export const requestSpeak = (wantsToSpeak) => async (dispatch) => {
    let speaking = await dispatch({
        type: "ws/call",
        fn: "requestSpeak",
        kwargs: { wantsToSpeak },
    });

    dispatch({
        type: "RTC_SPEAKING",
        speaking
    });
}

export const nowSpeaking = (user) => ({
    type: "NOW_SPEAKING",
    user,
});

export const rtcMute = () => dispatch => {
    dispatch({
        type: "rtc/mute",
    });

    dispatch({
        type: "SET_MUTED",
        muted: true,
    });
}

export const rtcUnmute = () => dispatch => {
    dispatch({
        type: "rtc/unmute",
    });

    dispatch({
        type: "SET_MUTED",
        muted: false,
    });
}

export const muteChoir = () => dispatch => {
    dispatch({
        type: "ws/call",
        fn: 'muteChoir',
    })
};