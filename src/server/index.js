import {RTCTransceivers} from "../shared";
import {v4 as uuid} from "uuid";
import * as db from "./data";
import {
    ensureRoomExists,
    getProject,
    listProjects,
    openDB,
    saveRoom,
    listLanes,
    listItemsByProject,
    addItem,
    addLane,
    getLane,
    listUsers,
    deleteItem,
    listItemsByLane,
    deleteLane, saveLane, saveItem, getUser, addProject, saveProject
} from "./data";

let video = require("../../build/Release/video.node");

require("regenerator-runtime");
const {
    performance
} = require('perf_hooks');

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
let ffmpeg = require("fluent-ffmpeg");


let align = (itemId) => {
    let micBuffer = fs.readFileSync(`.items/${itemId}.aud`)
    let recordedAudio = new Float32Array(micBuffer.buffer, 0, micBuffer.byteLength / 4);
    let referenceBuffer = fs.readFileSync(`.items/${itemId}.reference.aud`);
    let referenceAudio = new Float32Array(referenceBuffer.buffer, 0, referenceBuffer.byteLength / 4);

    return video.align(recordedAudio.buffer, referenceAudio.buffer);
}

// console.log(align('75fcaf99-1640-45b7-af9a-4308fc2921f4'));
// process.exit(0);

// Useful background: https://www.html5rocks.com/en/tutorials/webrtc/infrastructure/

let tryDeleteFile = fileName => {
    try { fs.unlinkSync(fileName); } catch (e) { }
}

log.setDefaultLevel("trace");

const WEBPACK = true;
if (WEBPACK) {
    // webpack hmr
    app.use(
        require("webpack-dev-middleware")(compiler, {
            noInfo: true,
            publicPath: webpackConfig.output.publicPath
        })
    );

    app.use(require("webpack-hot-middleware")(compiler));
}

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
            currentProjectId: dbRoom.currentProjectId,
            rehearsalState: dbRoom.rehearsalState,

            clients: [],
            singers: [],
            conductor: null,
            speaker: null,

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

let _deleteItem = async (client, {itemId}) => {
    conduct(client.room, {"cmd": "deleteItem", itemId});
    requireUuid(itemId);
    tryDeleteFile(`.items/${itemId}.aud`);
    tryDeleteFile(`.items/${itemId}.vid`);
    tryDeleteFile(`.items/${itemId}.original.vid`);
    tryDeleteFile(`.items/${itemId}.reference.aud`);
    await deleteItem(itemId);
}

