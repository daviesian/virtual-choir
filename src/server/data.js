require("regenerator-runtime");

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import SQL from 'sql-template-strings';
import {v4 as uuid} from "uuid";


let db = null;

export const openDB = async () => {
    db = await open({
        filename: "choir.db",
        driver: sqlite3.Database,
    });

    await db.exec("CREATE TABLE IF NOT EXISTS users (userId, name, voice)");
    await db.exec("CREATE TABLE IF NOT EXISTS backingTracks (backingTrackId, name, url)");
    await db.exec("CREATE TABLE IF NOT EXISTS rooms (roomId, name, currentBackingTrackId, rehearsalState)");
    await db.exec("CREATE TABLE IF NOT EXISTS layers (layerId, userId, backingTrackId, roomId, startTime, duration, enabled)");
}

export const getUser = async (userId) => {
    return await db.get(SQL`SELECT * FROM users WHERE userId=${userId}`);
}

export const createUser = async () => {
    let newId = uuid().substring(0,8);
    await db.run(SQL`INSERT INTO users (userId) VALUES (${newId})`);
    return newId;
}

export const updateUser = async ({userId, name, voice}) => {
    await db.run(SQL`UPDATE users SET name=${name}, voice=${voice} WHERE userId=${userId}`);
}

export const ensureRoomExists = async (roomId) => {
    let room = await db.get(SQL`SELECT * FROM rooms WHERE roomId=${roomId}`);
    if (!room) {
        await db.run(SQL`INSERT INTO rooms (roomId) VALUES (${roomId})`);
        room = { roomId };
    }
    room.rehearsalState = room.rehearsalState ? JSON.parse(room.rehearsalState) : undefined;
    return room;
};

export const addBackingTrack = async (backingTrackId, name, url) => {
    await db.run(SQL`INSERT INTO backingTracks (backingTrackId, name, url)
                     VALUES (${backingTrackId}, ${name}, ${url})`);
};

export const listBackingTracks = async () => {
    return await db.all(`SELECT * FROM backingTracks`);
}

export const getBackingTrack = async (backingTrackId) => {
    return await db.get(SQL`SELECT * FROM backingTracks WHERE backingTrackId=${backingTrackId}`);
}

export const setRoomName = async (roomId, name) => {
    await ensureRoomExists(roomId);
    await db.run(SQL`UPDATE rooms SET name=${name} WHERE roomId=${roomId}`);
}

export const setRoomBackingTrack = async (roomId, backingTrackId) => {
    await ensureRoomExists(roomId);
    await db.run(SQL`UPDATE rooms SET currentBackingTrackId=${backingTrackId} WHERE roomId=${roomId}`);
    return await getBackingTrack(backingTrackId);
}

export const saveLayer = async (layerId, userId, backingTrackId, roomId, startTime) => {
    await ensureRoomExists(roomId);
    await db.run(SQL`INSERT INTO layers (layerId, userId, backingTrackId, roomId, startTime) 
                  VALUES (${layerId}, ${userId}, ${backingTrackId}, ${roomId}, ${startTime})`);
    return await getLayer(layerId);
};

export const updateLayer = async ({layerId, enabled}) => {
    await db.run(SQL`UPDATE layers SET enabled=${enabled} WHERE layerId=${layerId}`);
    return await getLayer(layerId);
}

export const deleteLayer = async (layerId) => {
    await db.run(SQL`DELETE FROM layers WHERE layerId=${layerId}`);
};

export const getLayer = async (layerId) => {
    return await db.get(SQL`SELECT * FROM layers NATURAL JOIN users WHERE layerId=${layerId}`);
}

export const getLayers = async (roomId, backingTrackId) => {
    return await db.all(SQL`SELECT * FROM layers NATURAL JOIN users WHERE roomId=${roomId} AND backingTrackId=${backingTrackId}`);
}

export const setRehearsalState = async (roomId, rehearsalState) => {
    return await db.run(SQL`UPDATE rooms SET rehearsalState=${JSON.stringify(rehearsalState)} WHERE roomId=${roomId}`);
};