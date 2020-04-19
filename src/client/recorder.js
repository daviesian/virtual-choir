let out = (outputs, sampleIndex, val) => {
    let outputChannels = outputs[0];
    for (let outputChannelData of outputChannels) {
        outputChannelData[sampleIndex] = val;
    }
};


class Recorder extends AudioWorkletProcessor {

    constructor({processorOptions: {latencySeconds}}) {
        super();

        this.buffers = [];
        this.recordingStartTime = null;

        this.startTimeOffset = 0;

        this.setLatency(latencySeconds);
        this.remainingLatencyBuffersToCapture = null;

        this.port.onmessage = ({data}) => {
            this[data.fn].apply(this, data.args);
        };

        this.log = (...messages)=> this.port.postMessage({type: "LOG", messages});
    }

    static get parameterDescriptors () {
        return [{
            name: 'recording',
            defaultValue: 0,
            minValue: 0,
            maxValue: 1,
            automationRate: 'k-rate'
        }];
    };

    setStartTimeOffset(offset) {
        this.startTimeOffset = offset;
    }

    setLatency(seconds) {
        this.latencyBufferCount = Math.round(seconds * sampleRate / 128);
    }

    process (inputs, outputs, {recording: [recording]}) {

        if (this.recordingStartTime !== null && recording === 0 && this.remainingLatencyBuffersToCapture === null) {
            // We have just stopped recording.
            this.remainingLatencyBuffersToCapture = this.latencyBufferCount;
        } else if (this.recordingStartTime !== null && recording === 0 && this.remainingLatencyBuffersToCapture === 0) {
            this.remainingLatencyBuffersToCapture = null;
            let buffer = new Float32Array(this.buffers.length * 128);
            for (let i = this.latencyBufferCount; i < this.buffers.length; i++) {
                buffer.set(this.buffers[i], (i - this.latencyBufferCount) * 128);
            }
            this.port.postMessage({
                type: "RECORDED_DATA",
                audioData: buffer,
                startTime: this.recordingStartTime - this.startTimeOffset,
            });
            this.buffers = [];
            this.recordingStartTime = null;
        } else if (this.recordingStartTime === null && recording === 1) {
            // We have just started recording.
            this.recordingStartTime = currentTime;
        }

        if (this.recordingStartTime !== null) {
            // We are recording.
            let inputData = inputs[0][0]; // Input 0, channel 0
            this.buffers.push(inputData);
            if (this.remainingLatencyBuffersToCapture !== null) {
                this.remainingLatencyBuffersToCapture--;
            }
        }

        return true;
    }
}

registerProcessor('recorder', Recorder);
