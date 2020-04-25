import recorderSrc from '!!raw-loader!babel-loader!./recorder.js';
import calibratorSrc from '!!raw-loader!babel-loader!./calibrator.js';

import {recordingFinished, setTransportTime} from "../../actions/audioActions";
import {v4 as uuid} from "uuid";
import {createAudioWorkletNode} from "./util";
import s from "./state";
import {getAudioBufferRMSImageURL} from "../../util";

const SAMPLE_RATE = 44100;

let scheduleUpcomingLayers = () => {
    for (let layer of s.layers) {
        const LOOKAHEAD = 1;
        if (!layer.sourceNode && layer.enabled && layer.startTime >= s.context.currentTime - s.transportStartTime - 0.001 && layer.startTime < s.context.currentTime - s.transportStartTime + LOOKAHEAD) {
            log.info("Scheduling layer", layer);
            layer.sourceNode = s.context.createBufferSource();
            layer.sourceNode.buffer = layer.buffer;
            layer.sourceNode.connect(s.sink);
            layer.sourceNode.start(s.transportStartTime + layer.startTime);
        }
    }
};

export const getDevices = async () => {
    let m = await navigator.mediaDevices.getUserMedia({audio: true});
    for (let t of m.getAudioTracks()) {
        t.stop();
    }

    let inputDevices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput');
    let outputDevices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audiooutput');

    let defaultInputLabel = inputDevices.find(d => d.deviceId === 'default').label;
    let defaultOutputLabel = outputDevices.find(d => d.deviceId === 'default').label;

    let mapDeviceToUsefulObject = device => ({
        id: device.deviceId,
        name: device.label || device.deviceId.substring(0, 6),
    });

    let inputs = inputDevices.filter(d => d.deviceId !== 'default' && d.deviceId !== 'communications').map(mapDeviceToUsefulObject).map(o => {
        o.default = defaultInputLabel.indexOf(o.name) > -1;
        return o;
    });
    let outputs = outputDevices.filter(d => d.deviceId !== 'default' && d.deviceId !== 'communications').map(mapDeviceToUsefulObject).map(o => {
        o.default = defaultOutputLabel.indexOf(o.name) > -1;
        return o;
    });

    let selectedInput = inputs.find(i => i.default);
    let selectedOutput = outputs.find(o => o.default);
    try {
        selectedInput = inputs.find(i => i.id === localStorage['selectedInputId']) || selectedInput;
    } catch (e) {
    }
    try {
        selectedOutput = outputs.find(o => o.id === localStorage['selectedOutputId']) || selectedOutput;
    } catch (e) {
    }

    return {
        inputs,
        outputs,
        selectedInput,
        selectedOutput,
    };
}

export const close = async () => {
    if (s.context) {
        s.context.close();
        for (let t of s.micStream?.getTracks() || []) {
            t.stop();
        }
        s.context = null;
        s.micStream = null;
        s.micStreamSourceNode = null;
        s.backingTrackAudioBuffer = null;

        s.transportStartTime = null;
        s.backingTrackSourceNode = null;
        s.recorderNode = null;
        s.layers = [];
    }
};

const storeLatency = (inputId, outputId, latency) => {
    let latencies = {};
    try {
        latencies = JSON.parse(localStorage['latency']);
    } catch (e) { }
    latencies[`${inputId}:${outputId}`] = latency;
    try {
        localStorage['latency'] = JSON.stringify(latencies);
    } catch (e) { }
}
const getLatency = (inputId, outputId) => {
    let latencies = {};
    try {
        latencies = JSON.parse(localStorage['latency'])
    } catch (e) { }

    let key = `${inputId}:${outputId}`;
    if (key in latencies) {
        log.info(`Loaded latency calibration of ${Math.round(latencies[key]*1000)} ms.`);
        return latencies[key];
    } else {
        log.info(`Using default latency of 250 ms.`);
        return 0.25;
    }
}


