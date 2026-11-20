/**
 * Local-only server for trying play zones (src/world/play.ts) in a browser
 * before they are part of the lobby: one zone, everyone who connects is a
 * person in it, and anyone may start a recipe. It listens on loopback only
 * and has no accounts; frontend/pages/dev/play-zone.tsx is its client.
 *
 * In:  { type: "pose", x, y, z, yaw } | { type: "hit" } | { type: "start", recipe }
 * Out: { type: "welcome", id } | { type: "game", recipe, seed } | { type: "state", score, secondsLeft, people, stepMs }
 *      and binary frames from ../protocol/play-zone (things 20 times a second, people 20).
 */
import { createServer } from "http";
import { Server as WebSocketServer } from "ws";
import { readPlayRecipe } from "../protocol/play-zone";
import { PLAY_STEP, PlayZone, loadPlayPhysics } from "./world/play";

const port = Number(process.env.PLAY_DEV_PORT) || 2570;
/** Steps between sends: 60 Hz physics, 20 Hz frames. */
const SEND_EVERY = 3;

interface Client {
    id: number;
    ws: any;
    pose: { x: number; y: number; z: number; yaw: number } | null;
    /** Still owed every body's pose (just arrived, or a game just started). */
    fresh: boolean;
}

const clients = new Map<number, Client>();
let nextId = 1,
    zone: PlayZone | null = null,
    seed = 1,
    stepMs = 0;

const send = (client: Client, message: unknown) => client.ws.readyState === 1 && client.ws.send(JSON.stringify(message));
const sendFrames = (client: Client, frames: Uint8Array[]) => {
    if (client.ws.readyState !== 1 || client.ws.bufferedAmount > 512 * 1024) return;
    for (const frame of frames) client.ws.send(frame, { binary: true });
};

function start(value: unknown) {
    const recipe = readPlayRecipe(value);
    if (!recipe) return false;
    zone?.free();
    zone = new PlayZone(recipe, ++seed);
    for (const client of clients.values()) {
        client.fresh = true;
        send(client, { type: "game", recipe, seed });
    }
    return true;
}

function step() {
    if (!zone) return;
    for (const client of clients.values()) if (client.pose) zone.setPerson(client.id, client.pose.x, client.pose.y, client.pose.z, client.pose.yaw);
    const before = process.hrtime.bigint();
    zone.step();
    // A slow average of what one step costs, shown on the page.
    stepMs += (Number(process.hrtime.bigint() - before) / 1e6 - stepMs) * 0.05;
    if (zone.tick % SEND_EVERY) return;
    const moved = zone.frames(),
        people = zone.peopleFrame();
    let everything: Uint8Array[] | null = null;
    for (const client of clients.values()) {
        if (client.fresh) {
            sendFrames(client, (everything ||= zone.fullFrames()));
            client.fresh = false;
        } else sendFrames(client, moved);
        sendFrames(client, [people]);
    }
    if (zone.tick % 30 === 0 || zone.done) {
        const state = { type: "state", score: zone.score(), secondsLeft: Math.ceil(zone.stepsLeft * PLAY_STEP), people: clients.size, stepMs: +stepMs.toFixed(2), done: zone.done };
        for (const client of clients.values()) send(client, state);
    }
    if (zone.done) {
        zone.free();
        zone = null;
    }
}

const finite = (value: unknown, limit: number) => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;

async function main() {
    await loadPlayPhysics();
    const http = createServer((_req, res) => {
        res.writeHead(404);
        res.end();
    });
    const server = new WebSocketServer({ server: http, maxPayload: 16384, perMessageDeflate: false });
    server.on("connection", (ws: any) => {
        const client: Client = { id: nextId++ & 0xffff || nextId++, ws, pose: null, fresh: true };
        clients.set(client.id, client);
        send(client, { type: "welcome", id: client.id });
        if (zone) send(client, { type: "game", recipe: zone.recipe, seed });
        ws.on("message", (raw: Buffer | string, isBinary?: boolean) => {
            // Older ws versions pass no flag: text arrives as a string.
            if (typeof isBinary === "boolean" ? isBinary : typeof raw !== "string") return;
            let message: any;
            try {
                message = JSON.parse(raw.toString());
            } catch {
                return;
            }
            if (message?.type === "pose" && finite(message.x, 300) && finite(message.y, 300) && finite(message.z, 300) && finite(message.yaw, 1000)) client.pose = { x: message.x, y: message.y, z: message.z, yaw: message.yaw };
            else if (message?.type === "hit") zone?.hit(client.id);
            else if (message?.type === "start") start(message.recipe);
        });
        const leave = () => {
            clients.delete(client.id);
            zone?.removePerson(client.id);
        };
        ws.on("close", leave);
        ws.on("error", leave);
    });
    // Catch up when a timer fires late, but never more than a quarter second at once.
    let last = Date.now(),
        owed = 0;
    setInterval(() => {
        const now = Date.now();
        owed = Math.min(0.25, owed + (now - last) / 1000);
        last = now;
        while (owed >= PLAY_STEP) {
            step();
            owed -= PLAY_STEP;
        }
    }, 8);
    http.listen(port, "127.0.0.1", () => console.log(`Local play zone only: ws://127.0.0.1:${port}`));
}
main();
