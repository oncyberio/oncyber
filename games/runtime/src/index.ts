/**
 * The Oncyber game lifecycle: the one optional contract a game module can
 * implement so the page can prepare it in the background, travel into it,
 * pause it, check it and swap it. No DOM or three.js imports: games bring
 * their own renderer. See docs/games.md.
 */

/** One declared input action and its default bindings. */
export interface InputBinding {
    keyboard?: string[];
    touch?: string;
    gamepad?: string;
}
/** The `runtime` block of a game's game.json. */
export interface GameManifest {
    profile: "portable-v1";
    version: string;
    platforms?: string[];
    entries?: Record<string, string>;
    capabilities: string[];
    /** The only files `services.asset()` hands out. */
    assets: string[];
    input: Record<string, InputBinding>;
}

export type Json = null | string | number | boolean | Json[] | { [key: string]: Json };
export type Vec3 = [number, number, number];
export interface Continuity {
    avatar: { id: string; asset?: string; position: Vec3; rotation: [number, number, number, number] };
    camera: { position: Vec3; target: Vec3; fov: number; mode: string };
    party: Array<{ id: string; position: Vec3; rotation: [number, number, number, number] }>;
}
export type Phase = "created" | "preparing" | "ready" | "entered" | "suspended" | "failed" | "disposed";
export interface GraphicsSurface {
    /** Browser canvas or a tested native canvas adapter, never an HTML UI element. */
    canvas: unknown;
    context?: unknown;
    device?: unknown;
    width: number;
    height: number;
    pixelRatio: number;
    /** Encoded PNG/JPEG bytes -> host image source. Game modules never create Blob URLs. */
    decodeImage?(bytes: ArrayBuffer, mimeType: string): Promise<unknown>;
    /** Host-owned decoder. Frames stay in the graphics realm, never the JSON UI bridge. */
    openVideo?(asset: string): Promise<{
        width: number; height: number;
        frame(): unknown | null;
        setVolume?(volume: number): void;
        play(): void; pause(): void; close(): void;
    }>;
}
export interface HostServices {
    identity: { id: string; name: string; avatar?: string };
    /** Only this release's declared files; host resolves paths and validates hashes. */
    asset(path: string, signal: AbortSignal): Promise<ArrayBuffer>;
    /** Permission-checked operations. Raw host credentials never enter game code or its UI. */
    call(capability: string, operation: string, value: Json, signal: AbortSignal): Promise<Json>;
    /**
     * Avatar model bytes (a VRM or GLB) for a ref the host vouches for: the
     * visitor's own avatar or one of the players it announced to this game.
     * Needs the "avatar" capability. Never an arbitrary URL fetch.
     */
    avatar?(ref: string, signal: AbortSignal): Promise<ArrayBuffer>;
}
/** Largest avatar the runtime passes to game code. */
export const AVATAR_MAX_BYTES = 32 * 1024 * 1024;
export interface GameContext {
    graphics: GraphicsSurface;
    services: HostServices;
    signal: AbortSignal;
    input: Readonly<Record<string, number>>;
    /** Relative input accumulated since the previous update, consumed exactly once. */
    deltas: Readonly<Record<string, number>>;
    /** Rising edges survive a press/release between rendered frames. Cleared after update. */
    pressed: Readonly<Record<string, boolean>>;
    ui: { publish(value: Json): void };
    /** Call during prepare(): 0..1 and a short label the page shows while it waits. See loading.ts. */
    loading: { progress(value: number, label?: string): void };
}
export interface PortableGame {
    prepare(): Promise<void>;
    enter(continuity: Continuity): Promise<void> | void;
    update(seconds: number): void;
    suspend(): Promise<Json> | Json;
    restore(snapshot: Json): Promise<void> | void;
    dispose(): Promise<void> | void;
    /** Game-specific scenario assertions; independent host checks still always run. */
    inspect(): Record<string, Json>;
}
export type GameFactory = (context: GameContext) => PortableGame;
export interface RuntimeOptions {
    manifest: GameManifest;
    graphics: GraphicsSurface;
    services: HostServices;
    sendUI(value: Json): void;
    /** Where `context.loading.progress` goes; the browser host posts it to the page. */
    onProgress?(value: number, label?: string): void;
    now?: () => number;
    timeoutMs?: number;
}

