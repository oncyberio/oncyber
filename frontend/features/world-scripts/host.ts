/**
 * Runs world scripts in sandboxed frames and applies what they ask for.
 *
 * Each version of a script runs in its own frame (sandboxDocument.ts). A
 * live edit starts the new version beside the running one, lets it run a
 * short trial without showing anything, and swaps between two frames only
 * if it started cleanly. Otherwise the old version keeps running and the
 * error is reported. A swap either keeps the game as it is ("keep": the
 * new version gets the old one's `keep()` values and every object stays
 * where it is) or rewinds it ("fresh": artworks go back, objects glide to
 * their start, the player returns to where the round began).
 *
 * The host knows nothing about three.js: the scene and the interface are
 * reached through WorldScriptSink, which engineAdapter.ts implements. Nor
 * about frames: a version is opened through ./version, and what its trial
 * may do next is decided in ./trial.
 */
import {
    BUILT_FROM_KEYS,
    cleanOps,
    DoorInfo,
    SCARCE_SHAPES,
    ThingProps,
    Vec3,
    WorldScriptOp,
    WORLD_SCRIPT_LIMITS,
    byteLength,
    HudCorner,
    SoundName,
} from "./protocol";
import { watchSilence, type SilenceWatch } from "./silence";
import {
    trialOwes,
    trialSettled,
    trialTransition,
    TRIAL_FLOOD,
    TRIAL_REPLACED,
    type TrialEvent,
    type TrialFault,
    type TrialState,
} from "./trial";
import { FrameVersion, ScriptVersion } from "./version";

export { TRIAL_TICKS } from "./trial";

export interface WorldView {
    player: { position: Vec3; forward: Vec3; yaw: number };
    camera: { position: Vec3; forward: Vec3 };
}

export interface ArtworkInfo {
    id: string;
    name: string;
    type: string;
    position: Vec3;
    rotation: Vec3;
    scale: Vec3;
    visible: boolean;
}

export interface WorldScriptSink {
    view(): WorldView;
    artworks(): ArtworkInfo[];
    addThing(id: string, props: ThingProps): void;
    /** `glide` animates the change of transform over that many seconds. */
    setThing(id: string, props: ThingProps, glide?: number): void;
    removeThing(id: string): void;
    setArtwork(id: string, props: Partial<ArtworkInfo>): void;
    resetArtworks(): void;
    /** The world's own doors, and how far each stands open. */
    doors(): DoorInfo[];
    /** Swings a door: 0 shut, 1 fully open. A portal's door is left alone. */
    setDoor(id: string, open: number): void;
    resetDoors(): void;
    movePlayer(position: Vec3): void;
    hud(key: string, text: string | null, corner: HudCorner): void;
    clearHud(): void;
    toast(text: string, seconds: number): void;
    banner(text: string | null, seconds: number): void;
    sound(name: SoundName, volume: number): void;
}

export type WorldScriptStatus =
    | { state: "idle" }
    | { state: "starting" }
    | { state: "running"; version: number }
    | { state: "stopped"; reason: string };

export interface WorldScriptEvents {
    onStatus?(status: WorldScriptStatus): void;
    onLog?(level: "log" | "warn" | "error", text: string): void;
    /** A version that came with a style of its own was swapped in. */
    onStyle?(style: unknown): void;
}

export type SwapMode = "keep" | "fresh";

/** `ok` with the mode and version that run now, or why not. */
export interface SwapResult {
    ok: boolean;
    mode?: SwapMode;
    version?: number;
    reason?: string;
    /**
     * Whose fault a refusal is. Only a "script" one is worth another try by
     * whoever wrote it; a "world" one says nothing about the script.
     */
    fault?: TrialFault;
}

/** Opens a version of `source`; a test hands in one without a frame. */
export type OpenVersion = (source: string) => ScriptVersion;

/**
 * How long a new version may say nothing while it owes an answer (its
 * start, or a frame it was sent) before it is given up on. Not a limit on
 * the trial as a whole: that is counted in the world's frames, and a slow
 * device or a tab in the background draws few (./silence).
 */
const START_TIMEOUT_MS = 4000;
const REWIND_GLIDE_S = 0.8;
const PLAYER_MOVE_GAP_MS = 500;
const CLOSED = "Closed.";

function cloneProps(props: ThingProps): ThingProps {
    return JSON.parse(JSON.stringify(props));
}

/**
 * Whether a thing made again under an id it already has must be built from
 * nothing: it is another shape now, or is no longer built from something it
 * was (a size, an outline). Otherwise it is the same thing with new values.
 */
