
class Drifter extends AudioWorkletProcessor {

    constructor() {
        super();


        this.port.onmessage = ({data}) => {
            console.log(currentTime - data);
        };

        this.x = 0;

        //this.lastOutput = performance.now()/1000;
    }


    process () {
        //let t = performance.now()/1000;
        //let dt = t - this.lastOutput;
        this.x += 128;

        if (this.x >= sampleRate*5) {
            this.port.postMessage(this.x);
            this.x = 0;
        }

        // if (dt > 1) {
        //     console.log(`FPS: ${this.x / dt}`);
        //     this.x = 0;
        //     this.lastOutput = t;
        // }

        return true;
    }
}

registerProcessor('drifter', Drifter);
