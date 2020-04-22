
export const createAudioWorkletNode = async (ctx, name, sourceCode, options) => {
    let blob = new Blob([sourceCode], { type: 'application/javascript' });
    let objectURL = URL.createObjectURL(blob);

    await ctx.audioWorklet.addModule(objectURL);

    let node = new AudioWorkletNode(ctx, name, options);
    node.call = (fn, ...args) => {
        node.port.postMessage({fn, args});
    };
    node.onprocessorerror = err => {
        log.error("Worklet error:", err);
    };
    return node;
};
