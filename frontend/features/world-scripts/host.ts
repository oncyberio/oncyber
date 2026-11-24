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
 * reached through WorldScriptSink, which engineAdapter.ts implements.
 */
import {
    cleanOps,
    ThingProps,
    Vec3,
    WorldScriptOp,
    WORLD_SCRIPT_LIMITS,
    byteLength,
    HudCorner,
    SoundName,
} from "./protocol";
import {
    buildSandboxDocument,
    buildWorkerScript,
    WORLD_SCRIPT_SANDBOX,
} from "./sandboxDocument";

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
    /** A live edit landed (or was refused, with the reason). */
    onSwap?(result: SwapResult): void;
}

export type SwapMode = "keep" | "fresh";

/** `ok` with the mode and version that run now, or why not. */
export interface SwapResult {
    ok: boolean;
    mode?: SwapMode;
    version?: number;
    reason?: string;
}

/** Frames a new version must run cleanly before it replaces the old one. */
export const TRIAL_TICKS = 30;
const START_TIMEOUT_MS = 4000;
const KEEP_TIMEOUT_MS = 600;
const REWIND_GLIDE_S = 0.8;
const PLAYER_MOVE_GAP_MS = 500;

type Listener = (message: any) => void;

/** One running source in one frame. */
class Version {
    readonly frame: HTMLIFrameElement;
    private port: MessagePort | null = null;
    private listeners = new Set<Listener>();
    private ready: Promise<void>;
    awaitingTick = false;
    errors = 0;
    closed = false;

    constructor(container: HTMLElement, readonly source: string) {
        const frame = document.createElement("iframe");
        frame.setAttribute("sandbox", WORLD_SCRIPT_SANDBOX);
        frame.setAttribute("referrerpolicy", "no-referrer");
        frame.setAttribute("allow", "");
        frame.setAttribute("aria-hidden", "true");
        frame.tabIndex = -1;
        frame.title = "World script";
        Object.assign(frame.style, {
            position: "fixed",
            width: "0",
            height: "0",
            border: "0",
            left: "-10px",
            top: "-10px",
            visibility: "hidden",
            pointerEvents: "none",
        });
        frame.srcdoc = buildSandboxDocument();
        this.frame = frame;
        this.ready = new Promise((resolve, reject) => {
            const timer = setTimeout(
                () => reject(new Error("The script frame did not open.")),
                START_TIMEOUT_MS
            );
            frame.addEventListener(
                "load",
                () => {
                    if (this.closed) return;
                    const channel = new MessageChannel();
                    this.port = channel.port1;
                    channel.port1.onmessage = (event) => {
                        if (event.data?.t === "relay-ready") {
                            clearTimeout(timer);
                            resolve();
                            return;
                        }
                        this.listeners.forEach((listener) =>
                            listener(event.data)
                        );
                    };
                    // The frame's origin is opaque ("null"), so "*" is the
                    // only target that reaches it; the port is the channel.
                    frame.contentWindow?.postMessage({ t: "port" }, "*", [
                        channel.port2,
                    ]);
                },
                { once: true }
            );
        });
        container.appendChild(frame);
    }

    on(listener: Listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    send(message: unknown) {
        if (!this.closed) this.port?.postMessage(message);
    }

    async boot(start: Record<string, unknown>) {
        await this.ready;
        this.send({
            t: "boot",
            wrapped: buildWorkerScript(this.source),
            start,
        });
    }

    /** The script's keep() values, or nothing if it doesn't answer quickly. */
    kept(): Promise<Record<string, unknown>> {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                off();
                resolve({});
            }, KEEP_TIMEOUT_MS);
            const off = this.on((message) => {
                if (message?.t !== "kept") return;
                clearTimeout(timer);
                off();
                resolve(
                    message.kept && typeof message.kept === "object"
                        ? message.kept
                        : {}
                );
            });
            this.send({ t: "keep" });
        });
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        this.send({ t: "stop" });
        this.port?.close();
        this.frame.remove();
        this.listeners.clear();
    }
}

function cloneProps(props: ThingProps): ThingProps {
    return JSON.parse(JSON.stringify(props));
}

export class WorldScriptHost {
    private current: Version | null = null;
    private trial: Version | null = null;
    private table = new Map<string, ThingProps>();
    private versionCount = 0;
    private seq = 0;
    private pendingDt = 0;
    private time = 0;
    private startPosition: Vec3 | null = null;
    private lastPlayerMove = 0;
    private seed = 1;
    private disposed = false;

    constructor(
        private container: HTMLElement,
        private sink: WorldScriptSink,
        private events: WorldScriptEvents = {}
    ) {}

    get running() {
        return !!this.current;
    }

    get thingCount() {
        return this.table.size;
    }

    /** Starts a script from nothing (a visitor arriving, or Run). */
    async start(source: string): Promise<SwapResult> {
        this.stop();
        this.seed = (Math.random() * 2147483646 + 1) >>> 0;
        this.startPosition = this.sink.view().player.position;
        return this.swap(source, "fresh");
    }

    /** Rewinds the running script to the start of its round. */
    restart() {
        if (!this.current)
            return Promise.resolve<SwapResult>({
                ok: false,
                reason: "Nothing is running.",
            });
        return this.swap(this.current.source, "fresh");
    }

