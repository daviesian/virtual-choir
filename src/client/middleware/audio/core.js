import recorderSrc from '!!raw-loader!babel-loader!./recorder.js';
import calibratorSrc from '!!raw-loader!babel-loader!./calibrator.js';
import noiseGeneratorSrc from '!!raw-loader!babel-loader!./noiseGenerator.js';
import drifterSrc from '!!raw-loader!babel-loader!./drifter.js';

import {recordingFinished, setTransportTime, startRecording, stopRecording} from "../../actions/audioActions";
import {v4 as uuid} from "uuid";
import {createAudioWorkletNode} from "./util";
import s from "./state";
import {getAudioBufferRMSImageURL} from "../../util";

window.audioState = s;

const SAMPLE_RATE = 44100;

let scheduleUpcomingItems = () => {
    for (let [itemId, item] of Object.entries(s.items)) {
        const LOOKAHEAD = 1;
        if (!item.sourceNode && item.laneId in s.enabledLanes && (item.startTime+item.audioBuffer.duration) >= s.context.currentTime - s.transportStartTime - 0.001 && item.startTime < s.context.currentTime - s.transportStartTime + LOOKAHEAD) {
            log.info("Scheduling item", item);

            let shouldStartAt = s.transportStartTime + item.startTime;
            let actualStartAt = Math.max(s.context.currentTime + 0.01, shouldStartAt);

            item.sourceNode = s.context.createBufferSource();
            item.sourceNode.buffer = item.audioBuffer;
            item.sourceNode.connect(s.recorderNode);
            item.sourceNode.start(actualStartAt, Math.max(0, actualStartAt - shouldStartAt));
        }
    }
};

const maybePunchInOrOut = () => {
    if (s.punchIn !== null && s.punchOut !== null) {
        let recording = s.recorderNode.parameters.get("recording").value === 1;
        let transportTime = s.context.currentTime - s.transportStartTime;

        if (!recording && transportTime > s.punchIn && transportTime < s.punchOut) {
            s.dispatch(startRecording(true, undefined)); // TODO: We need a way of optionally not forcing everyone to record.
        } else if (recording && (transportTime < s.punchIn || transportTime > s.punchOut)) {
            s.dispatch(stopRecording(true, undefined)); // TODO: Ditto
        }
    }
}

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
        for (let t of s.inputStream?.getTracks() || []) {
            t.stop();
        }
        s.context = null;
        s.inputStream = null;
        //s.inputStreamSourceNode = null;
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

    s.dispatch = dispatch;

    //s.audioOut = new Audio();
    //await s.audioOut.setSinkId(outputId);
    s.context = new AudioContext({sampleRate: SAMPLE_RATE, latencyHint: "playback"});
    s.sink = s.context.destination; //s.context.createMediaStreamDestination();
    //s.audioOut.srcObject = s.sink.stream;
    //await s.audioOut.play();
    if (s.context.sampleRate !== SAMPLE_RATE) {
        throw new Error("Could not initialise audio context with correct sample rate.");
    }

    s.inputStream = await navigator.mediaDevices.getUserMedia({
        audio: {
            deviceId: { exact: inputId },
            echoCancellation: { exact: false },
            noiseSuppression: { exact: false },
            autoGainControl: { exact: false },
        },
        video: true,
    });
    s.inputStreamSourceNode = s.context.createMediaStreamSource(s.inputStream);

    s.mediaRecorder = new MediaRecorder(s.inputStream);

    s.mediaRecorder.onstart = () => {
        s.recordedVideo = {
            chunks: [],
            done: false,
        };
        s.recordedAudio = null;
    };

    s.mediaRecorder.ondataavailable = ({data}) => {
        s.recordedVideo.chunks.push(data);
    }

    let maybeFinishRecording = () => {
        if (s.recordedVideo?.done && s.recordedAudio) {
            dispatch(recordingFinished(uuid(), s.recordedVideo.chunks, s.recordedAudio.audioData, s.recordedAudio.startTime));
        }
    };

    s.mediaRecorder.onstop = () => {
        s.recordedVideo.done = true;
        maybeFinishRecording();
    }



    try {
        localStorage['selectedInputId'] = inputId;
        localStorage['selectedOutputId'] = outputId;
    } catch (e) { }

    let latencySeconds = 0;//getLatency(inputId, outputId);

    s.recorderNode = await createAudioWorkletNode(s.context, 'recorder', recorderSrc, {
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: {
            latencySeconds,
        }
    });

    s.recorderNode.port.onmessage = ({data}) => {
        switch(data.type) {
            case "RECORDED_DATA":
                log.info("FROM RECORDER:", data);
                s.recordedAudio = data;
                maybeFinishRecording();
                break;
            case "LOG":
                log.info("RECORDER:", ...data.messages);
                break;
        }
    };

    s.recorderNode.connect(s.sink);

    var oscillatorNode = s.context.createOscillator();
    oscillatorNode.connect(s.recorderNode); // To make it run continuously. Ugh.

    s.noiseVolume = 0.1;
    s.noiseGeneratorNode = await createAudioWorkletNode(s.context, 'NoiseGenerator', noiseGeneratorSrc, {
        numberOfOutputs: 1,
        numberOfInputs: 0,
    });
    s.noiseGeneratorNode.connect(s.recorderNode);


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

    s.inputStreamSourceNode.connect(s.calibratorNode);

    s.calibratorNode.connect(s.sink);

    // TODO: This doesn't schedule layers if the tab isn't focused.

    requestAnimationFrame(function onAnimationFrame() {

        if (!s.context)
            return;

        if (s.transportStartTime !== null) {
            // We are playing.
            let offsetTime = s.context.currentTime - s.transportStartTime;

            // We're still playing. Schedule any layers that are coming up.
            scheduleUpcomingItems();

            maybePunchInOrOut();

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

        setTimeout(() => requestAnimationFrame(onAnimationFrame), 16);
    });
};

