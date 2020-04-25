import s from "./middleware/audio/state";


export const getAudioBufferRMSImageURL = async (audioBuffer, imgWidth, imgHeight=70) => {
    const buffer = audioBuffer.getChannelData(0);
    const canvas = document.createElement("canvas");
    canvas.height = 70;
    canvas.width = imgWidth;
    let ctx = canvas.getContext("2d");
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    let windowLength = Math.floor(buffer.length / imgWidth);
    for (let i = 0; i < imgWidth; i++) {
        let windowStart = Math.floor((i / imgWidth) * buffer.length);
        let sum = 0;
        for (let j = windowStart; j < windowStart + windowLength; j++) {
            sum += buffer[j] * buffer[j];
        }
        let rms = Math.sqrt(sum / windowLength) / 0.7;
        ctx.fillRect(i,imgHeight/2 - rms*imgHeight/2, 1, rms*imgHeight);
    }

    let blob = await new Promise(resolve => {
        canvas.toBlob(resolve , "image/png");
    });

    return URL.createObjectURL(blob);
};

export const pageInteractionRequired = async () => {
    return new AudioContext().state === 'suspended';
};