/** Reject objects, executable properties, deep graphs and large UI messages before crossing realms. */
export function compactJSON(value: unknown, maxBytes = 16384): Json {
    const seen = new Set<object>();
    let nodes = 0, characters = 0;
    const visit = (v: unknown, depth: number): Json => {
        if (++nodes > 4096) throw new Error("UI_MESSAGE_SIZE");
        if (depth > 8) throw new Error("UI_MESSAGE_DEPTH");
        if (typeof v === "string") {
            characters += v.length;
            if (characters > maxBytes) throw new Error("UI_MESSAGE_SIZE");
            return v;
        }
        if (v === null || typeof v === "boolean") return v;
        if (typeof v === "number" && Number.isFinite(v)) return v;
        if (!v || typeof v !== "object" || seen.has(v)) throw new Error("UI_MESSAGE_INVALID");
        if (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null)
            throw new Error("UI_MESSAGE_INVALID");
        seen.add(v);
        const entries = Object.entries(Object.getOwnPropertyDescriptors(v));
        if (entries.length > 1024) throw new Error("UI_MESSAGE_SIZE");
        const out: any = Array.isArray(v) ? [] : {};
        for (const [key, d] of entries) {
            if (Array.isArray(v) && key === "length") continue;
            characters += key.length;
            if (characters > maxBytes) throw new Error("UI_MESSAGE_SIZE");
            if (["__proto__", "constructor", "prototype"].includes(key) || d.get || d.set) throw new Error("UI_MESSAGE_INVALID");
            out[key] = visit(d.value, depth + 1);
        }
        seen.delete(v);
        return out;
    };
    const result = visit(value, 0);
    if (new TextEncoder().encode(JSON.stringify(result)).length > maxBytes) throw new Error("UI_MESSAGE_SIZE");
    return result;
}

