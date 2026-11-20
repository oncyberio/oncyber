/**
 * Local-only server for trying play zones in a browser on their own, with
 * no lobby around them: one zone, and everyone who connects is a person in
 * it. It listens on loopback only and has no accounts;
 * frontend/pages/dev/play-zone.tsx is its client. The game itself is run by
 * world/playAuthority.ts, the same code the lobby uses.
 *
 * In:  { type: "pose", x, y, z, yaw } | { type: "hit" } | { type: "act" }
 *      { type: "start", recipe }    a new round
 *      { type: "change", recipe }   the same round, with a different recipe
 *      { type: "ai", text }         ask the model for a change
 * Out: { type: "welcome", id }, then the authority's messages with their
 *      "play-" prefix removed ({ type: "game", ... }, "rewind", "state",
 *      "act", "action", "ai"), and binary frames from ../protocol/play-zone.
 *
 * PLAY_AUTHOR_URL, PLAY_AUTHOR_MODEL and PLAY_AUTHOR_KEY name the model that
 * answers { type: "ai" }; without them it is refused.
 * PLAY_DEV_RECIPE=path/to/recipe.json also applies that file as a change
 * every time it is saved, so a game can be edited in an editor while people
 * are playing it.
 */
import { readFileSync, watch } from "fs";
import { createServer } from "http";
import { Server as WebSocketServer } from "ws";
import { loadPlayPhysics } from "./world/play";
import { playAuthorFromEnv } from "./world/playAuthor";
import { PlayAuthority } from "./world/playAuthority";

const port = Number(process.env.PLAY_DEV_PORT) || 2565;
const STEP = 1 / 60;

const sockets = new Map<number, any>();
let nextId = 1;

const send = (ws: any, type: string, data: any) => ws?.readyState === 1 && ws.send(JSON.stringify({ ...data, type: type.replace(/^play-/, "") }));
const sendFrames = (ws: any, frames: Uint8Array[]) => {
    if (ws?.readyState !== 1 || ws.bufferedAmount > 512 * 1024) return;
    for (const frame of frames) ws.send(frame, { binary: true });
};

const authority = new PlayAuthority(
    {
        control: (type, data) => sockets.forEach((ws) => send(ws, type, data)),
        controlTo: (id, type, data) => send(sockets.get(id), type, data),
        frames: (frames, except) => sockets.forEach((ws, id) => except.has(id) || sendFrames(ws, frames)),
        framesTo: (id, frames) => sendFrames(sockets.get(id), frames),
    },
    { author: playAuthorFromEnv() }
);

/** Applies a recipe file now and again whenever it is saved. */
function follow(file: string) {
    let timer: NodeJS.Timeout | null = null;
    const load = () => {
        try {
            console.log(`${file}: ${authority.change(JSON.parse(readFileSync(file, "utf8")))}`);
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
        const id = nextId++ & 0xffff || nextId++;
        sockets.set(id, ws);
        send(ws, "welcome", { id });
        authority.join(id);
        ws.on("message", (raw: Buffer | string, isBinary?: boolean) => {
            // Older ws versions pass no flag: text arrives as a string.
            if (typeof isBinary === "boolean" ? isBinary : typeof raw !== "string") return;
            let message: any;
            try {
                message = JSON.parse(raw.toString());
            } catch {
                return;
            }
            if (message?.type === "pose" && finite(message.x, 300) && finite(message.y, 300) && finite(message.z, 300) && finite(message.yaw, 1000)) authority.pose(id, message.x, message.y, message.z, message.yaw);
            else if (message?.type === "hit") authority.hit(id);
            else if (message?.type === "act") authority.act(id);
            else if (message?.type === "start") authority.start(message.recipe);
            else if (message?.type === "change") authority.change(message.recipe);
            else if (message?.type === "ai") void authority.ask(id, message.text);
        });
        const leave = () => {
            sockets.delete(id);
            authority.leave(id);
        };
        ws.on("close", leave);
        ws.on("error", leave);
    });
    // Catch up when a timer fires late, but never more than a quarter second at once.
    let last = Date.now(),
        owed = 0,
        steps = 0;
    setInterval(() => {
        const now = Date.now();
        owed = Math.min(0.25, owed + (now - last) / 1000);
        last = now;
        while (owed >= STEP) {
            authority.step();
            owed -= STEP;
            // This page draws the other people from the zone's own frames; the lobby draws its own avatars.
            if (++steps % 3 === 0) {
                const people = authority.peopleFrame();
                if (people) sockets.forEach((ws) => sendFrames(ws, [people]));
            }
        }
    }, 8);
    http.listen(port, "127.0.0.1", () => {
        console.log(`Local play zone only: ws://127.0.0.1:${port}${playAuthorFromEnv() ? ", with a model for /ai" : ""}`);
        if (process.env.PLAY_DEV_RECIPE) follow(process.env.PLAY_DEV_RECIPE);
    });
}
main();
