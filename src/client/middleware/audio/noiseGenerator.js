
class NoiseGenerator extends AudioWorkletProcessor {

    constructor() {
        super();
        this.type = 'pink'
        this.b0 = this.b1 = this.b2 = this.b3 = this.b4 = this.b5 = this.b6 = 0;
    }

    static get parameterDescriptors () {
        return [{
            name: 'volume',
            defaultValue: 0,
            minValue: 0,
            maxValue: 1,
            automationRate: 'k-rate'
        }];
    };

    process (inputs, outputs,  {volume: [volume]}) {

        let outputChannels = outputs[0];

        // https://noisehack.com/generate-noise-web-audio-api/
        for (let outputChannelData of outputChannels) {
            if (this.type === 'white')  {
                for (let i = 0; i < 128; i++) {
                    outputChannelData[i] = (Math.random()*2-1)*volume;
                }
            } else if (this.type === 'pink') {
                for (let i = 0; i < 128; i++) {
                    let white = Math.random() * 2 - 1;
                    this.b0 = 0.99886 * this.b0 + white * 0.0555179;
                    this.b1 = 0.99332 * this.b1 + white * 0.0750759;
                    this.b2 = 0.96900 * this.b2 + white * 0.1538520;
                    this.b3 = 0.86650 * this.b3 + white * 0.3104856;
                    this.b4 = 0.55000 * this.b4 + white * 0.5329522;
                    this.b5 = -0.7616 * this.b5 - white * 0.0168980;
                    outputChannelData[i] = this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + white * 0.5362;
                    outputChannelData[i] *= 0.11 * volume; // (roughly) compensate for gain
                    this.b6 = white * 0.115926;
                }
            }
        }

        return true;
    }
}

registerProcessor('NoiseGenerator', NoiseGenerator);
