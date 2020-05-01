import s from "./state";
import Peer from "simple-peer";
import {RTCTransceivers} from "../../../shared";

export const connect = async (dispatch) => {
    return new Promise((resolve, reject) => {
        s.peer = new Peer();

        s.peer.on("signalingStateChange", state => {
            if (state === "have-remote-offer") {
                s.peer.getTransceiver(RTCTransceivers.MY_VIDEO).direction = "sendonly";
                s.peer.getTransceiver(RTCTransceivers.MY_AUDIO).direction = "sendonly";
            }
        });

        s.peer.on("signal", data => {
            dispatch({
                type: "ws/call",
                fn: "rtcSignal",
                kwargs: { data },
            });
        });

        s.peer.on("connect", async () => {
            console.log("RTC Connected");
            resolve({
                conductorVideo: s.peer.getTransceiver(RTCTransceivers.CONDUCTOR_VIDEO).receiver.track,
                conductorAudio: s.peer.getTransceiver(RTCTransceivers.CONDUCTOR_AUDIO).receiver.track,
                choirVideo: s.peer.getTransceiver(RTCTransceivers.CHOIR_VIDEO).receiver.track,
            });
        });

        s.peer._pc.ontrack = (receiver, streams, transceiver) => {
            console.log("RTC Received track", transceiver);
        };

        s.peer.on("data", data => {
            console.log("[RTC Data]", data);
        });

        dispatch({
            type: "ws/call",
            fn: "rtcRequestOffer"
        });

    });
}

export const send = async (myVideo=null, myAudio=null) => {
    if (s.peer) {
        await s.peer.getTransceiver(RTCTransceivers.MY_VIDEO).sender.replaceTrack(myVideo);
        await s.peer.getTransceiver(RTCTransceivers.MY_AUDIO).sender.replaceTrack(myAudio);
    }
}

export const signal = (data) => {
    if (s.peer) {
        s.peer.signal(data);
    }
}