export class RuntimeSession {
    phase: Phase = "created";
    frames = 0;
    private lifetime = new AbortController();
    private game: PortableGame;
    private input: Record<string, number> = Object.create(null);
    private deltas: Record<string, number> = Object.create(null);
    private presses = new Set<string>();
    private saved: Json = null;
    private pending = Promise.resolve();
    private uiAt = -Infinity;
    private pendingUI: Json | undefined;
    private stop?: Promise<void>;
    private options: RuntimeOptions;
    constructor(factory: GameFactory, options: RuntimeOptions) {
        this.options = options;
        for (const key of Object.keys(options.manifest.input)) this.input[key] = this.deltas[key] = 0;
        const capabilities = new Set(options.manifest.capabilities);
        const assets = new Set(options.manifest.assets);
        const services: HostServices = {
            identity: Object.freeze({ ...options.services.identity }),
            asset: (path, signal) => {
                if (!capabilities.has("assets") || !assets.has(path)) return Promise.reject(new Error("ASSET_NOT_DECLARED"));
                this.assertLive();
                return options.services.asset(path, signal);
            },
            avatar: (ref, signal) => {
                if (!capabilities.has("avatar") || typeof ref !== "string" || !ref || ref.length > 2048)
                    return Promise.reject(new Error("CAPABILITY_NOT_GRANTED"));
                if (!options.services.avatar) return Promise.reject(new Error("HOST_SERVICE_ADAPTER_REQUIRED"));
                try { this.assertLive(); } catch (error) { return Promise.reject(error); }
                return options.services.avatar(ref, signal).then(bytes => {
                    if (!(bytes instanceof ArrayBuffer)) throw new Error("AVATAR_INVALID");
                    if (bytes.byteLength > AVATAR_MAX_BYTES) throw new Error("AVATAR_TOO_LARGE");
                    return bytes;
                });
            },
            call: (capability, operation, value, signal) => {
                if (!capabilities.has(capability) || !/^[a-zA-Z][a-zA-Z0-9._-]{0,63}$/.test(operation))
                    return Promise.reject(new Error("CAPABILITY_NOT_GRANTED"));
                this.assertLive();
                return options.services.call(capability, operation, compactJSON(value), signal).then(v => compactJSON(v));
            },
        };
        this.game = factory({ graphics: options.graphics, services, signal: this.lifetime.signal,
            ui: { publish: value => { this.assertLive(); this.pendingUI = compactJSON(value); } },
            loading: { progress: (value, label) => { if (this.phase === "preparing") options.onProgress?.(value, label); } },
            // Getters make the action state read-only to game code.
            input: Object.freeze(Object.defineProperties({}, Object.fromEntries(Object.keys(this.input)
                .map(k => [k, { enumerable: true, get: () => this.input[k] }])))),
            deltas: Object.freeze(Object.defineProperties({}, Object.fromEntries(Object.keys(this.input)
                .map(k => [k, { enumerable: true, get: () => this.deltas[k] }])))),
            pressed: Object.freeze(Object.defineProperties({}, Object.fromEntries(Object.keys(this.input)
                .map(k => [k, { enumerable: true, get: () => this.presses.has(k) }])))),
        });
    }
    private assertLive() {
        if (this.lifetime.signal.aborted || this.phase === "disposed" || this.phase === "failed") throw new Error("RUNTIME_DISPOSED");
    }
    private async bounded<T>(operation: () => Promise<T> | T): Promise<T> {
        this.assertLive();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => { this.lifetime.abort(); reject(new Error("RUNTIME_TIMEOUT")); }, this.options.timeoutMs ?? 30000);
        });
        try {
            const result = await Promise.race([Promise.resolve().then(operation), timeout]);
            this.assertLive(); return result;
        } finally { clearTimeout(timer); }
    }
    private serial(operation: () => Promise<void>): Promise<void> {
        const next = this.pending.then(operation);
        this.pending = next.catch(() => { if (this.phase !== "disposed") this.phase = "failed"; });
        return next;
    }
    prepare() { return this.serial(async () => {
        if (this.phase !== "created") throw new Error("RUNTIME_PHASE");
        this.phase = "preparing"; await this.bounded(() => this.game.prepare()); this.phase = "ready";
    }); }
    enter(continuity: Continuity) { return this.serial(async () => {
        if (this.phase !== "ready") throw new Error("RUNTIME_PHASE");
        // A copy prevents a world from modifying the trusted travel snapshot.
        await this.bounded(() => this.game.enter(JSON.parse(JSON.stringify(continuity))));
        this.phase = "entered";
    }); }
    suspend() { return this.serial(async () => {
        if (this.phase !== "entered") throw new Error("RUNTIME_PHASE");
        this.phase = "suspended"; this.clearInput();
        this.saved = compactJSON(await this.bounded(() => this.game.suspend()), 65536);
    }); }
    restore() { return this.serial(async () => {
        if (this.phase !== "suspended") throw new Error("RUNTIME_PHASE");
        await this.bounded(() => this.game.restore(compactJSON(this.saved, 65536)));
        this.phase = "entered";
    }); }
    action(action: string, value = 1) {
        this.assertLive();
        if (!Object.hasOwn(this.input, action) || !Number.isFinite(value) || Math.abs(value) > 1) throw new Error("INPUT_ACTION_INVALID");
        if (this.phase === "entered") {
            if (value > 0 && this.input[action] <= 0) this.presses.add(action);
            this.input[action] = value;
        }
    }
    delta(action: string, value: number) {
        this.assertLive();
        if (!Object.hasOwn(this.deltas, action) || !Number.isFinite(value) || Math.abs(value) > 1) throw new Error("INPUT_ACTION_INVALID");
        if (this.phase === "entered") this.deltas[action] = Math.max(-64, Math.min(64, this.deltas[action] + value));
    }
    clearInput() { for (const key of Object.keys(this.input)) this.input[key] = this.deltas[key] = 0; this.presses.clear(); }
    tick(seconds: number) {
        if (this.phase !== "entered") return;
        if (!Number.isFinite(seconds) || seconds < 0) throw new Error("RUNTIME_DELTA_INVALID");
        try {
            this.game.update(Math.min(seconds, 0.1)); this.presses.clear();
            for (const key of Object.keys(this.deltas)) this.deltas[key] = 0;
            this.frames++;
            const now = (this.options.now ?? Date.now)();
            if (this.pendingUI !== undefined && now - this.uiAt >= 50) {
                this.options.sendUI(this.pendingUI); this.pendingUI = undefined; this.uiAt = now;
            }
        } catch (error) { this.phase = "failed"; this.lifetime.abort(); throw error; }
    }
    inspect() { return compactJSON({ ...this.game.inspect(), hostPhase: this.phase, hostFrames: this.frames }); }
    dispose(): Promise<void> {
        if (this.stop) return this.stop;
        this.lifetime.abort(); this.clearInput(); this.phase = "disposed"; this.pendingUI = undefined;
        this.stop = this.pending.then(async () => {
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
                await Promise.race([
                    Promise.resolve().then(() => this.game.dispose()),
                    new Promise<never>((_, reject) => {
                        timer = setTimeout(() => reject(new Error("RUNTIME_DISPOSE_TIMEOUT")), this.options.timeoutMs ?? 30000);
                    }),
                ]);
            } finally { clearTimeout(timer); }
        });
        return this.stop;
    }
}

