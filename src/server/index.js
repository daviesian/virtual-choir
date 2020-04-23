require("regenerator-runtime");

import {
    deleteLayer,
    ensureRoomExists,
    getBackingTrack,
    openDB,
    saveLayer,
    setRoomBackingTrack,
    updateLayer
} from "./data";
import * as db from "./data"
const express = require("express");
const app = express();
require('express-ws')(app);
const path = require("path");
const log = require("loglevel");
const fs = require("fs");
const root = path.resolve("./src");
const repl = require('repl');

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

let clientLog = (client, ...args) => {
    log.info(`[Client ${client.id}]`, ...args);
};
let roomLog = (room, ...args) => {
    log.info(`[Room ${room}]`, ...args);
};

let requireUuid = uuid => {
    if (!/^[a-z0-9\-]{36}$/.test(uuid))
        throw new Error("Invalid UUID");
};

let requireConductor = client => {
    if (!client.conducting) {
        throw new Error(`${client.id} is not the conductor. Ignoring command.`);
    }
};

let forClientInRoom = (room, fn) => {
    for (let [peerId, peer] of Object.entries(clients)) {
        if (peer.room === room) {
            fn(peer);
        }
    }

};

let conduct = (room, obj, data=null) => {
    forClientInRoom(room, c => {
        if (!c.conducting) {
            c.sendJSON(obj);
        }
    });
};

let sendToRoomConductor = (room, obj) => {
    forClientInRoom(room, c => {
        if (c.conducting) {
            c.sendJSON(obj);
        }
    });
};

let messageHandlers = {
    updateUser: async (client, {user}) => {
        if (client.user.id === user.id) {
            await db.updateUser(user);
            sendToRoomConductor(client.room, {cmd: 'userUpdated', user});
        }
    },
    joinRoom: async (client, {room}) => {
        client.room = room;
        let dbRoom = await ensureRoomExists(room);
        clientLog(client, `Joined room '${room}'`);
        return dbRoom;
    },
    leaveRoom: (client) => {
        if (client.room) {
            clientLog(client, `Left room '${client.room}'`);
            delete client.room;
        }
    },
    conductRoom: (client, { conducting }) => {
        if (conducting) {
            // TODO: Check that this client is allowed to conduct
            forClientInRoom(client.room, c => { delete c.conducting; });
            client.conducting = true;
            forClientInRoom(client.room, c => {
                sendToRoomConductor(client.room, {cmd: "updateSingerState", user: c.user, state: c.singerState})
            });
            clientLog(client, `Conducting room ${client.room}`)
        } else if (client.conducting) {
            client.conducting = false;
            clientLog(client, `No longer conducting room ${client.room}`)
        }
        return true;
    },
    getBackingTrack: async (client, {id}) => {
        return await getBackingTrack(id);
    },
    loadBackingTrack: async (client, {id}) => {
        requireConductor(client);
        roomLog(client.room, `Loading backing track '${id}'`);
        let track = await setRoomBackingTrack(client.room, id);
        conduct(client.room, {cmd: "loadBackingTrack", track});
    },
    play: (client, {startTime}) => {
        requireConductor(client);
        roomLog(client.room, `Playing from ${startTime} seconds`);
        conduct(client.room, {cmd: "play", startTime});
    },
    stop: (client) => {
        requireConductor(client);
        roomLog(client.room, `Stopping`);
        conduct(client.room, {cmd: "stop"});
    },
    startRecording: (client) => {
        requireConductor(client);
        roomLog(client.room, `Recording`);
        conduct(client.room, {cmd: "startRecording"});
    },
    stopRecording: (client) => {
        requireConductor(client);
        roomLog(client.room, `Stop recording`);
        conduct(client.room, {cmd: "stopRecording"});
    },
    seek: (client, {time}) => {
        requireConductor(client);
        roomLog(client.room, `Seek to ${time}`);
        conduct(client.room, {cmd: "seek", time});
    },
    singerStateUpdate: (client, {state}) => {
        client.singerState = state;
        sendToRoomConductor(client.room, {cmd: "updateSingerState", user: client.user, state});
    },
    newLayer: async (client, { id, startTime, backingTrackId }, audioData) => {
        requireUuid(id);
        clientLog(client, "New layer:", audioData.length);
        fs.mkdirSync(".layers", {recursive: true});
        fs.writeFileSync(`.layers/${id}.raw`, audioData);
        let layer = await saveLayer(id, client.user.id, backingTrackId, client.room, startTime);
        if (!client.conducting) {
            sendToRoomConductor(client.room, {cmd: "newSingerLayer", layer});
        }
    },
    getLayers: async (client, {roomId, backingTrackId}) => {
        return await db.getLayers(roomId, backingTrackId);
    },
    updateLayer: async (client, {layer}) => {
        requireConductor(client);
        // TODO: Update more than just 'enabled'
        let updatedLayer = await updateLayer(layer);
        conduct(client.room, {cmd: "updateLayer", layer: updatedLayer});
    },
    deleteLayer: async (client, {id}) => {
        requireConductor(client);
        conduct(client.room, {cmd: "deleteLayer", id});
        await deleteLayer(id);
    },
};

