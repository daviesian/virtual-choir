require("regenerator-runtime");

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import SQL from 'sql-template-strings';
import {v4 as uuid} from "uuid";


export let db = null;

export const openDB = async () => {
    db = await open({
        filename: "choir.db",
        driver: sqlite3.Database,
    });

    await db.exec("CREATE TABLE IF NOT EXISTS users (userId, name, voice)");
    await db.exec("CREATE TABLE IF NOT EXISTS rooms (roomId, name, currentProjectId, rehearsalState)");
    await db.exec("CREATE TABLE IF NOT EXISTS projects (projectId, roomId, name, lyricsUrl, scoreUrl, scoreAnnotations)");
    await db.exec("CREATE TABLE IF NOT EXISTS lanes (laneId, projectId, userId, name, enabled)")
    await db.exec("CREATE TABLE IF NOT EXISTS items (itemId, laneId, startTime, startOffset, endOffset, idx, audioUrl, videoUrl)");
}

export const getUser = async (userId) => {
    return await db.get(SQL`SELECT * FROM users WHERE userId=${userId}`);
}

export const createUser = async () => {
    let newId = uuid().substring(0,8);
    await db.run(SQL`INSERT INTO users (userId) VALUES (${newId})`);
    return newId;
}

export const saveUser = async ({userId, name, voice}) => {
    await db.run(SQL`UPDATE users SET name=${name}, voice=${voice} WHERE userId=${userId}`);
}

export const listUsers = async (projectId) => {
    return await db.all(SQL`SELECT DISTINCT users.* FROM users INNER JOIN lanes ON (lanes.userId = users.userId) WHERE projectId=${projectId}`);
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

export const saveRoom = async({roomId, name, currentProjectId, rehearsalState}) => {
    await db.run(SQL`UPDATE rooms SET name=${name}, currentProjectId=${currentProjectId}, rehearsalState=${JSON.stringify(rehearsalState)} WHERE roomId=${roomId}`);
}


export const addProject = async (projectId, roomId, name, lyricsUrl, scoreUrl, scoreAnnotations) => {
    await db.run(SQL`INSERT INTO projects (projectId, roomId, name, lyricsUrl, scoreUrl, scoreAnnotations)
                     VALUES (${projectId}, ${roomId}, ${name}, ${lyricsUrl}, ${scoreUrl}, ${scoreAnnotations})`);
    return await getProject(projectId);
}

export const listProjects = async (roomId) => {
    let projects = await db.all(SQL`SELECT * FROM projects WHERE roomId=${roomId}`);
    for (let p of projects || []) {
        if (p.scoreAnnotations) {
            p.scoreAnnotations = JSON.parse(p.scoreAnnotations);
        }
    }
    return projects;
}

export const getProject = async (projectId) => {
    let p = await db.get(SQL`SELECT * FROM projects WHERE projectId=${projectId}`);
    if (p.scoreAnnotations) {
        p.scoreAnnotations = JSON.parse(p.scoreAnnotations);
    }
    return p;
}

export const saveProject = async ({projectId, name, lyricsUrl, scoreUrl, scoreAnnotations}) => {
    await db.run(SQL`UPDATE projects SET name=${name}, lyricsUrl=${lyricsUrl}, scoreUrl=${scoreUrl}, scoreAnnotations=${scoreAnnotations ? JSON.stringify(scoreAnnotations) : null} WHERE projectId = ${projectId}`);
}

export const deleteProject = async (projectId) => {
    await db.run(SQL`DELETE FROM projects WHERE projectId=${projectId}`);
}

export const addLane = async (laneId, projectId, userId, name, idx, enabled) => {
    await db.run(SQL`INSERT INTO lanes (laneId, projectId, userId, name, idx, enabled)
                     VALUES (${laneId}, ${projectId}, ${userId}, ${name}, ${idx}, ${enabled})`);
    return await getLane(laneId);
}

export const listLanes = async (projectId) => {
    return await db.all(SQL`SELECT * FROM lanes WHERE projectId=${projectId}`);
}

export const getLane = async (laneId) => {
    return await db.get(SQL`SELECT * FROM lanes WHERE laneId=${laneId}`);
}

export const saveLane = async ({laneId, name, enabled}) => {
    await db.run(SQL`UPDATE lanes SET name=${name}, enabled=${enabled} WHERE laneId=${laneId}`);
}

export const deleteLane = async (laneId) => {
    await db.run(SQL`DELETE FROM lanes WHERE laneId=${laneId}`);
}

export const addItem = async (itemId, laneId, startTime, startOffset, endOffset, idx, audioUrl, videoUrl, videoOffset) => {
    await db.run(SQL`INSERT INTO items (itemId, laneId, startTime, startOffset, endOffset, idx, audioUrl, videoUrl, videoOffset)
                     VALUES (${itemId}, ${laneId}, ${startTime}, ${startOffset}, ${endOffset}, ${idx}, ${audioUrl}, ${videoUrl}, ${videoOffset})`);
    return await getItem(itemId);
}

export const getItem = async (itemId) => {
    return await db.get(SQL`SELECT * FROM items WHERE itemId=${itemId}`);
};

export const listItemsByProject = async (projectId) => {
    return await db.all(SQL`SELECT items.* FROM items INNER JOIN lanes ON (items.laneId = lanes.laneId) WHERE projectId=${projectId}`);
}

export const listItemsByLane = async (laneId) => {
    return await db.all(SQL`SELECT * FROM items WHERE laneId=${laneId}`);
}

export const saveItem = async ({itemId, laneId, startOffset, endOffset, videoUrl, videoOffset}) => {
    await db.run(SQL`UPDATE items SET laneId=${laneId}, startOffset=${startOffset}, endOffset=${endOffset}, videoUrl=${videoUrl}, videoOffset=${videoOffset} WHERE itemId=${itemId}`);
}

export const deleteItem = async (itemId) => {
    await db.run(SQL`DELETE FROM items WHERE itemId=${itemId}`);
}
