import recorder from '!!raw-loader!babel-loader!./recorder.js';
import calibrator from '!!raw-loader!babel-loader!./calibrator.js';
import {recordingFinished, setTransportTime, stopCalibration} from "./actions/audioActions";
import {getAudioBufferRMSImageURL} from "./util";
import { v4 as uuid } from 'uuid';

export default store => next => {

    let context = null;
    let micStream = null;
    let micStreamSourceNode = null;
    let backingTrackAudioBuffer = null;
    let backingTrackRMS = null;

    let transportStartTime = null;
    let backingTrackSourceNode = null;
    let recorderNode = null;
    let calibratorNode = null;
    let layers = [];

    let transportTimeCallbacks = [];
    const SAMPLE_RATE = 44100;


    const createAudioWorkletNode = async (name, sourceCode, options) => {
        let blob = new Blob([sourceCode], { type: 'application/javascript' });
        let objectURL = URL.createObjectURL(blob);

        await context.audioWorklet.addModule(objectURL);

        let node = new AudioWorkletNode(context, name, options);
        node.call = (fn, ...args) => {
            node.port.postMessage({fn, args});
        };
        node.onprocessorerror = err => {
            log.error("Worklet error:", err);
        };
        return node;
    };

    let scheduleUpcomingLayers = () => {
        for (let layer of layers) {
            const LOOKAHEAD = 1;
            if (!layer.sourceNode && layer.enabled && layer.startTime >= context.currentTime - transportStartTime - 0.001 && layer.startTime < context.currentTime - transportStartTime + LOOKAHEAD) {
                log.info("Scheduling layer", layer);
                layer.sourceNode = context.createBufferSource();
                layer.sourceNode.buffer = layer.buffer;
                layer.sourceNode.connect(context.destination);
                layer.sourceNode.start(transportStartTime + layer.startTime);
            }
        }
    };

    let close = async () => {
        if (context) {
            context.close();
            for (let t of micStream.getTracks()) {
                t.stop();
            }
            context = null;
        }
    };

    let init = async () => {
        await close();

        context = new AudioContext({sampleRate: SAMPLE_RATE});
        if (context.sampleRate !== SAMPLE_RATE) {
            throw new Error("Could not initialise audio context with correct sample rate.");
        }

        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamSourceNode = context.createMediaStreamSource(micStream);

        let latencySeconds = 0.19;
        try {
            latencySeconds = parseFloat(localStorage['latencySeconds']);
            log.info(`Loaded latency calibration of ${Math.round(latencySeconds*1000)} ms.`)
        } catch (e) {}

        recorderNode = await createAudioWorkletNode('recorder', recorder, {
            numberOfOutputs: 0,
            processorOptions: {
                latencySeconds,
            }
        });

        recorderNode.port.onmessage = ({data}) => {
            switch(data.type) {
                case "RECORDED_DATA":
                    log.info("FROM RECORDER:", data);
                    store.dispatch(recordingFinished(uuid(), data.audioData, data.startTime))
                    break;
                case "LOG":
                    log.info("RECORDER:", ...data.messages);
                    break;
            }
        };

        calibratorNode = await createAudioWorkletNode('calibrator', calibrator, {
            numberOfOutputs: 1,
            processorOptions: {
                tickPeriod: 1.5,
            }
        });

        calibratorNode.port.onmessage = ({data}) => {
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
                case "CALIBRATION":
                    log.info(`Got latency calibration: ${data.latency.toPrecision(3)} seconds`)
                    try {
                        localStorage['latencySeconds'] = data.latency;
                    } catch (e) {log.info("Could not save calibration data to local storage")}
                    recorderNode.call("setLatency", data.latency);
                    dispatch({
                        type: "CALIBRATION",
                        calibration: data,
                        calibrationType: null,
                    });
                    calibratorNode.parameters.get("enabled").value = 0;

                    break;
                case "LOG":
                    log.info("CALIBRATOR:", ...data.messages);
                    break;
            }
        };

        let tickWav = await(await fetch("/hi-clave.wav")).arrayBuffer();
        let tockWav = await(await fetch("/lo-clave.wav")).arrayBuffer();
        let tickAudioBuffer = await context.decodeAudioData(tickWav);
        let tockAudioBuffer = await context.decodeAudioData(tockWav);

        calibratorNode.call("setTickBuffers", tickAudioBuffer.getChannelData(0), tockAudioBuffer.getChannelData(0), 0.01, 0.01);

        micStreamSourceNode.connect(recorderNode);
        micStreamSourceNode.connect(calibratorNode);
        calibratorNode.connect(context.destination);

        requestAnimationFrame(function onAnimationFrame() {

            if (!context)
                return;

            if (transportStartTime !== null) {
                // We are playing.
                let offsetTime = context.currentTime - transportStartTime;

                if (transportStartTime + backingTrackAudioBuffer.duration < context.currentTime) {
                    // We've reached the end of the backing track. Stop playing.
                    transportStartTime = null;
                    backingTrackSourceNode.disconnect();
                    backingTrackSourceNode = null;
                } else {
                    // We're still playing. Schedule any layers that are coming up.
                    scheduleUpcomingLayers();

                    if (offsetTime > 0) {
                        for (let c of transportTimeCallbacks) {
                            c(offsetTime);
                        }
                        store.dispatch(setTransportTime(offsetTime));
                    }
                }
            }

            requestAnimationFrame(onAnimationFrame);
        });
    };

    let play = startTime => {
        backingTrackSourceNode = context.createBufferSource();
        backingTrackSourceNode.buffer = backingTrackAudioBuffer;
        backingTrackSourceNode.connect(context.destination);

        transportStartTime = context.currentTime - startTime;
        recorderNode.call("setStartTimeOffset", transportStartTime);
        backingTrackSourceNode.start(transportStartTime, startTime);
        scheduleUpcomingLayers();
    };

    let stop = () => {
        stopRecord();
        for (let layer of layers) {
            if (layer.sourceNode) {
                layer.sourceNode.disconnect();
                layer.sourceNode = null;
            }
        }
        if (backingTrackSourceNode) {
            backingTrackSourceNode.stop();
            backingTrackSourceNode.disconnect();
        }
        transportStartTime = null;
    };

    let record = () => {
        recorderNode.parameters.get("recording").value = 1;
    };

    let stopRecord = () => {
        recorderNode.parameters.get("recording").value = 0;
    };

    return async action => {

        if (action.type.startsWith("audio/")) {
            switch (action.type.substr(6)) {

                case "initDevices":
                    let m = await navigator.mediaDevices.getUserMedia({ audio: true });

                    let mapDeviceToUsefulObject = device => ({
                        id: device.deviceId,
                        name: device.label || device.deviceId.substring(0,6),
                    });
                    let inputs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput').map(mapDeviceToUsefulObject);
                    let outputs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audiooutput').map(mapDeviceToUsefulObject);

                    dispatch({
                        type: "INIT_AUDIO_DEVICES",
                        inputs,
                        outputs,
                    });

                    for (let t of m.getAudioTracks()) {
                        t.stop();
                    }
                    return;

                case "init":
                    return await init();

                case "close":
                    await close();
                    micStream = null;
                    micStreamSourceNode = null;
                    backingTrackAudioBuffer = null;

                    transportStartTime = null;
                    backingTrackSourceNode = null;
                    recorderNode = null;
                    layers = [];

                    break;

                case "startCalibration":
                    await init();
                    calibratorNode.parameters.get("enabled").value = 1;
                    break;

                case "stopCalibration":
                    await init();
                    calibratorNode.parameters.get("enabled").value = 0;
                    break;

                case "loadBackingTrack":
                    backingTrackAudioBuffer = await context.decodeAudioData(action.arrayBuffer);

                    return {
                        duration: backingTrackAudioBuffer.duration,
                        rms: await getAudioBufferRMSImageURL(backingTrackAudioBuffer, backingTrackAudioBuffer.duration * 20),
                    };

                case "play":
                    if (!backingTrackAudioBuffer) {
                        throw "Cannot start playback before loading backing track";
                    }
                    await init();

                    for (let layer of layers) {
                        if (layer.sourceNode) {
                            layer.sourceNode.disconnect();
                        }
                        layer.sourceNode = null;
                    }
                    play(action.startTime || 0);


                    return true;
                case "stop":
                    if (!context)
                        return;

                    stop();

                    break;

                case "startRecording":
                    if (transportStartTime === null) {
                        dispatch({
                            type: "TOAST",
                            level: "warn",
                            message: "Cannot start recording unless backing track is playing",
                        });
                        return false;
                    }
                    await record();
                    return true;

                case "stopRecording":
                    if (recorderNode.parameters.get("recording").value !== 1) {
                        // dispatch({
                        //     type: "TOAST",
                        //     level: "warn",
                        //     message: "Cannot stop recording - recording not started",
                        // });
                        return false;
                    }
                    await stopRecord();
                    return true;

                case "addLayer":
                    let audioBuffer = context.createBuffer(1, action.audioData.length, context.sampleRate);
                    audioBuffer.copyToChannel(action.audioData,0,0);
                    layers.push({
                        buffer: audioBuffer,
                        startTime: action.startTime,
                        id: action.id,
                        enabled: action.enabled,
                    });
                    return {
                        duration: audioBuffer.duration,
                        id: action.id,
                        rms: await getAudioBufferRMSImageURL(audioBuffer, audioBuffer.duration*20),
                    };

                case "toggleLayer": {
                    let layer = layers.find(({id}) => id === action.id);
                    if (layer) {
                        layer.enabled = action.enabled;
                        return true;
                    } else {
                        return false;
                    }
                }

                case "deleteLayer":
                    layers = layers.filter(layer => layer.id !== action.id);
                    return true;

                case "addTransportTimeCallback":
                    if (transportTimeCallbacks.indexOf(action.callback) === -1) {
                        transportTimeCallbacks.push(action.callback);
                    }
                    return () => {
                        transportTimeCallbacks = transportTimeCallbacks.filter(c => c !== action.callback);
                    };

                case "removeTransportTimeCallback":
                    transportTimeCallbacks = transportTimeCallbacks.filter(c => c !== action.callback);
                    return true;
            }
        } else {
            return next(action);
        }
    };
};




