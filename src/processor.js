
class Processor extends AudioWorkletProcessor {

    constructor({processorOptions: {loopLengthSeconds, latencySeconds}}) {
        super();

        this.buffer = new Float32Array(loopLengthSeconds * sampleRate);
        this.sampleTime = 0;
        this.latencySamples = latencySeconds * sampleRate;
    }

    process (inputs, outputs, parameters) {

        let outputChannels = outputs[0];
        let inputData = inputs[0][0]; // Input 0, channel 0

            for (let i = 0; i < inputData.length; i++) {
                for (let outputChannelData of outputChannels) {
                    outputChannelData[i] = this.buffer[(this.sampleTime + i) % this.buffer.length];
                }

                this.buffer[(this.sampleTime + i - this.latencySamples + this.buffer.length) % this.buffer.length] += inputData[i];
            }
            this.sampleTime += 128;


        return true;
    }
}

registerProcessor('processor', Processor);