function remade(existing: ThingProps, props: ThingProps) {
    return (
        existing.shape !== props.shape ||
        BUILT_FROM_KEYS.some(
            (key) => existing[key] !== undefined && props[key] === undefined
        )
    );
}

export class WorldScriptHost {
    private current: ScriptVersion | null = null;
    private trial: ScriptVersion | null = null;
    private table = new Map<string, ThingProps>();
    /** The HUD lines on show: a swap takes away what the new version drops. */
    private hudKeys = new Set<string>();
    private versionCount = 0;
    private swaps = 0;
    private seq = 0;
    private startPosition: Vec3 | null = null;
    private lastPlayerMove = 0;
    private seed = 1;
    private disposed = false;
    private open: OpenVersion;
    /** The world's creative direction, handed to each version as world.style. */
    style: unknown = null;

    constructor(
        container: HTMLElement | null,
        private sink: WorldScriptSink,
        private events: WorldScriptEvents = {},
        open?: OpenVersion
    ) {
        this.open = open || ((source) => new FrameVersion(container, source));
    }

    get running() {
        return !!this.current;
    }

    /** Starts a script from nothing (a visitor arriving, or Run). */
    async start(source: string, style?: unknown): Promise<SwapResult> {
        this.stop();
        this.seed = (Math.random() * 2147483646 + 1) >>> 0;
        this.startPosition = this.sink.view().player.position;
        return this.swap(source, "fresh", style);
    }

    /** Rewinds the running script to the start of its round. */
    restart() {
        if (!this.current)
            return Promise.resolve<SwapResult>({
                ok: false,
                reason: "Nothing is running.",
                fault: "world",
            });
        return this.swap(this.current.source, "fresh");
    }

    /**
     * Replaces the running version with `source`. The new version runs a
     * trial first; if it fails, the old version keeps running. A `style`
     * given with it is the world's only once the version has landed.
     */
    async swap(
        source: string,
        mode: SwapMode,
        style?: unknown
    ): Promise<SwapResult> {
        if (this.disposed) return { ok: false, reason: CLOSED, fault: "world" };
        if (byteLength(source) > WORLD_SCRIPT_LIMITS.maxSourceBytes)
            return this.refuse("The script is too long.", "script");
        const asked = ++this.swaps;
        this.closeTrial();
        if (!this.current) this.events.onStatus?.({ state: "starting" });

        const kept =
            mode === "keep" && this.current ? await this.current.kept() : {};
        // While it answered, the world closed or a newer version was asked
        // for: this one gives way.
        if (this.disposed) return { ok: false, reason: CLOSED, fault: "world" };
        if (asked !== this.swaps)
            return this.refuse(TRIAL_REPLACED, "world", true);
        const carried: Record<string, ThingProps> = {};
        if (mode === "keep")
            this.table.forEach((props, id) => (carried[id] = props));

        const next = this.open(source);
        this.trial = next;
        const buffered: WorldScriptOp[] = [];
        const outcome = await this.runTrial(
            next,
            {
                t: "start",
                mode,
                kept,
                things: carried,
                seed: this.seed,
                view: this.sink.view(),
                style: style === undefined ? this.style : style,
                artworks: this.sink.artworks(),
                doors: this.sink.doors(),
            },
            buffered
        );

        if (outcome.phase === "failed") {
            next.close();
            if (this.trial === next) this.trial = null;
            return this.refuse(outcome.reason, outcome.fault, outcome.closed);
        }
        if (this.disposed || this.trial !== next) {
            next.close();
            return { ok: false, reason: CLOSED, fault: "world" };
        }

        // The swap, between two frames.
        const previous = this.current;
        this.trial = null;
        this.current = next;
        previous?.close();
        this.listen(next);
        if (style !== undefined) {
            this.style = style;
            this.events.onStyle?.(style);
        }

        const added = new Set<string>();
        const shown = new Set<string>();
        if (mode === "fresh") {
            this.sink.resetArtworks();
            this.sink.resetDoors();
            this.hudKeys.clear();
            this.sink.clearHud();
            this.sink.banner(null, 0);
            if (previous && this.startPosition)
                this.sink.movePlayer(this.startPosition);
        }
        const glide = mode === "fresh" && previous ? REWIND_GLIDE_S : 0;
        for (const op of buffered) {
            if (op.op === "add") added.add(op.id);
            else if (op.op === "hud-clear") shown.clear();
            else if (op.op === "hud" && op.text == null) shown.delete(op.key);
            else if (op.op === "hud") shown.add(op.key);
            this.apply(op, glide);
        }
        // Objects the new version doesn't make are gone, and so are the
        // HUD lines it doesn't show.
        for (const id of [...this.table.keys()])
            if (!added.has(id)) {
                this.table.delete(id);
                this.sink.removeThing(id);
            }
        for (const key of [...this.hudKeys])
            if (!shown.has(key)) {
                this.hudKeys.delete(key);
                this.sink.hud(key, null, "top-left");
            }

        const version = ++this.versionCount;
        this.events.onStatus?.({ state: "running", version });
        return { ok: true, mode, version };
    }