    /**
     * Replaces the running version with `source`. The new version runs a
     * trial first; if it fails, the old version keeps running.
     */
    async swap(source: string, mode: SwapMode): Promise<SwapResult> {
        if (this.disposed) return { ok: false, reason: "Closed." };
        if (byteLength(source) > WORLD_SCRIPT_LIMITS.maxSourceBytes)
            return this.refuse("The script is too long.");
        this.trial?.close();
        if (!this.current) this.events.onStatus?.({ state: "starting" });

        const kept =
            mode === "keep" && this.current ? await this.current.kept() : {};
        const carried: Record<string, ThingProps> = {};
        if (mode === "keep")
            this.table.forEach((props, id) => (carried[id] = props));

        const next = new Version(this.container, source);
        this.trial = next;
        const buffered: WorldScriptOp[] = [];
        let trialTicks = 0;
        let failure: string | null = null;
        let started = false;

        const outcome = await new Promise<SwapResult>((resolve) => {
            const timer = setTimeout(
                () => finish("The new version did not start in time."),
                START_TIMEOUT_MS
            );
            const finish = (reason: string | null) => {
                clearTimeout(timer);
                off();
                if (reason) {
                    next.close();
                    if (this.trial === next) this.trial = null;
                    resolve({ ok: false, reason });
                    return;
                }
                resolve({ ok: true, mode, version: 0 });
            };
            const off = next.on((message) => {
                if (this.trial !== next)
                    return finish("Replaced by a newer version.");
                switch (message?.t) {
                    case "error":
                        failure = String(message.text || "Error");
                        return finish(failure);
                    case "stopped":
                        return finish(String(message.reason || "Stopped."));
                    case "started":
                        started = true;
                        return;
                    case "ops": {
                        buffered.push(...cleanOps(message.ops).ops);
                        next.awaitingTick = false;
                        if (
                            started &&
                            message.seq >= 0 &&
                            ++trialTicks >= TRIAL_TICKS
                        )
                            finish(null);
                        return;
                    }
                }
            });
            next.boot({
                t: "start",
                mode,
                kept,
                things: carried,
                seed: this.seed,
                view: this.sink.view(),
                artworks: this.sink.artworks(),
            }).catch((error) => finish(error.message));
        });

        if (!outcome.ok) return this.refuse(outcome.reason);
        if (this.disposed || this.trial !== next) {
            next.close();
            return { ok: false, reason: "Closed." };
        }

        // The swap, between two frames.
        const previous = this.current;
        this.trial = null;
        this.current = next;
        previous?.close();
        this.listen(next);

        const added = new Set<string>();
        if (mode === "fresh") {
            this.sink.resetArtworks();
            this.sink.clearHud();
            this.sink.banner(null, 0);
            if (previous && this.startPosition)
                this.sink.movePlayer(this.startPosition);
        }
        const glide = mode === "fresh" && previous ? REWIND_GLIDE_S : 0;
        for (const op of buffered) {
            if (op.op === "add") added.add(op.id);
            this.apply(op, glide);
        }
        // Objects the new version doesn't make are gone.
        for (const id of [...this.table.keys()])
            if (!added.has(id)) {
                this.table.delete(id);
                this.sink.removeThing(id);
            }

        const version = ++this.versionCount;
        this.events.onStatus?.({ state: "running", version });
        const result: SwapResult = { ok: true, mode, version };
        this.events.onSwap?.(result);
        return result;
    }

    private refuse(reason: string): SwapResult {
        const result: SwapResult = { ok: false, reason };
        this.events.onLog?.("error", reason);
        this.events.onSwap?.(result);
        if (!this.current) this.events.onStatus?.({ state: "stopped", reason });
        return result;
    }

    private listen(version: Version) {
        version.on((message) => {
            if (version !== this.current) return;
            switch (message?.t) {
                case "ops": {
                    version.awaitingTick = false;
                    const { ops, dropped } = cleanOps(message.ops);
                    for (const op of ops) this.apply(op, 0);
                    if (dropped)
                        this.events.onLog?.(
                            "warn",
                            `${dropped} requests were refused this frame.`
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
                    void this.restart();
                    return;
            }
        });
    }

    private halt(reason: string) {
        this.current?.close();
        this.current = null;
        this.events.onLog?.("error", reason);
        this.events.onStatus?.({ state: "stopped", reason });
    }

    private apply(op: WorldScriptOp, glide: number) {
        const sink = this.sink;
        switch (op.op) {
            case "add": {
                if (this.table.has(op.id)) {
                    const merged = { ...this.table.get(op.id), ...op.props };
                    this.table.set(op.id, merged);
                    sink.setThing(op.id, op.props, glide);
                    return;
                }
                if (this.table.size >= WORLD_SCRIPT_LIMITS.maxThings) {
                    this.events.onLog?.(
                        "warn",
                        `A script can have ${WORLD_SCRIPT_LIMITS.maxThings} objects at once.`
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
            case "hud":
                sink.hud(op.key, op.text, op.corner);
                return;
            case "hud-clear":
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

    /** Called once per rendered frame with seconds since the last one. */
    frame(dt: number) {
        if (!this.current && !this.trial) return;
        this.pendingDt += dt;
        this.time += dt;
        const view = this.sink.view();
        for (const version of [this.current, this.trial]) {
            // A version still busy with the last frame skips this one; its
            // next tick carries the time it missed.
            if (!version || version.awaitingTick) continue;
            version.awaitingTick = true;
            version.send({
                t: "tick",
                seq: ++this.seq,
                dt: Math.min(this.pendingDt, 0.1),
                view,
            });
        }
        this.pendingDt = 0;
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

    stop() {
        this.trial?.close();
        this.trial = null;
        this.current?.close();
        this.current = null;
        for (const id of this.table.keys()) this.sink.removeThing(id);
        this.table.clear();
        this.sink.resetArtworks();
        this.sink.clearHud();
        this.sink.banner(null, 0);
        this.events.onStatus?.({ state: "idle" });
    }

    dispose() {
        this.stop();
        this.disposed = true;
    }
}
