import {RTCTransceivers} from "../shared";

let video = require("../../build/Release/video.node");

// let ab = new Uint8Array(100);
//
// for (let i = 0; i < ab.length; i++) {
//     ab[i] = i;
// }
//
// video.reverse(ab.buffer);
//
// console.log(ab);
//
// process.exit(0);

require("regenerator-runtime");
const {
    performance
} = require('perf_hooks');

import {
    deleteLayer,
    ensureRoomExists,
    getBackingTrack,
    openDB,
    saveLayer, setRehearsalState,
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

const Peer = require('simple-peer');
const wrtc = require('wrtc');
const { RTCAudioSink, RTCVideoSink, RTCVideoSource, RTCAudioSource, i420ToRgba, rgbaToI420 } = wrtc.nonstandard;
var jpeg = require('jpeg-js');
const sharp = require('sharp');

// Useful background: https://www.html5rocks.com/en/tutorials/webrtc/infrastructure/

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
let rooms = {};
let nextClientId = 0;

let clientLog = (client, ...args) => {
    log.info(`[Client ${client.clientId}]`, ...args);
};
let roomLog = (room, ...args) => {
    log.info(`[Room ${room.roomId}]`, ...args);
};

let requireUuid = uuid => {
    if (!/^[a-z0-9\-]{36}$/.test(uuid))
        throw new Error("Invalid UUID");
};

let requireConductor = client => {
    if (!client.conducting) {
        throw new Error(`${client.clientId} is not the conductor. Ignoring command.`);
    }
};

let conduct = (room, obj, data=null) => {
    for (let c of room.singers) {
        c.sendJSON(obj);
    }
};

let clearVideoFrame = frame => {
    const Y = 192; //238;
    const U = 128; //136;
    const V = 128; //119;
    const uStart = 2 * frame.data.length / 3;
    const vStart = 5 * frame.data.length / 6;
    for (let i = 0; i < frame.data.length; i++) {
        frame.data[i] = i < uStart ? Y : i < vStart ? U : V;
    }
}

let getOrCreateRoom = async (roomId) => {

    if (!(roomId in rooms)) {
        let dbRoom = await ensureRoomExists(roomId);

        let frame = {
            width: 640,
            height: 480,
            data: new Uint8ClampedArray(640 * 480 * 1.5),
        };
        let source = new RTCVideoSource();

        rooms[roomId] = {
            roomId,
            name: dbRoom.name,
            currentBackingTrackId: dbRoom.currentBackingTrackId,
            rehearsalState: dbRoom.rehearsalState,

            clients: [],
            singers: [],
            conductor: null,

            video: {
                frame,
                source,
            }
        };

        const FPS = 30;
        setTimeout(function f() {
            if (roomId in rooms) {
                source.onFrame(frame);
                setTimeout(f, 1000/FPS)
            }
        }, 1000/FPS);
    }
    return rooms[roomId];
}

let maybeDestroyRoom = room => {
    if (room.singers.length === 0 && !room.conductor) {
        delete rooms[room.roomId];
    }
};

let messageHandlers = {
    updateUser: async (client, {user}) => {
        if (client.user.userId === user.userId) {
            client.user = user;
            await db.updateUser(user);
            client.room.conductor?.sendJSON({cmd: 'userUpdated', user});
        }
    },
    joinRoom: async (client, {roomId}) => {
        if (!client.room) {
            client.room = await getOrCreateRoom(roomId);
            clearVideoFrame(client.room.video.frame);

            client.room.singers.push(client);

            clientLog(client, `Joined room '${roomId}'`);
            client.room.conductor?.sendJSON({cmd: "singerJoined", user: client.user});

            return {
                roomId: roomId,
                name: client.room.name,
                currentBackingTrackId: client.room.currentBackingTrackId,
                rehearsalState: client.room.rehearsalState,
            };
        }
    },
    leaveRoom: (client) => {
        if (client.room) {
            clientLog(client, `Left room '${client.room.roomId}'`);
            if (client.room.conductor !== client) {
                client.room.conductor?.sendJSON({cmd: "singerLeft", userId: client.user.userId});
            }
            client.room.singers = client.room.singers.filter(s => s !== client);
            if (client.room.conductor === client) {
                client.room.conductor = null;
            }
            maybeDestroyRoom(client.room);
            clearVideoFrame(client.room.video.frame);
            delete client.room;
        }
    },
    conductRoom: (client, { conducting }) => {
        if (conducting) {
            // TODO: Check that this client is allowed to conduct
            for (let c of client.room.clients) {
                c.conducting = false;
            }
            client.conducting = true;
            client.room.singers = client.room.singers.filter(s => s !== client);
            if (client.room.conductor && client.room.conductor !== client) {
                client.room.singers.push(client.room.conductor);
            }
            client.room.conductor = client;

            for(let c of client.room.singers) {
                client.sendJSON({cmd: "updateSingerState", user: c.user, state: c.singerState});
            }
            clientLog(client, `Conducting room ${client.room.roomId}`)
        } else if (client.conducting) {
            client.conducting = false;
            client.room.conductor = null;
            client.room.singers.push(client);
            clientLog(client, `No longer conducting room ${client.room.roomId}`)
        }
        return true;
    },
    getBackingTrack: async (client, {backingTrackId}) => {
        return await getBackingTrack(backingTrackId);
    },
    loadBackingTrack: async (client, {backingTrackId}) => {
        requireConductor(client);
        roomLog(client.room, `Loading backing track '${backingTrackId}'`);
        let track = await setRoomBackingTrack(client.room.roomId, backingTrackId);

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
        client.room.conductor?.sendJSON({cmd: "updateSingerState", user: client.user, state});
    },
    newLayer: async (client, { layerId, startTime, backingTrackId }, audioData) => {
        requireUuid(layerId);
        clientLog(client, "New layer:", audioData.length);
        fs.mkdirSync(".layers", {recursive: true});
        fs.writeFileSync(`.layers/${layerId}.raw`, audioData);
        let layer = await saveLayer(layerId, client.user.userId, backingTrackId, client.room.roomId, startTime);
        if (!client.conducting) {
            client.room.conductor?.sendJSON({cmd: "newSingerLayer", layer});
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
    deleteLayer: async (client, {layerId}) => {
        requireUuid(layerId);
        requireConductor(client);
        conduct(client.room, {cmd: "deleteLayer", layerId});
        await deleteLayer(layerId);
        try { fs.unlinkSync(`.layers/${layerId}.raw`); } catch (e) { }
    },
    setRehearsalState: async (client, {roomId, rehearsalState}) => {
        requireConductor(client);
        conduct(client.room, {cmd: "setRehearsalState", rehearsalState});
        await setRehearsalState(roomId, rehearsalState);
    },
    rtcRequestOffer: async (client) => {
        client.peer = new Peer({ initiator: true, wrtc });
        for (let t of RTCTransceivers) {
            client.peer.addTransceiver(/video|audio/.exec(t)[0]);
        }

        client.peer.on("signal", data => {
            client.sendJSON({cmd: "rtcSignal", data})
        });

        client.peer.on("error", err => {
            console.error(err);
        });

        if (!client.conducting) {

            if (client.room.conductor) {
                let conductorVideo = client.room.conductor?.peer.getTransceiver(RTCTransceivers.MY_VIDEO).receiver.track
                let conductorAudio = client.room.conductor?.peer.getTransceiver(RTCTransceivers.MY_AUDIO).receiver.track
                await client.peer.getTransceiver(RTCTransceivers.CONDUCTOR_VIDEO).sender.replaceTrack(conductorVideo);
                await client.peer.getTransceiver(RTCTransceivers.CONDUCTOR_AUDIO).sender.replaceTrack(conductorAudio);
            }

            let videoSink = new RTCVideoSink(client.peer.getTransceiver(RTCTransceivers.MY_VIDEO).receiver.track);
            videoSink.addEventListener("frame", async ({frame}) => {
                if (client.room && !client.conducting) {
                    let myIdx = client.room.singers.indexOf(client);
                    let gridSize = Math.ceil(Math.sqrt(client.room.singers.length));
                    let gridX = myIdx % gridSize;
                    let gridY = Math.floor(myIdx / gridSize);

                    let tileWidth = 640/gridSize;
                    let tileHeight = 480/gridSize;

                    try {
                        //let start = performance.now();
                        video.i420overlay(frame.data.buffer, client.room.video.frame.data.buffer, frame.width, frame.height, gridX * tileWidth, gridY * tileHeight, tileWidth, tileHeight);
                        //console.log("Frame processing took", (performance.now() - start).toFixed(3), "ms");
                    } catch (e) {
                        console.error(e);
                    }
                }
            });
        }

        await client.peer.getTransceiver(RTCTransceivers.CHOIR_VIDEO).sender.replaceTrack(client.room.video.source.createTrack());
    },
    rtcSignal: async (client, {data}) => {
        if (client.peer) {
            client.peer.signal(data);
        }
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
        incomingBinaryData[client.clientId] = chunk => {
            bufferPos += chunk.copy(buffer, bufferPos);
            if (bufferPos === bytes) {
                delete incomingBinaryData[client.clientId];
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
        if (!(client.clientId in incomingBinaryData)) {
            throw Error(`Not expecting binary data from client ${client.clientId}`);
        }
        incomingBinaryData[client.clientId](msg);
    }
};


app.ws("/ws", (ws, {query: {userId}}) => {
    ws.binaryType = 'arrayBuffer';
    let client = {
        clientId:  `client-${nextClientId++}`,
        socket: ws,
        sendJSON: obj => ws.send(JSON.stringify(obj)),
    };
    clients[client.clientId] = client;
    clientLog(client, "Connected");

    (async () => {
        let user = (userId && await db.getUser(userId)) || await db.getUser(await db.createUser());
        client.user = user;
        client.sendJSON({cmd: 'setUser', user});
    })();

    ws.on("message", onClientMessage.bind(null, client));

    ws.on("close", () => {
        clientLog(client, "Disconnected");
        delete clients[client.clientId];
        messageHandlers.leaveRoom(client)
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
serverRepl.context.rooms = rooms;
serverRepl.context.db = db;

