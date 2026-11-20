/**
 * Runs the play zone for a room, whatever carries its messages: the lobby's
 * world server and the local play server both hand it people's positions
 * and requests, and send out what it emits.
 *
 * It owns one zone at a fixed place in the room. People inside the arena
 * are part of the game; everyone is told about it. A typed request goes to
 * a language model (playAuthor.ts) and comes back as a recipe, an action
 * or both; a recipe that fits the game in play takes over in place, and one
 * that does not plays the round backwards to its start first.
 *
 * Out, as control messages to everyone:
 *   play-game   { recipe, seed, change: "start" | "live" | "reset", origin }
 *   play-rewind { seconds }
 *   play-state  { score, secondsLeft, people, stepMs, done }
 *   play-act    { id }                    a person swings
 *   play-action { action }                the move a hit plays from now on
 *   play-ai     { state: "thinking" | "done" | "failed", by, text, say, seconds }
 * and binary frames from ../../protocol/play-zone, in the zone's own space
 * (add `origin` to place them in the room).
 */
import { PlayAction } from "../../protocol/play-action";
import { PlayPerson, PlayRecipe, encodePeople, readPlayRecipe } from "../../protocol/play-zone";
import { PLAY_STEP, PlayZone } from "./play";
import { PlayAnswer, PlayAuthorConfig, askPlay, readPlayRequest } from "./playAuthor";

/** Steps between sends: 60 Hz physics, 20 Hz frames. */
const SEND_EVERY = 3;
/** However long the round was, a rewind lasts about this long. */
export const PLAY_REWIND_SECONDS = 2.5;
/** One person may ask the model this often; the room as a whole, one request at a time. */
export const PLAY_ASK_COOLDOWN_MS = 5000;

export interface PlayOutput {
    /** A control message for everyone in the room. */
    control(type: string, data: unknown): void;
    /** A control message for one person (someone who has just arrived). */
    controlTo(id: number, type: string, data: unknown): void;
    /** Frames for everyone except the people named, who are owed everything instead. */
    frames(frames: Uint8Array[], except: ReadonlySet<number>): void;
    framesTo(id: number, frames: Uint8Array[]): void;
}
export interface PlayAuthorityOptions {
    /** Where the zone's centre is in the room. */
    origin?: { x: number; z: number };
    /** The model to ask, or null when the server has none. */
    author?: PlayAuthorConfig | null;
    /** For tests: stands in for the model. */
    ask?: (text: string, current: PlayRecipe | null) => Promise<PlayAnswer>;
    now?: () => number;
}

export class PlayAuthority {
    zone: PlayZone | null = null;
    readonly origin: { x: number; z: number };
    /** The move a hit plays, once someone has asked for one. */
    action: PlayAction | null = null;
    /** A slow average of what one step costs, in milliseconds. */
    stepMs = 0;
    private seed = 1;
    private clock = 0;
    /** During a rewind: the recipe that takes over at the start, and how many samples to go back each send. */
    private pending: { recipe: PlayRecipe; stride: number } | null = null;
    /** Everyone in the room, with where they are in the room's space. */
    private people = new Map<number, PlayPerson>();
    /** People still owed every thing's pose. */
    private fresh = new Set<number>();
    private asking = false;
    private askedAt = new Map<number, number>();
    private now: () => number;

    constructor(private out: PlayOutput, private options: PlayAuthorityOptions = {}) {
        this.origin = options.origin || { x: 0, z: 0 };
        this.now = options.now || Date.now;
    }

    /** Someone arrived in the room: tell them what is going on. */
    join(id: number) {
        this.fresh.add(id);
        if (this.zone) this.out.controlTo(id, "play-game", this.game("start"));
        if (this.pending) this.out.controlTo(id, "play-rewind", { seconds: PLAY_REWIND_SECONDS });
        if (this.action) this.out.controlTo(id, "play-action", { action: this.action });
    }
    leave(id: number) {
        this.people.delete(id);
        this.fresh.delete(id);
        this.askedAt.delete(id);
        this.zone?.removePerson(id);
    }
    /** Where a person is, in the room's space. */
    pose(id: number, x: number, y: number, z: number, yaw: number) {
        const person = this.people.get(id);
        if (person) {
            person.x = x;
            person.y = y;
            person.z = z;
            person.yaw = yaw;
        } else this.people.set(id, { id, x, y, z, yaw });
    }

    private game(change: "start" | "live" | "reset") {
        return { recipe: this.zone!.recipe, seed: this.seed, change, origin: this.origin };
    }
    private begin(recipe: PlayRecipe, change: "start" | "reset") {
        this.zone?.free();
        // A reset keeps the seed: the new round starts where the rewind ended.
        if (change === "start") this.seed++;
        this.zone = new PlayZone(recipe, this.seed);
        this.pending = null;
        for (const id of this.people.keys()) this.fresh.add(id);
        this.out.control("play-game", this.game(change));
    }

