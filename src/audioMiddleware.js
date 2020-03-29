import recorder from '!!raw-loader!babel-loader!./recorder.js';
import {addLayer, setTransportTime} from "./actions/audioActions";
import {getAudioBufferRMSImageURL} from "./util";

export default store => next => {

    let context = null;
    let micStream = null;
    let micStreamSourceNode = null;
    let backingTrackAudioBuffer = null;
    let backingTrackRMS = null;

    let transportStartTime = null;
    let backingTrackSourceNode = null;
    let recorderNode = null;
    let layers = [];

    let transportTimeCallbacks = [];
    let nextLayerId = 0;


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
            if (!layer.sourceNode && layer.startTime >= context.currentTime - transportStartTime - 0.001 && layer.startTime < context.currentTime - transportStartTime + LOOKAHEAD) {
                log.info("Scheduling layer", layer);
                layer.sourceNode = context.createBufferSource();
                layer.sourceNode.buffer = layer.buffer;
                layer.sourceNode.connect(context.destination);
                layer.sourceNode.start(transportStartTime + layer.startTime);
            }
        }
    };

    let init = async () => {
        if (context)
            return;

        context = new AudioContext();

        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamSourceNode = context.createMediaStreamSource(micStream);

        recorderNode = await createAudioWorkletNode('recorder', recorder, {
            numberOfOutputs: 0,
            processorOptions: {
                latencySeconds: 0.19,
            }
        });

        recorderNode.port.onmessage = ({data}) => {
            switch(data.type) {
                case "RECORDED_DATA":
                    log.info("FROM RECORDER:", data);
                    store.dispatch(addLayer(data.audioData, data.startTime))
                    break;
                case "LOG":
                    log.info("RECORDER:", ...data.messages);
                    break;
            }
        };

        micStreamSourceNode.connect(recorderNode);

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

    let close = async () => {
        if (context) {
            context.close();
            for (let t of micStream.getTracks()) {
                t.stop();
            }
            context = null;
        }
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
        backingTrackSourceNode.stop();
        backingTrackSourceNode.disconnect();
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
                        dispatch({
                            type: "TOAST",
                            level: "warn",
                            message: "Cannot stop recording - recording not started",
                        });
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
                        id: nextLayerId,
                    });
                    return {
                        duration: audioBuffer.duration,
                        id: nextLayerId++,
                        rms: await getAudioBufferRMSImageURL(audioBuffer, audioBuffer.duration*20),
                    };

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