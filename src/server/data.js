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

    await db.exec("CREATE TABLE IF NOT EXISTS users (id, name, voice)");
    await db.exec("CREATE TABLE IF NOT EXISTS backingTracks (id, name, url)");
    await db.exec("CREATE TABLE IF NOT EXISTS rooms (id, name, currentBackingTrackId)");
    await db.exec("CREATE TABLE IF NOT EXISTS layers (id, userId, backingTrackId, roomId, startTime, duration, enabled)");
}

export const getUser = async (id) => {
    return await db.get(SQL`SELECT * FROM users WHERE id=${id}`);
}

export const createUser = async () => {
    let newId = uuid();
    await db.run(SQL`INSERT INTO users (id) VALUES (${newId})`);
    return newId;
}

export const updateUser = async ({id, name, voice}) => {
    await db.run(SQL`UPDATE users SET name=${name}, voice=${voice} WHERE id=${id}`);
}

export const ensureRoomExists = async (id) => {
    let room = await db.get(SQL`SELECT * FROM rooms WHERE id=${id}`);
    if (!room) {
        await db.run(SQL`INSERT INTO rooms (id) VALUES (${id})`);
    }
    return room;
};

export const addBackingTrack = async (id, name, url) => {
    await db.run(SQL`INSERT INTO backingTracks (id, name, url)
                     VALUES (${id}, ${name}, ${url})`);
};

export const listBackingTracks = async () => {
    return await db.all(`SELECT * FROM backingTracks`);
}

export const getBackingTrack = async (id) => {
    return await db.get(SQL`SELECT * FROM backingTracks WHERE id=${id}`);
}

export const setRoomName = async (roomId, name) => {
    await ensureRoomExists(roomId);
    await db.run(SQL`UPDATE rooms SET name=${name} WHERE id=${id}`);
}

export const setRoomBackingTrack = async (roomId, backingTrackId) => {
    await ensureRoomExists(roomId);
    await db.run(SQL`UPDATE rooms SET currentBackingTrackId=${backingTrackId} WHERE id=${roomId}`);
    return await getBackingTrack(backingTrackId);
}

export const saveLayer = async (id, userId, backingTrackId, roomId, startTime) => {
    await ensureRoomExists(roomId);
    await db.run(SQL`INSERT INTO layers (id, userId, backingTrackId, roomId, startTime) 
                  VALUES (${id}, ${userId}, ${backingTrackId}, ${roomId}, ${startTime})`);
    return await getLayer(id);
};

export const updateLayer = async ({id, enabled}) => {
    await db.run(SQL`UPDATE layers SET enabled=${enabled} WHERE id=${id}`);
    return await getLayer(id);
}

export const deleteLayer = async (id) => {
    await db.run(SQL`DELETE FROM layers WHERE id=${id}`);
};

export const getLayer = async (id) => {
    return await db.get(SQL`SELECT * FROM layers WHERE id=${id}`);
}

export const getLayers = async (roomId, backingTrackId) => {
    return await db.all(SQL`SELECT * FROM layers WHERE backingTrackId=${backingTrackId}`);
}