
export const rtcConnect = () => ({
    type: "rtc/connect",
});

export const startSending = () => async (dispatch) => {
    let m = await navigator.mediaDevices.getUserMedia({
       video: true,
       audio: true
    });

    await dispatch({
        type: "rtc/send",
        myVideo: m.getVideoTracks()[0],
        myAudio: m.getAudioTracks()[0],
    });
};