let incomingBinaryData = {};

let receiveBinaryDataForClient = (client, bytes) => {
    if (!bytes) {
        return null;
    }

    //clientLog(client,`Waiting for ${bytes} bytes of binary data`);

    return new Promise(resolve => {
        let buffer = new Buffer(bytes);
        let bufferPos = 0;
        incomingBinaryData[client.id] = chunk => {
            bufferPos += chunk.copy(buffer, bufferPos);
            if (bufferPos === bytes) {
                delete incomingBinaryData[client.id];
                resolve(buffer);
            }
        };
    });
};

let onClientMessage = async (client, msg) => {
    if (typeof(msg) === "string") {
        let {callId, fn, kwargs, binaryDataToFollow} = JSON.parse(msg);

        let data = await receiveBinaryDataForClient(client, binaryDataToFollow);

        let resp = { callId };
        try {
            let f = messageHandlers[fn];
            if (!f)
                throw new Error(`Server function not found: ${fn}`);
            resp.response = await f(client, kwargs, data);
        } catch (e) {
            resp.error = e.message;
        }
        client.sendJSON(resp);
    } else if (msg instanceof Buffer) {
        if (!(client.id in incomingBinaryData)) {
            throw Error(`Not expecting binary data from client ${client.id}`);
        }
        incomingBinaryData[client.id](msg);
    }
};


app.ws("/ws", (ws, {query: {userId}}) => {
    ws.binaryType = 'arrayBuffer';
    let client = {
        id:  `client-${nextClientId++}`,
        socket: ws,
        sendJSON: obj => ws.send(JSON.stringify(obj)),
    };
    clients[client.id] = client;
    clientLog(client, "Connected");

    (async () => {
        let user = (userId && await db.getUser(userId)) || await db.getUser(await db.createUser());
        client.user = user;
        client.sendJSON({cmd: 'setUser', user});
    })();

    ws.on("message", onClientMessage.bind(null, client));

    ws.on("close", () => {
        clientLog(client, "Disconnected");
        delete clients[client.id];
    })
});

app.use(express.static("static"));
app.use(express.static("dist"));
app.use("/.layers", express.static(".layers"));

app.get(/.*/, (req, res) => res.sendFile(path.resolve(root, "../static/index.html")));

// app start up
(async () => {
    await openDB();
    app.listen(8080, "0.0.0.0", () => console.log("App listening on port 8080!"));
})();

let serverRepl = repl.start({
    prompt: '> ',
    useColors: true,
    useGlobal: true,
    ignoreUndefined: true,
});

serverRepl.context.clients = clients;
serverRepl.context.db = db;