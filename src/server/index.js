const express = require("express");
const app = express();
require('express-ws')(app);
const path = require("path");
const log = require("loglevel");

const root = path.resolve("./src");

const webpack = require("webpack");
const webpackConfig = require("../../webpack.client.config");
const compiler = webpack(webpackConfig);

log.setDefaultLevel("trace");
// webpack hmr
app.use(
    require("webpack-dev-middleware")(compiler, {
    noInfo: true,
    publicPath: webpackConfig.output.publicPath
})
);

app.use(require("webpack-hot-middleware")(compiler));

let clients = {};
let nextClientId = 0;

let messageHandlers = {
    joinRoom: (clientId, {room}) => {
        clients[clientId].room = room;
        log.info(`Client ${clientId} joined room '${room}'`);
    },
    selectBackingTrack: (clientId, {url}) => {
        for (let [peerId, peer] of Object.entries(clients)) {
            if (peerId !== clientId && peer.room === clients[clientId].room) {
                peer.sendJSON({cmd: "selectBackingTrack", url});
            }
        }
    },
};


let onClientMessage = (clientId, msg) => {
    console.log(`[Client ${clientId}] ${msg}`);

    let {callId, fn, kwargs} = JSON.parse(msg);
    let resp = { callId };
    try {
        resp.response = messageHandlers[fn](clientId, kwargs);
    } catch (e) {
        resp.error = e.message;
    }
    clients[clientId].sendJSON(resp);
};


app.ws("/ws", (ws, {params: {room}}) => {
    let clientId = `client-${nextClientId++}`;
    clients[clientId] = {
        socket: ws,
        sendJSON: obj => ws.send(JSON.stringify(obj)),
    };
    console.log(`[Client ${clientId}] Connected`);

    ws.on("message", onClientMessage.bind(null, clientId));

    ws.on("close", () => {
        console.log(`[Client ${clientId}] Disconnected`);
        delete clients[clientId];
    })
});

app.use(express.static("static"));
app.use(express.static("dist"));

app.get(/.*/, (req, res) => res.sendFile(path.resolve(root, "../static/index.html")));

// app start up
app.listen(8080, () => console.log("App listening on port 8080!"));