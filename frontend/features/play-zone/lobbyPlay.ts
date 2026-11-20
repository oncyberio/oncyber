import {
    readPlayAction,
    type PlayAction,
} from "../../../multiplayer/protocol/play-action";
import {
    decodeBodies,
    playBodies,
    readPlayRecipe,
    type PlayRecipe,
} from "../../../multiplayer/protocol/play-zone";
import { poseBuffers, smoothPoses, type PoseBuffers } from "./smoothing";

/** Where a room's play zone is, and from how far its things are sent. */
export interface PlayPlace {
    origin: { x: number; z: number };
    radius: number;
}

/**
 * What a lobby visitor knows about the room's play zone: the game in play,
 * where its things are, and what the model last said. The lobby's
 * connection feeds it (control messages and frames); the scene draws from
 * it; the chat shows its lines. It holds no three.js and no network.
 */
export class LobbyPlay {
    /** Null on a server without a play zone. */
    place: PlayPlace | null = null;
    recipe: PlayRecipe | null = null;
    /** Goes up each time the recipe changes, so a scene knows to rebuild. */
    revision = 0;
    poses: PoseBuffers = poseBuffers(0);
    rewinding = false;
    score: [number, number] = [0, 0];
    secondsLeft = 0;
    /** The move a hit plays, once someone has asked for one. */
    action: PlayAction | null = null;
    /** People mid-swing: who, and when it began (performance.now). */
    readonly swings = new Map<number, number>();
    /** A line for the chat: what the model is doing or did. */
    onLine: (text: string) => void = () => {};

    /** The room's welcome said whether it has a zone. */
    welcome(place: unknown) {
        const value = place as PlayPlace | null;
        const ok =
            !!value &&
            Number.isFinite(value.origin?.x) &&
            Number.isFinite(value.origin?.z) &&
            Number.isFinite(value.radius);
        this.place = ok
            ? {
                  origin: { x: value.origin.x, z: value.origin.z },
                  radius: value.radius,
              }
            : null;
        this.clear();
    }
    private clear() {
        if (this.recipe) this.revision++;
        this.recipe = null;
        this.poses = poseBuffers(0);
        this.rewinding = false;
        this.swings.clear();
    }

    /** One of the zone's control messages (see world/playAuthority.ts). */
    control(event: string, data: any) {
        if (!this.place || !data) return;
        if (event === "play-game") {
            const recipe = readPlayRecipe(data.recipe);
            if (!recipe) return;
            // Only a new round starts from nothing. A change keeps every
            // shared thing where it is drawn.
            const fresh = !this.recipe || data.change === "start";
            this.poses = poseBuffers(
                playBodies(recipe).length,
                fresh ? null : this.poses
            );
            this.recipe = recipe;
            this.revision++;
            this.rewinding = false;
            if (fresh) {
                this.score = [0, 0];
                this.secondsLeft = recipe.seconds;
            }
        } else if (event === "play-rewind") this.rewinding = true;
        else if (event === "play-state") {
            if (Array.isArray(data.score))
                this.score = [
                    Number(data.score[0]) || 0,
                    Number(data.score[1]) || 0,
                ];
            this.secondsLeft = Number(data.secondsLeft) || 0;
            if (data.done) this.clear();
        } else if (event === "play-act") {
            if (Number.isFinite(data.id))
                this.swings.set(data.id, performance.now());
        } else if (event === "play-action")
            this.action = readPlayAction(data.action) || this.action;
        else if (event === "play-ai") this.onLine(aiLine(data));
    }

    /** One frame of thing poses, already unwrapped from its datagram. */
    frame(bytes: Uint8Array) {
        const read = decodeBodies(bytes, this.poses.target);
        if (!read) return;
        for (const index of read.indices)
            if (!this.poses.known[index]) this.poses.known[index] = 1;
    }

    /** Eases the drawn things towards where the server last put them. */
    update(seconds: number) {
        smoothPoses(
            this.poses.shown,
            this.poses.target,
            this.poses.known,
            seconds,
            this.rewinding ? Infinity : undefined
        );
    }
}

/** What to show in the chat for one message about a request to the model. */
export function aiLine(data: {
    state?: string;
    text?: string;
    say?: string;
    seconds?: number;
    change?: string | null;
}) {
    const say = String(data.say || "").slice(0, 200);
    if (data.state === "thinking")
        return `Thinking about “${String(data.text || "").slice(0, 120)}”…`;
    if (data.state === "done")
        return `${say} (${Number(data.seconds) || 0} s${
            data.change === "reset"
                ? ", after a rewind"
                : data.change === "live"
                ? ", in place"
                : ""
        })`;
    return `Could not do that: ${say}`;
}

/** The request in a chat line that starts with /ai, or null for ordinary chat. */
export function aiRequest(text: string) {
    const match = /^\/ai(?:\s+([\s\S]*))?$/i.exec(text.trim());
    return match ? (match[1] || "").trim() : null;
}
