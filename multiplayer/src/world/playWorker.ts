/**
 * The room's play zone, on a thread of its own. Physics steps 60 times a
 * second; on the main thread that would put a hitch into everyone's
 * packets, and inside a gateway worker it would only see that worker's
 * people. Here it reads every person's position straight from the shared
 * world, like any gateway does, and hands what it wants sent to the main
 * thread, which passes it to the gateways.
 *
 * In:  { type: "member", id, slot } | { type: "remove", id }
 *      { type: "request", actor, kind, admin, data }   from a gateway
 *      { type: "stop" }
 * Out: { type: "ready" }
 *      { type: "control", to: id | "all", event, data }
 *      { type: "frames", to: id | "all", except: [ids], frames }   datagrams, ready to send
 */
import { parentPort, workerData } from "worker_threads";
import { encodePlayFrame } from "../../protocol/lobby-v2";
import { loadPlayPhysics } from "./play";
import { playAuthorFromEnv } from "./playAuthor";
import { PlayAuthority } from "./playAuthority";
import { SharedWorld, SharedWorldData, blankPose } from "./shared";

const port = parentPort!,
    data = workerData as { shared: SharedWorldData; origin: { x: number; z: number }; open: boolean };
const world = new SharedWorld(data.shared);
/** Everyone in the room: id to the slot their position is written in. */
const members = new Map<number, number>();
const pose = blankPose(0);
const STEP = 1 / 60;

const wrap = (frames: Uint8Array[]) => frames.map((frame) => encodePlayFrame(frame));
const authority = new PlayAuthority(
    {
        control: (event, message) => port.postMessage({ type: "control", to: "all", event, data: message }),
        controlTo: (id, event, message) => port.postMessage({ type: "control", to: id, event, data: message }),
        frames: (frames, except) => port.postMessage({ type: "frames", to: "all", except: Array.from(except), frames: wrap(frames) }),
        framesTo: (id, frames) => port.postMessage({ type: "frames", to: id, except: [], frames: wrap(frames) }),
    },
    { origin: data.origin, author: playAuthorFromEnv() }
);

function request(message: { actor: number; kind: string; admin: boolean; data?: { text?: string; recipe?: unknown } }) {
    const { actor, kind } = message;
    if (!members.has(actor)) return;
    // Anyone may play. Changing the game is for admins, unless the room was opened to everyone.
    const may = message.admin || data.open;
    if (kind === "hello") authority.join(actor);
    else if (kind === "hit") authority.hit(actor);
    else if (kind === "act") authority.act(actor);
    else if (!may) port.postMessage({ type: "control", to: actor, event: "play-ai", data: { state: "failed", by: actor, text: "", say: "Only an admin can change the game here.", seconds: 0 } });
    else if (kind === "ai") void authority.ask(actor, message.data?.text);
    else if (kind === "start") authority.start(message.data?.recipe);
    else if (kind === "change") authority.change(message.data?.recipe);
    else if (kind === "stop") authority.stop();
}

port.on("message", (message: any) => {
    if (message.type === "member") members.set(message.id, message.slot);
    else if (message.type === "remove") {
        members.delete(message.id);
        authority.leave(message.id);
    } else if (message.type === "request") request(message);
    else if (message.type === "stop") process.exit(0);
});

loadPlayPhysics().then(() => {
    // Catch up when a timer fires late, but never more than a quarter second at once.
    let last = Date.now(),
        owed = 0;
    setInterval(() => {
        const now = Date.now();
        owed = Math.min(0.25, owed + (now - last) / 1000);
        last = now;
        while (owed >= STEP) {
            owed -= STEP;
            // Positions only matter while there is a game to stand in.
            if (authority.zone)
                for (const [id, slot] of members) {
                    pose.slot = slot;
                    if (world.read(slot, pose) && pose.id === id) authority.pose(id, pose.x, pose.y, pose.z, pose.yaw);
                }
            authority.step();
        }
    }, 8);
    port.postMessage({ type: "ready" });
});
