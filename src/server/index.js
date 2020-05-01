import {RTCTransceivers} from "../shared";

require("regenerator-runtime");

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
let nextClientId = 0;

let roomVideos = {};

let clientLog = (client, ...args) => {
    log.info(`[Client ${client.clientId}]`, ...args);
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
        throw new Error(`${client.clientId} is not the conductor. Ignoring command.`);
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
        if (client.user.userId === user.userId) {
            client.user = user;
            await db.updateUser(user);
            sendToRoomConductor(client.room, {cmd: 'userUpdated', user});
        }
    },
    joinRoom: async (client, {room}) => {
        client.room = room;
        let dbRoom = await ensureRoomExists(room);
        clientLog(client, `Joined room '${room}'`);
        sendToRoomConductor(client.room, {cmd: "singerJoined", user: client.user});

        if (!roomVideos[room]) {

            roomVideos[room] = {
                frame: { width: 640, height: 480, data: new Uint8ClampedArray(640 * 480 * 4) },
                source: new RTCVideoSource(),
            };

            for (let i = 0; i < roomVideos[room].frame.data.length; i++) {
                roomVideos[room].frame.data[i] = 128;
            }

            setInterval(() => {
                const i420Data = new Uint8ClampedArray(640 * 480 * 1.5);
                const i420Frame = { width: 640, height: 480, data: i420Data };
                rgbaToI420(roomVideos[room].frame, i420Frame);

                roomVideos[room].source.onFrame(i420Frame);
            }, 500);
        }



        return dbRoom;
    },
    leaveRoom: (client) => {
        if (client.room) {
            clientLog(client, `Left room '${client.room}'`);
            sendToRoomConductor(client.room, {cmd: "singerLeft", userId: client.user.userId});
            delete client.room;
        }
    },
    conductRoom: (client, { conducting }) => {
        if (conducting) {
            // TODO: Check that this client is allowed to conduct
            forClientInRoom(client.room, c => { delete c.conducting; });
            client.conducting = true;
            forClientInRoom(client.room, c => {
                sendToRoomConductor(client.room, {cmd: "updateSingerState", user: c.user, state: c.singerState});
            });
            clientLog(client, `Conducting room ${client.room}`)
        } else if (client.conducting) {
            client.conducting = false;
            clientLog(client, `No longer conducting room ${client.room}`)
        }
        return true;
    },
    getBackingTrack: async (client, {backingTrackId}) => {
        return await getBackingTrack(backingTrackId);
    },
    loadBackingTrack: async (client, {backingTrackId}) => {
        requireConductor(client);
        roomLog(client.room, `Loading backing track '${backingTrackId}'`);
        let track = await setRoomBackingTrack(client.room, backingTrackId);
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
    newLayer: async (client, { layerId, startTime, backingTrackId }, audioData) => {
        requireUuid(layerId);
        clientLog(client, "New layer:", audioData.length);
        fs.mkdirSync(".layers", {recursive: true});
        fs.writeFileSync(`.layers/${layerId}.raw`, audioData);
        let layer = await saveLayer(layerId, client.user.userId, backingTrackId, client.room, startTime);
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
            let conductorVideo = null;
            let conductorAudio = null;
            forClientInRoom(client.room, c => {
                if (c.conducting) {
                    conductorVideo = c.peer.getTransceiver(RTCTransceivers.MY_VIDEO).receiver.track
                    conductorAudio = c.peer.getTransceiver(RTCTransceivers.MY_AUDIO).receiver.track
                }
            });
            if (conductorVideo) {
                await client.peer.getTransceiver(RTCTransceivers.CONDUCTOR_VIDEO).sender.replaceTrack(conductorVideo);
                await client.peer.getTransceiver(RTCTransceivers.CONDUCTOR_AUDIO).sender.replaceTrack(conductorAudio);
            }

            let videoSink = new RTCVideoSink(client.peer.getTransceiver(RTCTransceivers.MY_VIDEO).receiver.track);
            videoSink.addEventListener("frame", async ({frame}) => {
                return;
                try {
                    const rgbaData = new Uint8ClampedArray(frame.width * frame.height * 4);
                    const rgbaFrame = {width: frame.width, height: frame.height, data: rgbaData};
                    i420ToRgba(frame, rgbaFrame);


                    let img = sharp(Buffer.from(rgbaFrame.data.buffer), {
                        raw: {
                            width: frame.width,
                            height: frame.height,
                            channels: 4,
                        }
                    }).resize(640/4);

                    let totalClientsInRoom = 0;
                    let thisClientIndexInRoom = 0;
                    forClientInRoom(client.room, c => {
                        if (c === client) {
                            thisClientIndexInRoom = totalClientsInRoom;
                        }
                        totalClientsInRoom++;
                    })

                    let out = await sharp(Buffer.from(roomVideos[client.room].frame.data.buffer), {
                        raw :{
                            width: 640,
                            height: 480,
                            channels: 4,
                        }
                    }).composite([{
                        input: await img.raw().toBuffer(),
                        raw :{
                            width: 640/4,
                            height: 480/4,
                            channels: 4,
                        },
                        top: Math.floor(thisClientIndexInRoom / 4) * 480/4,
                        left: Math.floor(thisClientIndexInRoom % 4) * 640/4,
                    }]).raw().toBuffer();

                    roomVideos[client.room].frame.data = new Uint8ClampedArray(out);
                } catch (e) {
                    console.error(e);
                }
            });
        }

        await client.peer.getTransceiver(RTCTransceivers.CHOIR_VIDEO).sender.replaceTrack(roomVideos[client.room].source.createTrack());



    },
    initPeer: async (client) => {
        client.peer = new Peer({ initiator: true, wrtc });
        client.peer.addTransceiver('audio');
        client.peer.addTransceiver('video');
        client.peer.addTransceiver('video');

        let x = 0;
        let videoSink = new RTCVideoSink(client.peer._pc.getTransceivers()[2].receiver.track);
        videoSink.addEventListener("frame", ({frame}) => {
            if (x++ % 100 !== 0)
                return;

            console.log("Write frame",x);

            const rgbaData = new Uint8ClampedArray(frame.width * frame.height * 4);
            const rgbaFrame = { width: frame.width, height: frame.height, data: rgbaData };
            i420ToRgba(frame, rgbaFrame);

            let jpegImageData = jpeg.encode(rgbaFrame, 75);

            fs.writeFileSync('image.jpg', jpegImageData.data);
        });


        client.peer.on("connect", () => {
            console.log("CONNECT");

        });

        client.peer.on("data", e => {
            console.log("DATA", e);
        });

        client.peer._pc.ontrack = e => {
            console.log("ONTRACK", e);
            debugger;
        }

        client.peer.on("track", (track, stream) => {
            console.log("TRACK", track);

            client.tracks = client.tracks || [];
            client.tracks.push(track);
            debugger;
            //
            // let x = 0;
            //
            // let videoSink = new RTCVideoSink(track);
            // videoSink.addEventListener("frame", ({frame}) => {
            //     if (x++ % 100 !== 0)
            //         return;
            //
            //     const rgbaData = new Uint8ClampedArray(frame.width * frame.height * 4);
            //     const rgbaFrame = { width: frame.width, height: frame.height, data: rgbaData };
            //     i420ToRgba(frame, rgbaFrame);
            //
            //     let jpegImageData = jpeg.encode(rgbaFrame, 75);
            //
            //     fs.writeFileSync('image.jpg', jpegImageData.data);
            // });
        });

        client.peer.on("signal", data => {
            console.log("SIGNAL", data);
            client.sendJSON({cmd: "peerSignal", data})
        });

        client.peer.on("error", err => {
            console.log(err);
            console.log("Don't panic.")
        })
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
serverRepl.context.db = db;
serverRepl.context.roomVideos = roomVideos;

