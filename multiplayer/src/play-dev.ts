/**
 * Local-only server for trying play zones (src/world/play.ts) in a browser
 * before they are part of the lobby: one zone, everyone who connects is a
 * person in it, and anyone may start or change a game. It listens on
 * loopback only and has no accounts; frontend/pages/dev/play-zone.tsx is its
 * client.
 *
 * A change to the running game never asks anyone to reload. If the new
 * recipe fits the game as it stands it takes over in place. If it does not,
 * the round plays backwards to its start and carries on from there with the
 * new recipe.
 *
 * In:  { type: "pose", x, y, z, yaw } | { type: "hit" }
 *      { type: "start", recipe }    a new round
 *      { type: "change", recipe }   the same round, with a different recipe
 * Out: { type: "welcome", id }
 *      { type: "game", recipe, seed, change }   change: "start" | "live" | "reset"
 *      { type: "rewind", seconds }
 *      { type: "state", score, secondsLeft, people, stepMs, done }
 *      and binary frames from ../protocol/play-zone (things 20 times a second, people 20).
 *
 * PLAY_DEV_RECIPE=path/to/recipe.json also applies that file as a change
 * every time it is saved, so a game can be edited in an editor while people
 * are playing it.
 */
import { readFileSync, watch } from "fs";
import { createServer } from "http";
import { Server as WebSocketServer } from "ws";
import { encodePeople, readPlayRecipe } from "../protocol/play-zone";
import { PLAY_STEP, PlayZone, loadPlayPhysics } from "./world/play";

const port = Number(process.env.PLAY_DEV_PORT) || 2570;
/** Steps between sends: 60 Hz physics, 20 Hz frames. */
const SEND_EVERY = 3;
/** However long the round was, a rewind lasts about this long. */
const REWIND_SECONDS = 2.5;

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
    stepMs = 0,
    clock = 0;
/** During a rewind: the recipe that takes over at the start, and how many samples to go back each send. */
let pending: { recipe: NonNullable<ReturnType<typeof readPlayRecipe>>; stride: number } | null = null;

const send = (client: Client, message: unknown) => client.ws.readyState === 1 && client.ws.send(JSON.stringify(message));
const sendFrames = (client: Client, frames: Uint8Array[]) => {
    if (client.ws.readyState !== 1 || client.ws.bufferedAmount > 512 * 1024) return;
    for (const frame of frames) client.ws.send(frame, { binary: true });
};
const everyone = (message: unknown) => {
    for (const client of clients.values()) send(client, message);
};

function begin(recipe: NonNullable<ReturnType<typeof readPlayRecipe>>, change: "start" | "reset") {
    zone?.free();
    // A reset keeps the seed: the new round starts where the rewind ended.
    if (change === "start") seed++;
    zone = new PlayZone(recipe, seed);
    pending = null;
    for (const client of clients.values()) client.fresh = true;
    everyone({ type: "game", recipe, seed, change });
}

function start(value: unknown) {
    const recipe = readPlayRecipe(value);
    if (recipe) begin(recipe, "start");
    return !!recipe;
}

/** A new recipe for the round in play: in place when it fits, after a rewind when it does not. */
function change(value: unknown) {
    const recipe = readPlayRecipe(value);
    if (!recipe) return "invalid";
    if (!zone) {
        begin(recipe, "start");
        return "start";
    }
    if (pending) {
        // Already rewinding: the latest recipe wins when the start is reached.
        pending.recipe = recipe;
        return "reset";
    }
    const plan = zone.plan(recipe);
    if (plan === "live") {
        zone.apply(recipe);
        everyone({ type: "game", recipe, seed, change: "live" });
    } else if (plan === "reset") {
        const samples = zone.beginRewind();
        pending = { recipe, stride: Math.max(1, Math.ceil(samples / (REWIND_SECONDS * (60 / SEND_EVERY)))) };
        everyone({ type: "rewind", seconds: REWIND_SECONDS });
    }
    return plan;
}

function rewind() {
    if (!zone || !pending) return;
    const moment = zone.rewindFrames(pending.stride);
    if (!moment) return begin(pending.recipe, "reset");
    const people = encodePeople(zone.tick, moment.people);
    for (const client of clients.values()) {
        sendFrames(client, moment.frames);
        sendFrames(client, [people]);
    }
}

function step() {
    clock++;
    if (!zone) return;
    if (pending) {
        if (clock % SEND_EVERY === 0) rewind();
        return;
    }
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
    if (zone.tick % 30 === 0 || zone.done) everyone({ type: "state", score: zone.score(), secondsLeft: Math.ceil(zone.stepsLeft * PLAY_STEP), people: clients.size, stepMs: +stepMs.toFixed(2), done: zone.done });
    if (zone.done) {
        zone.free();
        zone = null;
    }
}

/** Applies a recipe file now and again whenever it is saved. */
function follow(file: string) {
    let timer: NodeJS.Timeout | null = null;
    const load = () => {
        try {
            console.log(`${file}: ${change(JSON.parse(readFileSync(file, "utf8")))}`);
        } catch (error) {
            // Half-written or not JSON: keep the game as it is and wait for the next save.
            console.log(`${file}: not applied (${(error as Error).message})`);
        }
    };
    load();
    watch(file, () => {
        // Editors write a file in several steps; wait for them to finish.
        if (timer) clearTimeout(timer);
        timer = setTimeout(load, 80);
    });
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
        if (zone) send(client, { type: "game", recipe: zone.recipe, seed, change: "start" });
        if (pending) send(client, { type: "rewind", seconds: REWIND_SECONDS });
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
            else if (message?.type === "change") change(message.recipe);
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
    http.listen(port, "127.0.0.1", () => {
        console.log(`Local play zone only: ws://127.0.0.1:${port}`);
        if (process.env.PLAY_DEV_RECIPE) follow(process.env.PLAY_DEV_RECIPE);
    });
}
main();