let messageHandlers = {
    updateUser: async (client, {user}) => {
        if (client.user.userId === user.userId) {
            client.user = user;
            await db.saveUser(user);
            client.room.conductor?.sendJSON({cmd: 'userUpdated', user});
        }
    },
    joinRoom: async (client, {roomId}) => {
        if (!client.room) {
            client.room = await getOrCreateRoom(roomId);
            clearVideoFrame(client.room.video.frame);

            client.room.singers.push(client);
            client.room.clients.push(client);

            clientLog(client, `Joined room '${roomId}'`);
            client.room.conductor?.sendJSON({cmd: "singerJoined", user: client.user});

            return {
                roomId: roomId,
                name: client.room.name,
                currentProjectId: client.room.currentProjectId,
                rehearsalState: client.room.rehearsalState,
                conductorUserId: client.room.conductor?.user.userId,
                projects: await listProjects(roomId),
            };
        }
    },
    leaveRoom: (client) => {
        if (client.room) {
            clientLog(client, `Left room '${client.room.roomId}'`);
            client.room.singers = client.room.singers.filter(s => s !== client);
            if (client.room.conductor === client) {
                client.room.conductor = null;
            }
            client.room.clients = client.room.clients.filter(c => c !== client);
            if (client.room.speaker === client) {
                client.room.speaker = null;
                for (let c of client.room.clients) {
                    c.sendJSON({cmd: "nowSpeaking", user: null});
                }
            }

            for (let c of client.room.clients) {
                if (c !== client) {
                    c.sendJSON({cmd: "singerLeft", userId: client.user.userId});
                }
            }
            maybeDestroyRoom(client.room);
            clearVideoFrame(client.room.video.frame);
            delete client.room;
        }
    },
    conductRoom: async(client, { conducting }) => {
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

            let conductorVideo = client.peer?.getTransceiver(RTCTransceivers.MY_VIDEO).receiver.track
            let conductorAudio = client.peer?.getTransceiver(RTCTransceivers.MY_AUDIO).receiver.track
            for(let c of client.room.singers) {
                c.sendJSON({cmd: "updateRoomConductor", conductorUserId: client.room.conductor?.user.userId})
                client.sendJSON({cmd: "updateSingerState", user: c.user, state: c.singerState});
                if (conductorVideo && c.peer) {
                    await c.peer.getTransceiver(RTCTransceivers.CONDUCTOR_VIDEO).sender.replaceTrack(conductorVideo);
                    await c.peer.getTransceiver(RTCTransceivers.CONDUCTOR_AUDIO).sender.replaceTrack(conductorAudio);
                }
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
    listProjects: async (client) => {
        return await listProjects(client.room.roomId);
    },
    createProject: async (client, {name}) => {
        requireConductor(client);
        let project = await addProject(uuid(), client.room.roomId, name);
        let lanes = await listLanes(project.projectId);
        let items = await listItemsByProject(project.projectId);
        let users = await listUsers(project.projectId);
        client.room.currentProjectId = project.projectId;
        await saveRoom(client.room);
        conduct(client.room, {cmd: "loadProject", project, lanes, items, users});
        return {project, lanes, items, users};
    },
    loadProject: async (client, {projectId}) => {
        let project = await getProject(projectId);
        let lanes = await listLanes(projectId);
        let items = await listItemsByProject(projectId);
        let users = await listUsers(projectId);
        if (client.conducting) {
            roomLog(client.room, `Loading project ${projectId}`);
            client.room.currentProjectId = projectId;
            await saveRoom(client.room);
            conduct(client.room, {cmd: "loadProject", project, lanes, items, users});
        }
        return {project, lanes, items, users};
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
        for (let c of client.room.clients) {
            c.sendJSON({cmd: "updateSingerState", user: client.user, state});
        }
    },
    uploadItem: async (client, { name }, data) => {
        clientLog(client, "New upload:", name, data.length, "bytes");
        let itemId = uuid();
        fs.mkdirSync(".items", {recursive: true});
        fs.writeFileSync(`.items/${itemId}.${name}`, data);
        let laneIdx = (await listLanes(client.room.currentProjectId)).length;
        let lane = await addLane(uuid(), client.room.currentProjectId, client.user.userId, name, laneIdx, true);
        let itemIdx = (await listItemsByProject(client.room.currentProjectId)).filter(i => i.laneId === lane.laneId).length;
        let item = await addItem(itemId, lane.laneId, 0, 0, 0, itemIdx, `/.items/${itemId}.${name}`, null);

        for (let c of client.room.clients) {
            c.sendJSON({cmd: "newItem", item, lane, user: client.user});
        }
    },
    newItem: async (client, { itemId, laneId, videoBytes, backingTrackId, referenceOutputStartTime }, data) => {
        requireUuid(itemId);
        clientLog(client, "New item:", data.length-videoBytes, "bytes of audio, ", videoBytes, "bytes of video");
        fs.mkdirSync(".items", {recursive: true});
        fs.writeFileSync(`.items/${itemId}.original.vid`, data.subarray(0,videoBytes));
        fs.writeFileSync(`.items/${itemId}.reference.aud`, data.subarray(videoBytes));

        await new Promise((resolve, reject) => ffmpeg(`.items/${itemId}.original.vid`)
            // Extract the recorded audio from the video
            .output(`.items/${itemId}.aud`)
            .noVideo()
            .format("f32le")
            .audioCodec("pcm_f32le")
            .audioFrequency(44100)
            .audioChannels(1)
            // Strip the audio from the video
            .output(`.items/${itemId}.vid`)
            .noAudio()
            .videoCodec("copy")
            .format("matroska")
            .on('error', reject)
            .on('end', resolve)
            .run());

        let offset = align(itemId);
        console.log("Got offset:", offset.toFixed(3), "s");
        let lane = await getLane(laneId);
        if (!lane) {
            // No valid lane was provided. Create a new lane for this user.
            laneId = uuid();
            let laneIdx = (await listLanes(client.room.currentProjectId)).length;
            lane = await addLane(laneId, client.room.currentProjectId, client.user.userId, '', laneIdx, true);
        }
        let itemIdx = (await listItemsByProject(client.room.currentProjectId)).filter(i => i.laneId === lane.laneId).length;
        let item = await addItem(itemId, laneId, referenceOutputStartTime+offset, 0, 0, itemIdx, `/.items/${itemId}.aud`, `/.items/${itemId}.vid`);

        for (let c of client.room.clients) {
            c.sendJSON({cmd: "newItem", item, lane, user: client.user});
        }
    },
    deleteItem: async (client, {itemId}) => {
        requireConductor(client);
        let item = await db.getItem(itemId);
        if (item) {
            await _deleteItem(client, item);
        }
    },
    deleteLane: async (client, {laneId}) => {
        requireConductor(client);
        let lane = await db.getLane(laneId);
        if (lane) {
            for (let item of await listItemsByLane(laneId)) {
                await _deleteItem(client, item);
            }
            conduct(client.room, {cmd: "deleteLane", laneId});
            await deleteLane(laneId);
        }
    },
    updateLane: async (client, {lane}) => {
        requireConductor(client); // TODO: Or owner of lane.
        await saveLane(lane);
        let items = await listItemsByLane(lane.laneId);
        let user = await getUser(lane.userId);
        conduct(client.room, {cmd: "updateLane", lane, items, user});
    },
    setTargetLane: async (client, {userId, laneId}) => {
        requireConductor(client);
        if (userId !== client.user.userId) {
            for(let c of client.room.clients) {
                if (c.user.userId === userId) {
                    c.sendJSON({cmd: "setTargetLane", userId, laneId});
                }
            }
        }
    },
    updateItem: async (client, {item}) => {
        requireConductor(client); // TODO: Or owner of item.
        await saveItem(item);
        conduct(client.room, {cmd: "updateItem", item});
    },
    setRehearsalState: async (client, {roomId, rehearsalState}) => {
        requireConductor(client);
        client.room.rehearsalState = rehearsalState;
        conduct(client.room, {cmd: "setRehearsalState", rehearsalState});
        await saveRoom(client.room);
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
            if (err.message !== "Ice connection failed.") {
                console.error(err);
            }
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
        } else {
            let conductorVideo = client.peer.getTransceiver(RTCTransceivers.MY_VIDEO).receiver.track
            let conductorAudio = client.peer.getTransceiver(RTCTransceivers.MY_AUDIO).receiver.track
            for(let c of client.room.singers) {
                if (conductorVideo && c.peer) {
                    await c.peer.getTransceiver(RTCTransceivers.CONDUCTOR_VIDEO).sender.replaceTrack(conductorVideo);
                    await c.peer.getTransceiver(RTCTransceivers.CONDUCTOR_AUDIO).sender.replaceTrack(conductorAudio);
                }
            }
        }

        await client.peer.getTransceiver(RTCTransceivers.CHOIR_VIDEO).sender.replaceTrack(client.room.video.source.createTrack());

        if (client?.room.speaker) {
            await client.peer.getTransceiver(RTCTransceivers.SPEAKER_VIDEO).sender.replaceTrack(client.room.speaker.peer.getTransceiver(RTCTransceivers.MY_VIDEO).receiver.track);
            await client.peer.getTransceiver(RTCTransceivers.SPEAKER_AUDIO).sender.replaceTrack(client.room.speaker !== client ? client.room.speaker.peer.getTransceiver(RTCTransceivers.MY_AUDIO).receiver.track : null);
            client.sendJSON({cmd: "nowSpeaking", user: client.room.speaker.user});
        }
    },
    rtcSignal: async (client, {data}) => {
        if (client.peer) {
            client.peer.signal(data);
        }
    },
    requestSpeak: async (client, {wantsToSpeak}) => {
        if (client.room.speaker && client.room.speaker !== client) {
            return false;
        }
        if (client.peer && !client.conducting) {
            client.room.speaker = wantsToSpeak ? client : null;
            let videoTrack = wantsToSpeak ? client.peer.getTransceiver(RTCTransceivers.MY_VIDEO).receiver.track : null;
            let audioTrack = wantsToSpeak ? client.peer.getTransceiver(RTCTransceivers.MY_AUDIO).receiver.track : null;
            for(let c of client.room.clients) {
                if (c.peer) {
                    await c.peer.getTransceiver(RTCTransceivers.SPEAKER_VIDEO).sender.replaceTrack(videoTrack);
                    await c.peer.getTransceiver(RTCTransceivers.SPEAKER_AUDIO).sender.replaceTrack(c !== client ? audioTrack : null);
                    c.sendJSON({cmd: "nowSpeaking", user: wantsToSpeak ? client.user : null});

                }
            }
            return wantsToSpeak;
        }
        return false;
    },
    muteChoir: async (client) => {
        requireConductor(client);
        if (client.room) {
            client.room.speaker = null;
            for (let c of client.room.clients) {
                if (c.peer) {
                    await c.peer.getTransceiver(RTCTransceivers.SPEAKER_VIDEO).sender.replaceTrack(null);
                    await c.peer.getTransceiver(RTCTransceivers.SPEAKER_AUDIO).sender.replaceTrack(null);
                    c.sendJSON({cmd: "nowSpeaking", user: null});
                }
            }
        }
    },
    uploadLyrics: async (client, {projectId, srtText, filename}) => {
        requireConductor(client);
        let path = `.lyrics/${projectId}.${filename}`;
        fs.mkdirSync(".lyrics", {recursive: true});
        fs.writeFileSync(path, srtText);


        let project = await getProject(projectId);
        if (project) {
            project.lyricsUrl = `/${path}`;
            await saveProject(project);

            for (let c of client.room.clients) {
                c.sendJSON({cmd: "updateProject", project});
            }
        }
    },
    removeLyrics: async (client, {projectId}) => {
        requireConductor(client);
        let project = await getProject(projectId);
        // TODO: We should probably delete the lyrics file on disk too.
        if (project) {
            project.lyricsUrl = null;
            await saveProject(project);
            for (let c of client.room.clients) {
                c.sendJSON({cmd: "updateProject", project});
            }
        }

    }
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

        let resp = { callId, fn };
        try {
            let f = messageHandlers[fn];
            if (!f)
                throw new Error(`Server function not found: ${fn}`);
            resp.response = await f(client, kwargs, data);
        } catch (e) {
            console.error(e);
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
app.use("/node_modules", express.static("node_modules"));
app.use("/.lyrics", express.static(".lyrics"));
app.use("/.items", express.static(".items"));

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

