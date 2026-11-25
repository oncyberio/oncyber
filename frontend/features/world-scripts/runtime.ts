/**
 * The part of world scripts that has to be where the world is: the sandbox
 * a script runs in, the engine it draws through, and what it shows on
 * screen. Everything that needs the account (who may edit, the model, the
 * save) is the controller's (./controller), which drives a runtime through
 * this interface and so does not care whether the world is in its own page
 * or in a frame below it (./runtimeRelay).
 */
import type { HudCorner } from "./protocol";
import { WORLD_SCRIPT_LIMITS } from "./protocol";
import type { SwapMode, WorldScriptStatus } from "./host";
import { NEUTRAL_STYLE, WorldStyle } from "./style";
import { getWorldScripts, setWorldScripts } from "./store";

const READY_POLL_MS = 400;
const READY_GIVE_UP_MS = 120_000;

export interface RunResult {
    ok: boolean;
    reason?: string;
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
     * ("keep" carries the game's state over, "fresh" starts it again).
     */
    run(source: string, mode: SwapMode): Promise<RunResult>;
    /** From the beginning: the running script, or this one when none is. */
    restart(source: string): void;
    /** For this visit; what is saved with the space is untouched. */
    stop(): void;
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

/** What a script shows on screen, kept in the store the layer draws from. */
function screen() {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    return {
        hud(key: string, text: string | null, corner: HudCorner) {
            setWorldScripts((current) => {
                const hud = { ...current.hud };
                if (text == null) delete hud[key];
                else if (
                    hud[key] ||
                    Object.keys(hud).length < WORLD_SCRIPT_LIMITS.maxHudLines
                )
                    hud[key] = { text, corner };
                return { hud };
            });
        },
        clearHud() {
            setWorldScripts({ hud: {} });
        },
        toast(text: string, seconds: number) {
            const id = Date.now() + Math.random();
            setWorldScripts((current) => ({
                toasts: [
                    ...current.toasts,
                    { id, text, until: Date.now() + seconds * 1000 },
                ].slice(-3),
            }));
            const timer = setTimeout(() => {
                timers.delete(timer);
                setWorldScripts((current) => ({
                    toasts: current.toasts.filter((toast) => toast.id !== id),
                }));
            }, seconds * 1000);
            timers.add(timer);
        },
        banner(text: string | null, seconds: number) {
            if (text == null) return setWorldScripts({ banner: null });
            const until = Date.now() + seconds * 1000;
            setWorldScripts({ banner: { text, until } });
            const timer = setTimeout(() => {
                timers.delete(timer);
                if (getWorldScripts().banner?.until === until)
                    setWorldScripts({ banner: null });
            }, seconds * 1000);
            timers.add(timer);
        },
        dispose() {
            timers.forEach(clearTimeout);
        },
    };
}

/**
 * The runtime in this document, on the world that is loading in it. Starts
 * the space's saved script once the world is up.
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
    const ui = screen();
    const wait = () =>
        new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));

    async function boot() {
        const startedAt = Date.now();
        // The engine's modules load the engine's own way first: importing
        // them before the world exists evaluates them in another order.
        while (!disposed && !(window as any).scene) {
            if (Date.now() - startedAt > READY_GIVE_UP_MS) return;
            await wait();
        }
        if (disposed) return;
        const [{ createEngineSink, engineReady }, { WorldScriptHost }] =
            await Promise.all([import("./engineAdapter"), import("./host")]);
        while (!disposed && !engineReady()) {
            if (process.env.NODE_ENV === "development")
                (window as any).oncyberWorldScriptsWaiting = Date.now();
            if (Date.now() - startedAt > READY_GIVE_UP_MS) return;
            await wait();
        }
        if (disposed) return;
        engine = createEngineSink(ui, style || undefined);
        host = new WorldScriptHost(document.body, engine.sink, {
            onStatus: events.onStatus,
            onLog: events.onLog,
        });
        // A world with no style of its own still hands scripts a palette.
        host.style = style || NEUTRAL_STYLE;
        engine.bind({
            frame: (dt) => host?.frame(dt),
            key: (down, key, code) => host?.key(down, key, code),
            click: (hit) => host?.click(hit),
        });
        let failed: string | undefined;
        if (saved.source) {
            const result = await host.start(saved.source);
            if (!result.ok) failed = result.reason || "it stopped";
        }
        if (!disposed) events.onReady?.(failed);
    }
    void boot();

    return {
        ready: () => !!host,
        async run(source, mode) {
            if (!host)
                return { ok: false, reason: "The world is still loading." };
            const result = host.running
                ? await host.swap(source, mode)
                : await host.start(source);
            return { ok: result.ok, reason: result.reason };
        },
        restart(source) {
            if (!host) return;
            if (host.running) void host.restart();
            else if (source) void host.start(source);
        },
        stop() {
            host?.stop();
        },
        setStyle(next) {
            style = next;
            if (host) host.style = next;
            engine?.setStyle(next);
        },
        async context() {
            return {
                ...(engine?.colors() || {}),
                artworks: (engine?.sink.artworks() || [])
                    .slice(0, 200)
                    .map(({ id, name }) => ({
                        id: id.slice(0, 200),
                        name: name.slice(0, 120),
                    })),
            };
        },
        dispose() {
            disposed = true;
            ui.dispose();
            host?.dispose();
            engine?.dispose();
        },
    };
}