    /**
     * Opens `next`, asks it to start and follows its trial (./trial) to the
     * end. What it asks for meanwhile is kept in `buffered`, not shown.
     */
    private runTrial(
        next: ScriptVersion,
        start: Record<string, unknown>,
        buffered: WorldScriptOp[]
    ) {
        return new Promise<TrialState>((resolve) => {
            let state: TrialState = { phase: "opening" };
            // From the moment it is asked to start: quiet for too long
            // while it owes its start or the answer to a frame.
            let watch: SilenceWatch | null = null;
            const step = (event: TrialEvent) => {
                const before = state;
                state = trialTransition(state, event);
                if (state === before || !trialSettled(state)) return;
                watch?.stop();
                off();
                gone();
                resolve(state);
            };
            const off = next.on((message) => {
                watch?.heard();
                if (this.flooding(next)) return step({ type: "flood" });
                switch (message?.t) {
                    case "error":
                        return step({
                            type: "error",
                            text: String(message.text || "Error"),
                        });
                    case "stopped":
                        return step({
                            type: "stopped",
                            reason: String(message.reason || "Stopped."),
                        });
                    case "started":
                        return step({ type: "started" });
                    case "ops":
                        buffered.push(...this.take(next, message.ops).ops);
                        next.awaitingTick = false;
                        return step({ type: "ops", seq: Number(message.seq) });
                }
            });
            // Closed from outside (a newer version, a stop, the end): it
            // will never be heard again, so the trial ends here.
            const gone = next.onClosed(() => step({ type: "closed" }));
            next.boot(start).then(
                () => {
                    step({ type: "booted" });
                    if (trialSettled(state)) return;
                    watch = watchSilence(
                        START_TIMEOUT_MS,
                        () => step({ type: "silent" }),
                        () => trialOwes(state, next.awaitingTick)
                    );
                },
                (error) =>
                    step({
                        type: "unopened",
                        reason: String(error?.message || error),
                    })
            );
        });
    }

    /** Why not, for whoever asked. Said to the world only when it matters. */
    private refuse(
        reason: string,
        fault: TrialFault,
        quiet = false
    ): SwapResult {
        if (!quiet && !this.current)
            this.events.onStatus?.({ state: "stopped", reason });
        return { ok: false, reason, fault };
    }

    private closeTrial() {
        const trial = this.trial;
        this.trial = null;
        trial?.close();
    }

    /** More messages since the last frame than any script needs to send. */
    private flooding(version: ScriptVersion) {
        return ++version.heard > WORLD_SCRIPT_LIMITS.maxMessagesPerFrame;
    }

    /** A batch, checked, out of what the version may still ask this frame. */
    private take(version: ScriptVersion, raw: unknown) {
        const result = cleanOps(raw, version.budget);
        if (Array.isArray(raw))
            version.budget -= Math.min(raw.length, version.budget);
        return result;
    }

    private listen(version: ScriptVersion) {
        version.on((message) => {
            if (version !== this.current) return;
            if (this.flooding(version)) return this.halt(TRIAL_FLOOD);
            switch (message?.t) {
                case "ops": {
                    version.awaitingTick = false;
                    const { ops, dropped } = this.take(version, message.ops);
                    for (const op of ops) this.apply(op, 0);
                    if (dropped)
                        this.events.onLog?.(
                            "warn",
                            "Some requests were refused: a script can make " +
                                `${WORLD_SCRIPT_LIMITS.maxOpsPerTick} a frame.`
                        );
                    return;
                }
                case "error": {
                    this.events.onLog?.(
                        "error",
                        String(message.text || "Error")
                    );
                    if (
                        message.fatal ||
                        ++version.errors >= WORLD_SCRIPT_LIMITS.maxErrors
                    )
                        this.halt(
                            "The script kept failing, so it was stopped."
                        );
                    return;
                }
                case "stopped":
                    return this.halt(String(message.reason || "Stopped."));
                case "restart":
                    // Asked again while a version is on its way (its own
                    // rewind, or an edit that replaces it): once is enough.
                    if (!this.trial) void this.restart();
                    return;
            }
        });
    }

    /** The script is over, by its own doing: what it made goes with it. */
    private halt(reason: string) {
        this.current?.close();
        this.current = null;
        this.clearWorld();
        this.events.onLog?.("error", reason);
        this.events.onStatus?.({ state: "stopped", reason });
    }

