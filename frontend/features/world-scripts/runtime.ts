/**
 * The part of world scripts that has to be where the world is: the sandbox
 * a script runs in, the engine it draws through, and what it shows on
 * screen. Everything that needs the account (who may edit, the model, the
 * save) is the controller's (./controller), which drives a runtime through
 * this interface and so does not care whether the world is in its own page
 * or in a frame below it (./runtimeRelay).
 */
import type { HudCorner } from "./protocol";
import { WORLD_SCRIPT_LIMITS } from "./basics";
import type { SwapMode, WorldScriptStatus } from "./host";
import { TRIAL_REPLACED, type TrialFault } from "./trial";
import { NEUTRAL_STYLE, WorldStyle } from "./style";
import { readContext } from "./runtimeRelay";
import {
    getWorldScriptScreen,
    resetWorldScriptScreen,
    setWorldScriptScreen,
} from "./store";

const READY_POLL_MS = 400;
const READY_GIVE_UP_MS = 120_000;
/** A later try at a world that was not up the first time waits this long. */
const READY_RETRY_MS = 8_000;
const WORLD_LOADING = "The world is still loading.";
const WORLD_NOT_UP = "The world didn't come up.";

export interface RunResult {
    ok: boolean;
    reason?: string;
    /**
     * Whose fault a refusal is: the "script" (it threw, it hung: worth
     * showing whoever wrote it) or the "world" (not loaded, not answering,
     * replaced: nothing about the script). No fault reads as the script's.
     */
    fault?: TrialFault;
}

/** What the model is told about the world a script is written for. */
export interface WorldScriptContext {
    sky?: string;
    fog?: string;
    artworks: { id: string; name: string }[];
}

export interface WorldScriptRuntime {
    /** False until the world is up and can run a script. */
    ready(): boolean;
    /**
     * Runs a script: out of sight first, then in place of the one running
     * ("keep" carries the game's state over, "fresh" starts it again). A
     * `style` given with it becomes the world's only if the script lands.
     */
    run(source: string, mode: SwapMode, style?: WorldStyle): Promise<RunResult>;
    /** From the beginning: the running script, or this one when none is. */
    restart(source: string): void;
    /** For this visit; what is saved with the space is untouched. */
    stop(): void;
    /** Gives up on a run still being tried; what runs keeps running. */
    cancel(): void;
    /** Draws everything in a new style. */
    setStyle(style: WorldStyle): void;
    context(): Promise<WorldScriptContext>;
    dispose(): void;
}

export interface RuntimeEvents {
    /** The world can run scripts; `failed` when its saved one did not start. */
    onReady?(failed?: string): void;
    onStatus?(status: WorldScriptStatus): void;
    onLog?(level: "log" | "warn" | "error", text: string): void;
}

/**
 * What a script shows on screen, kept in the store the layer draws from.
 * Nothing is written when nothing changes: a script may ask every frame.
 */
function screen() {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    return {
        hud(key: string, text: string | null, corner: HudCorner) {
            const { hud } = getWorldScriptScreen();
            const line = hud[key];
            if (text == null) {
                if (!line) return;
                const next = { ...hud };
                delete next[key];
                return setWorldScriptScreen({ hud: next });
            }
            if (line?.text === text && line.corner === corner) return;
            if (
                !line &&
                Object.keys(hud).length >= WORLD_SCRIPT_LIMITS.maxHudLines
            )
                return;
            setWorldScriptScreen({ hud: { ...hud, [key]: { text, corner } } });
        },
        clearHud() {
            if (Object.keys(getWorldScriptScreen().hud).length)
                setWorldScriptScreen({ hud: {} });
        },
        toast(text: string, seconds: number) {
            const id = Date.now() + Math.random();
            setWorldScriptScreen((current) => ({
                toasts: [
                    ...current.toasts,
                    { id, text, until: Date.now() + seconds * 1000 },
                ].slice(-3),
            }));
            const timer = setTimeout(() => {
                timers.delete(timer);
                setWorldScriptScreen((current) => ({
                    toasts: current.toasts.filter((toast) => toast.id !== id),
                }));
            }, seconds * 1000);
            timers.add(timer);
        },
        banner(text: string | null, seconds: number) {
            if (text == null) {
                if (getWorldScriptScreen().banner)
                    setWorldScriptScreen({ banner: null });
                return;
            }
            const until = Date.now() + seconds * 1000;
            setWorldScriptScreen({ banner: { text, until } });
            const timer = setTimeout(() => {
                timers.delete(timer);
                if (getWorldScriptScreen().banner?.until === until)
                    setWorldScriptScreen({ banner: null });
            }, seconds * 1000);
            timers.add(timer);
        },
        dispose() {
            timers.forEach(clearTimeout);
            timers.clear();
            resetWorldScriptScreen();
        },
    };
}

