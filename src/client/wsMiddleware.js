
export default store => next => {
    let ws = new WebSocket(document.location.protocol.replace("http", "ws") + "//" + document.location.host + "/ws");
    return action => {

        if (action.type.startsWith("ws.out/")) {
            ws.send(JSON.stringify(action));
        }

        return next(action);
    };
}