export interface Scenario {
    version: 1;
    steps: Array<{ type: "action"; action: string; value?: number } |
        { type: "wait"; frames: number } |
        { type: "waitUntil"; key: string; equals: string | number | boolean; maxFrames: number } |
        { type: "assert"; key: string; equals: string | number | boolean }>;
}
/** Runs the creator flow plus mandatory host-owned lifecycle assertions. */
export async function runScenario(session: RuntimeSession, scenario: Scenario, frame: () => Promise<void>): Promise<void> {
    if (session.phase !== "entered") throw new Error("RUNTIME_NOT_READY");
    if (scenario.version !== 1 || !Array.isArray(scenario.steps) || scenario.steps.length < 1 || scenario.steps.length > 128)
        throw new Error("SCENARIO_INVALID");
    for (const step of scenario.steps) {
        if (step.type === "action") session.action(step.action, step.value ?? 1);
        else if (step.type === "wait") {
            if (!Number.isInteger(step.frames) || step.frames < 1 || step.frames > 600) throw new Error("SCENARIO_INVALID");
            for (let i = 0; i < step.frames; i++) { session.tick(1 / 60); await frame(); }
        } else if (step.type === "waitUntil") {
            if (typeof step.key !== "string" || !Number.isInteger(step.maxFrames) || step.maxFrames < 1 || step.maxFrames > 3600)
                throw new Error("SCENARIO_INVALID");
            let satisfied = false;
            for (let i = 0; i <= step.maxFrames; i++) {
                const state = session.inspect();
                if (state && typeof state === "object" && !Array.isArray(state) && Object.hasOwn(state, step.key) && state[step.key] === step.equals) { satisfied = true; break; }
                if (i === step.maxFrames) break;
                session.tick(1 / 60); await frame();
            }
            if (!satisfied) throw new Error(`SCENARIO_TIMEOUT:${step.key}`);
        } else if (step.type === "assert") {
            const state = session.inspect() as Record<string, Json>;
            if (!Object.hasOwn(state, step.key) || state[step.key] !== step.equals) throw new Error(`SCENARIO_ASSERT:${step.key}`);
        } else throw new Error("SCENARIO_INVALID");
    }
    await session.suspend();
    const frames = session.frames; session.tick(1);
    if (session.frames !== frames) throw new Error("LIFECYCLE_SUSPEND_FAILED");
    await session.restore(); session.tick(1 / 60); await frame();
    if (session.phase !== "entered" || session.frames !== frames + 1) throw new Error("LIFECYCLE_RESTORE_FAILED");
}

/**
 * Travel between two games: the next one prepares at once, the travel
 * animation (`clap`) only gates the commit, and a failure before the commit
 * puts the previous game back with its state.
 */
export class Journey {
    active: RuntimeSession;
    constructor(active: RuntimeSession) { this.active = active; }
    private moving = false;
    async travel(next: RuntimeSession, continuity: Continuity, clap: Promise<void>,
        eligible: () => Promise<boolean>): Promise<void> {
        if (this.moving) throw new Error("TRAVEL_IN_PROGRESS");
        this.moving = true;
        const previous = this.active;
        let committed = false;
        try {
            if (!await eligible()) throw new Error("PLATFORM_RELEASE_UNAVAILABLE");
            await Promise.all([next.prepare(), clap]);
            if (!await eligible()) throw new Error("PLATFORM_RELEASE_UNAVAILABLE");
            await previous.suspend();
            await next.enter(continuity);
            this.active = next;
            committed = true;
            await previous.dispose();
        } catch (error) {
            // Disposal is cleanup after commit. Its failure must never destroy the live destination.
            if (!committed) {
                try { await next.dispose(); }
                finally { if (previous.phase === "suspended") await previous.restore(); }
            }
            throw error;
        } finally { this.moving = false; }
    }
}
