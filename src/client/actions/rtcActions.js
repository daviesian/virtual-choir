
export const rtcConnect = () => async (dispatch) => {
    window.rtcTracks = await dispatch({
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

export const rtcMute = () => ({
    type: "rtc/mute",
});

export const rtcUnmute = () => ({
    type: "rtc/unmute",
})