    /** A new round. */
    start(value: unknown) {
        const recipe = readPlayRecipe(value);
        if (recipe) this.begin(recipe, "start");
        return !!recipe;
    }
    /** A new recipe for the round in play: in place when it fits, after a rewind when it does not. */
    change(value: unknown): "invalid" | "start" | "same" | "live" | "reset" {
        const recipe = readPlayRecipe(value);
        if (!recipe) return "invalid";
        if (!this.zone) {
            this.begin(recipe, "start");
            return "start";
        }
        if (this.pending) {
            // Already rewinding: the latest recipe wins when the start is reached.
            this.pending.recipe = recipe;
            return "reset";
        }
        const plan = this.zone.plan(recipe);
        if (plan === "live") {
            this.zone.apply(recipe);
            this.out.control("play-game", this.game("live"));
        } else if (plan === "reset") {
            const samples = this.zone.beginRewind();
            this.pending = { recipe, stride: Math.max(1, Math.ceil(samples / (PLAY_REWIND_SECONDS * (60 / SEND_EVERY)))) };
            this.out.control("play-rewind", { seconds: PLAY_REWIND_SECONDS });
        }
        return plan;
    }
    /** Ends the game and clears the zone. */
    stop() {
        if (!this.zone) return;
        this.zone.free();
        this.zone = null;
        this.pending = null;
        this.out.control("play-state", { score: [0, 0], secondsLeft: 0, people: 0, stepMs: 0, done: true });
    }

    hit(id: number) {
        return this.zone?.hit(id) || 0;
    }
    /** A swing is shown on every screen; the hit itself arrives at its contact. */
    act(id: number) {
        if (this.zone && !this.pending) this.out.control("play-act", { id });
    }

    /**
     * A typed request for the model. Refused with a reason when there is no
     * model, when one request is already out, or when this person asked a
     * moment ago. The answer is applied to the game in play.
     */
    async ask(id: number, value: unknown) {
        const text = readPlayRequest(value);
        const refuse = (say: string) => this.out.controlTo(id, "play-ai", { state: "failed", by: id, text, say, seconds: 0 });
        const ask = this.options.ask || (this.options.author ? (request: string, current: PlayRecipe | null) => askPlay(request, current, this.options.author!) : null);
        if (!text) return refuse("Type what you want after /ai.");
        if (!ask) return refuse("This server has no model to ask.");
        if (this.asking) return refuse("Another request is being worked on. Try again in a moment.");
        const started = this.now();
        if (started - (this.askedAt.get(id) ?? -Infinity) < PLAY_ASK_COOLDOWN_MS) return refuse("Give it a few seconds between requests.");
        this.asking = true;
        this.askedAt.set(id, started);
        this.out.control("play-ai", { state: "thinking", by: id, text, say: "", seconds: 0 });
        const seconds = () => Math.round((this.now() - started) / 100) / 10;
        try {
            // The model sees the recipe that will be in play once any rewind finishes.
            const answer = await ask(text, this.pending?.recipe || this.zone?.recipe || null);
            if (answer.action) {
                this.action = answer.action;
                this.out.control("play-action", { action: answer.action });
            }
            const change = answer.recipe ? this.change(answer.recipe) : null;
            this.out.control("play-ai", { state: "done", by: id, text, say: answer.say, change, action: !!answer.action, seconds: seconds() });
        } catch (error) {
            this.out.control("play-ai", { state: "failed", by: id, text, say: (error as Error).message.slice(0, 160), seconds: seconds() });
        } finally {
            this.asking = false;
        }
    }

    /** One sixtieth of a second. Call it 60 times a second. */
    step() {
        this.clock++;
        const zone = this.zone;
        if (!zone) return;
        if (this.pending) {
            if (this.clock % SEND_EVERY === 0) this.rewind();
            return;
        }
        // Only the people standing in the arena are part of the game.
        const { halfX, halfZ } = zone.recipe.arena;
        for (const person of this.people.values()) {
            const x = person.x - this.origin.x,
                z = person.z - this.origin.z;
            if (Math.abs(x) <= halfX + 1 && Math.abs(z) <= halfZ + 1) zone.setPerson(person.id, x, person.y, z, person.yaw);
            else zone.removePerson(person.id);
        }
        const before = process.hrtime.bigint();
        zone.step();
        this.stepMs += (Number(process.hrtime.bigint() - before) / 1e6 - this.stepMs) * 0.05;
        if (zone.tick % SEND_EVERY) return;
        if (this.fresh.size) {
            const everything = zone.fullFrames();
            for (const id of this.fresh) this.out.framesTo(id, everything);
        }
        this.out.frames(zone.frames(), this.fresh);
        this.fresh.clear();
        if (zone.tick % 30 === 0 || zone.done) this.out.control("play-state", { score: zone.score(), secondsLeft: Math.ceil(zone.stepsLeft * PLAY_STEP), people: this.people.size, stepMs: +this.stepMs.toFixed(2), done: zone.done });
        if (zone.done) {
            zone.free();
            this.zone = null;
        }
    }

    private rewind() {
        const zone = this.zone!,
            moment = zone.rewindFrames(this.pending!.stride);
        if (!moment) return this.begin(this.pending!.recipe, "reset");
        // Where the people were, for whoever shows them walking back.
        this.out.frames([...moment.frames, encodePeople(zone.tick, moment.people)], new Set());
    }

    /** People in the arena right now, in the zone's own space. */
    peopleFrame() {
        return this.zone ? this.zone.peopleFrame() : null;
    }

    free() {
        this.zone?.free();
        this.zone = null;
    }
}