/*
        let clickBuffer = context.createBuffer(1, 4 * context.sampleRate, context.sampleRate);
        let clickBufferData = clickBuffer.getChannelData(0);

        let clickPeriodSeconds = 0.4;
        let clickDurationSeconds = 0.005;
        for (let i = 0; i < clickBufferData.length; i++) {
            if (i % (clickPeriodSeconds * context.sampleRate) < clickDurationSeconds * context.sampleRate) {
                clickBufferData[i] = Math.random() * 0.2 - 0.1;
            }
        }


        let blob = new Blob([processor], { type: 'application/javascript' });
        let objectURL = URL.createObjectURL(blob);

        await context.audioWorklet.addModule(objectURL);

        let processorNode = new AudioWorkletNode(context, 'processor', { processorOptions: {
            loopLengthSeconds: 4,
            latencySeconds: 0.17,
        }});
        micStreamSourceNode.connect(processorNode);
        processorNode.connect(context.destination);

        let clickSourceNode = context.createBufferSource();
        clickSourceNode.buffer = clickBuffer;
        clickSourceNode.connect(context.destination);

        let startTime = context.currentTime;
        clickSourceNode.start(startTime);

        let nextNode = context.createBufferSource();
        nextNode.buffer = clickBuffer;
        nextNode.connect(context.destination);
        nextNode.start(startTime+4);

       // micStreamSourceNode.connect(context.destination);

 */