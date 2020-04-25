let out = (outputs, sampleIndex, val) => {
    let outputChannels = outputs[0];
    for (let outputChannelData of outputChannels) {
        outputChannelData[sampleIndex] = val;
    }
};

class Calibrator extends AudioWorkletProcessor {

    constructor({ processorOptions: { initialQuietPeriod=1, tickPeriod=1 , maxSD=0.03, minSamples=3} }) {
        super();

        this.tickBuffer = new Float32Array(tickPeriod * sampleRate);
        this.tickPeakOffset = 0;
        this.initialQuietPeriodFrames = initialQuietPeriod * sampleRate;

        this.startFrame = null;
        this.volumeBuffers = [];
        this.initialQuiet = null;
        this.lastClappedTickFrame = 0;

        this.maxSD = maxSD;
        this.minSamples = minSamples;

        this.samples = [];

        this.port.onmessage = ({data}) => {
            this[data.fn].apply(this, data.args);
        };

        this.log = (...messages) => this.port.postMessage({type: "LOG", messages});
    }

    static get parameterDescriptors () {
        return [{
            name: 'enabled',
            defaultValue: 0,
            minValue: 0,
            maxValue: 1,
            automationRate: 'k-rate'
        }];
    };

    setTickBuffers(tick, tock, tickPeakTime, tockPeakTime) {
        let tickPeakSample = tickPeakTime * sampleRate;
        let tockPeakSample = tockPeakTime * sampleRate;

        this.tickBuffer.fill(0);
        this.tickPeakOffset = tickPeakSample;
        for(let i = 0; i < tick.length; i++) {
            this.tickBuffer[((i)+this.tickBuffer.length) % this.tickBuffer.length] += tick[i];
        }

        for(let i = 0; i < tock.length; i++) {
            for (let beat = 1; beat < 4; beat++) {
                this.tickBuffer[(((i + Math.floor(beat*this.tickBuffer.length/4))-tockPeakSample+tickPeakSample)+this.tickBuffer.length) % this.tickBuffer.length] += tock[i]/4;
            }
        }
    }

    maybeEmitCalibration() {
        if (this.samples.length < 1) {
            return;
        }

        let ALLOWED_LATENCY_SAMPLE_RANGE = 0.05;

        let sortedSamples = this.samples.slice();
        sortedSamples.sort();

        let longestSeqStartIdx=0, longestSeqLength=0;
        for (let i = 0; i < sortedSamples.length; i++) {

            let closeSeqLength = 0;
            while(i + closeSeqLength < sortedSamples.length && sortedSamples[i+closeSeqLength] < sortedSamples[i] + ALLOWED_LATENCY_SAMPLE_RANGE)
                closeSeqLength++;
            if (closeSeqLength > longestSeqLength) {
                longestSeqLength = closeSeqLength;
                longestSeqStartIdx = i;
            }
        }

        let closeSamples = sortedSamples.slice(longestSeqStartIdx, longestSeqLength);

        let mean = 0;
        for (let s of closeSamples) {
            mean += s;
        }
        mean /= closeSamples.length;

        let sd = 0;
        for (let s of closeSamples) {
            sd += Math.abs(s - mean);
        }
        sd /= closeSamples.length;

        this.log(`Calibration of ${Math.round(mean*1000)} ms has SD of ${Math.round(sd*1000)} ms with ${closeSamples.length} samples.`)

        this.port.postMessage({
            type: "SAMPLE",
            sample: {
                latency: this.samples[closeSamples.length - 1],
                sd,
                mean,
            },
        });

        if (sd < this.maxSD && closeSamples.length >= this.minSamples) {
            this.port.postMessage({
                type: "CALIBRATION",
                latency: mean,
                sd,
                samples: closeSamples.length,
            });
        }
    }

    process (inputs, outputs, { enabled: [ enabled ]}) {

        if (enabled && this.startFrame === null) {
            this.port.postMessage({
                type: "QUIET_CALIBRATION_START",
            });
            this.initialQuiet = null;
            this.lastClappedTickFrame = 0;
            this.volumeBuffers.length = 0;
            this.startFrame = currentFrame + this.initialQuietPeriodFrames;
            this.samples = [];
        } else if (!enabled && this.startFrame !== null) {
            this.startFrame = null;
            // Do something at the end? Probably not.
        }

        if (enabled) {
            let inputData = inputs[0][0]; // Input 0, channel 0
            // Capture some stuff.
            // Process the captured stuff.
            let WINDOW=32;
            let volumes = new Float32Array(128 / WINDOW);
            for (let i = 0; i < volumes.length; i++) {
                for (let j = i * WINDOW; j < (i+1) * WINDOW; j++) {
                    volumes[i] += inputData[j]*inputData[j];
                }
                volumes[i] = Math.sqrt(volumes[i] / WINDOW);
            }
            this.volumeBuffers.push(volumes);

            if (!this.initialQuiet && currentFrame > this.startFrame) {
                let mean = 0;
                let count = 0;
                let max = 0;
                for (let vols of this.volumeBuffers) {
                    for (let v of vols) {
                        mean += v;
                        count++;
                        max = Math.max(max, v);
                    }
                }
                mean /= count;
                let sd = 0;
                for (let vols of this.volumeBuffers) {
                    for (let v of vols) {
                        sd += Math.abs(v - mean);
                    }
                }
                sd /= count;

                this.initialQuiet = {mean, max, sd};
                this.log(`Initial quiet: ${mean.toPrecision(3)} (Max ${max.toPrecision(3)}, SD ${sd.toPrecision(3)})`);
                this.port.postMessage({
                    type: "QUIET_CALIBRATION_END",
                    mean,
                    max,
                    sd,
                });

            }

            if (this.initialQuiet && currentFrame > this.startFrame) {
                for (let v of volumes) {
                    if (v > this.initialQuiet.mean + this.initialQuiet.sd * 20) {
                        let previousTickFrame = this.startFrame + this.tickPeakOffset + Math.floor((currentFrame - (this.startFrame + this.tickPeakOffset)) / this.tickBuffer.length) * this.tickBuffer.length;
                        if (previousTickFrame > this.lastClappedTickFrame) {
                            this.lastClappedTickFrame = previousTickFrame;
                            let latency = (currentFrame - previousTickFrame) / sampleRate;
                            if (latency > 0.01 && latency < 0.8) { // Only accept latencies between 10 ms and 500 ms.
                                this.log(`Clap latency ${latency.toPrecision(3)} seconds. Volume ${v.toPrecision(3)} (${Math.round((v - this.initialQuiet.mean) / this.initialQuiet.sd)} SDs above mean, ${Math.round((v - this.initialQuiet.max) / this.initialQuiet.sd)} SDs above max)`);
                                this.samples.push(latency);
                                this.maybeEmitCalibration();
                            } else {
                                this.log(`Rejecting suspect latency sample: ${latency.toPrecision(3)} seconds`)
                            }
                        }

                    }
                }

                // Produce ticks.
                for(let i = 0; i < 128; i++) {
                    out(outputs, i, this.tickBuffer[(currentFrame - this.startFrame + i) % this.tickBuffer.length]);
                }
            }

        }

        return true;
    }
}

registerProcessor('calibrator', Calibrator);