export const loadItem = async ({itemId, laneId, startTime, startOffset, endOffset, audioUrl, videoUrl}) => {

    let arrayBuffer = await (await fetch(audioUrl || videoUrl)).arrayBuffer();

    let audioBuffer = null;
    if (audioUrl?.endsWith(".aud")) {
        let audioData = new Float32Array(arrayBuffer);
        audioBuffer = s.context.createBuffer(1, audioData.length, s.context.sampleRate);
        audioBuffer.copyToChannel(audioData, 0, 0);
    } else {
        audioBuffer = await s.context.decodeAudioData(arrayBuffer);
    }

    s.items[itemId] = {
        itemId,
        startTime,
        startOffset,
        endOffset,
        audioBuffer,
        laneId,
    };

    return {
        duration: audioBuffer.duration,
        rms: await getAudioBufferRMSImageURL(audioBuffer, audioBuffer.duration * 40),
    };
};

export const updateItem = async ({itemId, laneId}) => {
    s.items[itemId].laneId = laneId;
};

export const play = startTime => {
    let preloadTime = 0.05;
    s.transportStartTime = s.context.currentTime + preloadTime - startTime;
    s.recorderNode.call("setStartTimeOffset", s.transportStartTime);
    scheduleUpcomingItems();

    return true; // N.B. If there's some reason we couldn't start playback, could return false instead.
};

export const stop = () => {
    stopRecord();
    for (let [itemId, item] of Object.entries(s.items)) {
        if (item.sourceNode) {
            item.sourceNode.disconnect();
            item.sourceNode = null;
        }
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

export const record = async() => {
    let noiseVol = s.noiseGeneratorNode.parameters.get("volume");
    noiseVol.cancelScheduledValues(s.context.currentTime);
    noiseVol.linearRampToValueAtTime(s.noiseVolume, s.context.currentTime + 1);
    s.noiseGeneratorNode.connect(s.recorderNode);
    s.recorderNode.parameters.get("recording").value = 1;
    s.mediaRecorder.start(10000);
    return true;
};

export const stopRecord = () => {
    let noiseVol = s.noiseGeneratorNode.parameters.get("volume");
    noiseVol.cancelScheduledValues(s.context.currentTime);
    noiseVol.value = 0;
    s.recorderNode.parameters.get("recording").value = 0;
    if (s.mediaRecorder.state === "recording") {
        s.mediaRecorder.stop();
    }
    return true;
};

export const enableLane = (laneId) => {
    s.enabledLanes[laneId] = true;
};

export const disableLane = (laneId) => {
    // TODO: Stop and playing items in disabled lane.
    for (let item of Object.values(s.items)) {
        if (item.laneId === laneId && item.sourceNode) {
            item.sourceNode.disconnect();
            item.sourceNode = null;
        }
    }
    delete s.enabledLanes[laneId];
};

export const setPunchTimes = (punchIn, punchOut) => {
    if (punchIn !== null && punchOut !== null && punchIn < punchOut) {
        s.punchIn = punchIn;
        s.punchOut = punchOut;
    } else {
        s.punchIn = s.punchOut = null;
    }
}