const said = (error: unknown) =>
    String((error as Error)?.message || error || "It didn't load.");

/**
 * The runtime in this document, on the world that is loading in it.
 *
 * A space with a saved script starts it once the world is up. A space
 * with none loads nothing until someone runs a script in it: the sandbox,
 * the engine's bridge and the drawing code behind them are fetched then,
 * so a visitor to a world without scripts never downloads them.
 */
export function createLocalRuntime(
    saved: { source?: string; style?: WorldStyle | null },
    events: RuntimeEvents = {}
): WorldScriptRuntime {
    let disposed = false;
    let host: import("./host").WorldScriptHost | null = null;
    let engine: ReturnType<
        typeof import("./engineAdapter").createEngineSink
    > | null = null;
    let style = saved.style || null;
    let announced = false;
    const announce = (failed?: string) => {
        if (disposed || announced) return;
        announced = true;
        events.onReady?.(failed);
    };
    const ui = screen();
    const wait = () =>
        new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));

    const startedAt = Date.now();
    /** A first wait is long (a world loads); a later one is a short retry. */
    const patience = () =>
        Math.max(startedAt + READY_GIVE_UP_MS, Date.now() + READY_RETRY_MS);
    /** The world has a scene: a script could be run in it. */
    const worldUp = () => !disposed && !!(window as any).scene;
    async function until(up: () => boolean) {
        const deadline = patience();
        while (!disposed && !up()) {
            if (Date.now() > deadline) return false;
            await wait();
        }
        return !disposed;
    }
    const world = until(worldUp);

    async function boot() {
        // The engine's modules load the engine's own way first: importing
        // them before the world exists evaluates them in another order.
        if (!(await world) && !(await until(worldUp))) {
            if (disposed) return;
            throw new Error(WORLD_NOT_UP);
        }
        const [{ createEngineSink, engineReady }, { WorldScriptHost }] =
            await Promise.all([import("./engineAdapter"), import("./host")]);
        if (!(await until(engineReady))) {
            if (disposed) return;
            throw new Error(WORLD_NOT_UP);
        }
        const sink = createEngineSink(ui, style || undefined);
        engine = sink;
        host = new WorldScriptHost(document.body, sink.sink, {
            onStatus(status) {
                // Drawn every frame only while something runs.
                sink.setActive(
                    status.state === "starting" || status.state === "running"
                );
                events.onStatus?.(status);
            },
            onLog: events.onLog,
            // A version that came with a style has landed.
            onStyle(next) {
                style = next as WorldStyle;
                sink.setStyle(style);
            },
        });
        // A world with no style of its own still hands scripts a palette.
        host.style = style || NEUTRAL_STYLE;
        sink.bind({
            frame: (dt) => host?.frame(dt),
            key: (down, key, code) => host?.key(down, key, code),
            click: (hit) => host?.click(hit),
        });
    }
    let booting: Promise<void> | null = null;
    // A boot that failed (the world never came up, its code did not load)
    // is not kept: the next ask tries again.
    const booted = () =>
        (booting ||= boot().catch((error) => {
            booting = null;
            throw error;
        }));

    if (saved.source) {
        void booted().then(
            async () => {
                if (!host) return;
                const result = await host.start(saved.source);
                // Replaced by something newer is not a failure of its own.
                announce(
                    result.ok || result.reason === TRIAL_REPLACED
                        ? undefined
                        : result.reason || "it stopped"
                );
            },
            (error) => announce(said(error))
        );
    } else {
        // Nothing to run yet: ready as soon as there is a world.
        void world.then((up) => {
            if (up) announce();
        });
    }

    return {
        // With a saved script, not before it has had its start.
        ready: () => !!host || (worldUp() && (!saved.source || announced)),
        async run(source, mode, runStyle) {
            try {
                await booted();
            } catch (error) {
                return { ok: false, reason: said(error), fault: "world" };
            }
            if (!host)
                return { ok: false, reason: WORLD_LOADING, fault: "world" };
            const result = host.running
                ? await host.swap(source, mode, runStyle)
                : await host.start(source, runStyle);
            return result.ok
                ? { ok: true }
                : { ok: false, reason: result.reason, fault: result.fault };
        },
        restart(source) {
            void booted().then(
                () => {
                    if (!host) return;
                    if (host.running) void host.restart();
                    else if (source) void host.start(source);
                },
                () => undefined
            );
        },
        stop() {
            host?.stop();
        },
        cancel() {
            host?.abandon();
        },
        setStyle(next) {
            style = next;
            if (host) host.style = next;
            engine?.setStyle(next);
        },
        async context() {
            await booted().catch(() => undefined);
            return readContext({
                ...(engine?.colors() || {}),
                artworks: engine?.sink.artworks() || [],
            });
        },
        dispose() {
            disposed = true;
            ui.dispose();
            host?.dispose();
            engine?.dispose();
        },
    };
}