export const init = async (inputId, outputId, dispatch) => {

    if (s.context) {
        return;
    }

    s.context = new AudioContext({sampleRate: SAMPLE_RATE, latencyHint: "playback"});
    s.sink = s.context.createMediaStreamDestination();
    if (s.context.sampleRate !== SAMPLE_RATE) {
        throw new Error("Could not initialise audio context with correct sample rate.");
    }

    s.audio = new Audio();
    await s.audio.setSinkId(outputId);

    s.audio.srcObject = s.sink.stream;
    s.audio.play();

    s.micStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: inputId }}});
    s.micStreamSourceNode = s.context.createMediaStreamSource(s.micStream);

    try {
        localStorage['selectedInputId'] = inputId;
        localStorage['selectedOutputId'] = outputId;
    } catch (e) { }

    let latencySeconds = getLatency(inputId, outputId);

    s.recorderNode = await createAudioWorkletNode(s.context, 'recorder', recorderSrc, {
        numberOfOutputs: 0,
        processorOptions: {
            latencySeconds,
        }
    });

    s.recorderNode.port.onmessage = ({data}) => {
        switch(data.type) {
            case "RECORDED_DATA":
                log.info("FROM RECORDER:", data);
                dispatch(recordingFinished(uuid(), data.audioData, data.startTime))
                break;
            case "LOG":
                log.info("RECORDER:", ...data.messages);
                break;
        }
    };

    s.calibratorNode = await createAudioWorkletNode(s.context, 'calibrator', calibratorSrc, {
        numberOfOutputs: 1,
        processorOptions: {
            tickPeriod: 1.5,
        }
    });

    s.calibratorNode.port.onmessage = ({data}) => {
        switch(data.type) {
            case "QUIET_CALIBRATION_START":
                dispatch({
                    type: "CALIBRATION",
                    calibrationType: 'quiet',
                });
                break;
            case "QUIET_CALIBRATION_END":
                dispatch({
                    type: "CALIBRATION",
                    calibrationType: 'latency',
                });
                break;

            case "SAMPLE":
                dispatch({
                    type: "CALIBRATION",
                    sample: data.sample,
                });
                break;

            case "CALIBRATION":
                log.info(`Got latency calibration: ${data.latency.toPrecision(3)} seconds`)
                storeLatency(inputId, outputId, data.latency);
                s.recorderNode.call("setLatency", data.latency);
                dispatch({
                    type: "CALIBRATION",
                    calibration: data,
                    calibrationType: null,
                });
                s.calibratorNode.parameters.get("enabled").value = 0;

                break;
            case "LOG":
                log.info("CALIBRATOR:", ...data.messages);
                break;
        }
    };

    let tickWav = await(await fetch("/hi-clave.wav")).arrayBuffer();
    let tockWav = await(await fetch("/lo-clave.wav")).arrayBuffer();
    let tickAudioBuffer = await s.context.decodeAudioData(tickWav);
    let tockAudioBuffer = await s.context.decodeAudioData(tockWav);

    s.calibratorNode.call("setTickBuffers", tickAudioBuffer.getChannelData(0), tockAudioBuffer.getChannelData(0), 0.01, 0.01);

    s.micStreamSourceNode.connect(s.recorderNode);
    s.micStreamSourceNode.connect(s.calibratorNode);

    s.calibratorNode.connect(s.sink);

    requestAnimationFrame(function onAnimationFrame() {

        if (!s.context)
            return;

        if (s.transportStartTime !== null) {
            // We are playing.
            let offsetTime = s.context.currentTime - s.transportStartTime;

            if (s.transportStartTime + s.backingTrackAudioBuffer.duration < s.context.currentTime) {
                // We've reached the end of the backing track. Stop playing.
                s.transportStartTime = null;
                s.backingTrackSourceNode.disconnect();
                s.backingTrackSourceNode = null;
            } else {
                // We're still playing. Schedule any layers that are coming up.
                scheduleUpcomingLayers();

                if (offsetTime > 0) {
                    for (let c of s.transportTimeCallbacks) {
                        c(offsetTime);
                    }
                    dispatch({
                        type: "SET_TRANSPORT_TIME",
                        time: offsetTime || 0,
                        _log: false
                    });
                }
            }
        }

        setTimeout(() => requestAnimationFrame(onAnimationFrame), 16);
    });
};

export const loadBackingTrack = async (url) => {
    let buffer = await (await fetch(url)).arrayBuffer();
    s.backingTrackAudioBuffer = await s.context.decodeAudioData(buffer);

    return {
        duration: s.backingTrackAudioBuffer.duration,
        rms: await getAudioBufferRMSImageURL(s.backingTrackAudioBuffer, s.backingTrackAudioBuffer.duration * 20),
    };
};

export const play = startTime => {
    s.backingTrackSourceNode = s.context.createBufferSource();
    s.backingTrackSourceNode.buffer = s.backingTrackAudioBuffer;
    s.backingTrackSourceNode.connect(s.sink);

    let preloadTime = 0.05;
    s.transportStartTime = s.context.currentTime + preloadTime - startTime;
    s.recorderNode.call("setStartTimeOffset", s.transportStartTime);
    s.backingTrackSourceNode.start(s.context.currentTime + preloadTime, startTime);
    scheduleUpcomingLayers();

    return true; // N.B. If there's some reason we couldn't start playback, could return false instead.
};

export const stop = () => {
    stopRecord();
    for (let layer of s.layers) {
        if (layer.sourceNode) {
            layer.sourceNode.disconnect();
            layer.sourceNode = null;
        }
    }
    if (s.backingTrackSourceNode) {
        s.backingTrackSourceNode.stop();
        s.backingTrackSourceNode.disconnect();
    }
    s.transportStartTime = null;

    return true; // Could return false if for some reason we couldn't stop.
};

export const seek = time => {
    if (s.transportStartTime === null) {
        return true; // We're not playing. Sure, go ahead and seek.
    }
    if (s.recorderNode.parameters.get("recording").value === 0) {
        // We are playing, and not recording.
        stop();
        play(time);
        return true; // Seek succeeded.
    }

    return false; // Seek failed.
};

export const record = () => {
    s.recorderNode.parameters.get("recording").value = 1;
    return true;
};

export const stopRecord = () => {
    s.recorderNode.parameters.get("recording").value = 0;
    return true;
};

export const addLayer = async (layerId, startTime, enabled=false, audioData=null) => {
    audioData = audioData || new Float32Array(await (await fetch(`/.layers/${layerId}.raw`)).arrayBuffer());

    let audioBuffer = s.context.createBuffer(1, audioData.length, s.context.sampleRate);
    audioBuffer.copyToChannel(audioData, 0, 0);
    s.layers.push({
        buffer: audioBuffer,
        startTime: startTime,
        layerId,
        enabled: enabled,
    });
    return {
        duration: audioBuffer.duration,
        layerId,
        rms: await getAudioBufferRMSImageURL(audioBuffer, audioBuffer.duration * 20),
    };

}