    /** Everything a script put in the world or on screen, taken back. */
    private clearWorld() {
        for (const id of this.table.keys()) this.sink.removeThing(id);
        this.table.clear();
        this.hudKeys.clear();
        this.sink.resetArtworks();
        this.sink.resetDoors();
        this.sink.clearHud();
        this.sink.banner(null, 0);
    }

    private apply(op: WorldScriptOp, glide: number) {
        const sink = this.sink;
        switch (op.op) {
            case "add": {
                const existing = this.table.get(op.id);
                if (existing && !remade(existing, op.props)) {
                    this.table.set(op.id, { ...existing, ...op.props });
                    sink.setThing(op.id, op.props, glide);
                    return;
                }
                // Another thing under an id in use: the old one goes first,
                // and the new one is counted like any other.
                if (existing) {
                    this.table.delete(op.id);
                    sink.removeThing(op.id);
                }
                if (this.table.size >= WORLD_SCRIPT_LIMITS.maxThings) {
                    this.events.onLog?.(
                        "warn",
                        `A script can have ${WORLD_SCRIPT_LIMITS.maxThings} objects at once.`
                    );
                    return;
                }
                const few = SCARCE_SHAPES[op.props.shape];
                if (few !== undefined && this.count(op.props.shape) >= few) {
                    this.events.onLog?.(
                        "warn",
                        `A script can have ${few} of "${op.props.shape}" at once.`
                    );
                    return;
                }
                this.table.set(op.id, cloneProps(op.props));
                sink.addThing(op.id, op.props);
                return;
            }
            case "set": {
                const existing = this.table.get(op.id);
                if (!existing) return;
                this.table.set(op.id, { ...existing, ...op.props });
                sink.setThing(op.id, op.props, glide);
                return;
            }
            case "remove":
                if (this.table.delete(op.id)) sink.removeThing(op.id);
                return;
            case "artwork":
                sink.setArtwork(op.id, op.props);
                return;
            case "door":
                sink.setDoor(op.id, op.open);
                return;
            case "hud":
                if (op.text == null) this.hudKeys.delete(op.key);
                else this.hudKeys.add(op.key);
                sink.hud(op.key, op.text, op.corner);
                return;
            case "hud-clear":
                this.hudKeys.clear();
                sink.clearHud();
                return;
            case "toast":
                sink.toast(op.text, op.seconds);
                return;
            case "banner":
                sink.banner(op.text, op.seconds);
                return;
            case "sound":
                sink.sound(op.name, op.volume);
                return;
            case "player": {
                const now = Date.now();
                if (now - this.lastPlayerMove < PLAYER_MOVE_GAP_MS) return;
                this.lastPlayerMove = now;
                sink.movePlayer(op.position);
                return;
            }
            case "log":
                this.events.onLog?.(op.level, op.text);
                return;
        }
    }

    private count(shape: ThingProps["shape"]) {
        let count = 0;
        this.table.forEach((props) => {
            if (props.shape === shape) count++;
        });
        return count;
    }

    /** Called once per rendered frame with seconds since the last one. */
    frame(dt: number) {
        if (!this.current && !this.trial) return;
        const view = this.sink.view();
        for (const version of [this.current, this.trial]) {
            if (!version) continue;
            version.pendingDt += dt;
            version.heard = 0;
            version.budget = WORLD_SCRIPT_LIMITS.maxOpsPerTick;
            // A version still busy with the last frame skips this one; its
            // next tick carries the time it missed (as far as a tick may).
            if (version.awaitingTick) continue;
            version.awaitingTick = true;
            version.send({
                t: "tick",
                seq: ++this.seq,
                dt: Math.min(version.pendingDt, 0.1),
                view,
            });
            version.pendingDt = 0;
        }
    }

    key(down: boolean, key: string, code: string) {
        const message = {
            t: "key",
            down,
            key: key.slice(0, 20),
            code: code.slice(0, 30),
        };
        this.current?.send(message);
        this.trial?.send(message);
    }

    click(hit: { thing?: string; artwork?: string; point?: Vec3 }) {
        this.current?.send({ t: "click", ...hit });
    }

    /** Gives up on a version still on trial; what runs keeps running. */
    abandon() {
        if (!this.trial) return;
        this.closeTrial();
        if (!this.current) this.events.onStatus?.({ state: "idle" });
    }

    stop() {
        this.closeTrial();
        this.current?.close();
        this.current = null;
        this.clearWorld();
        this.events.onStatus?.({ state: "idle" });
    }

    dispose() {
        this.stop();
        this.disposed = true;
    }
}
