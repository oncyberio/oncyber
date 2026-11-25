/**
 * A world script's runtime across a frame (docs/plans/framed-worlds.md).
 *
 * Where worlds are framed, the script runs in the world's document and the
 * AI sidebar, with the account it needs, is in the page around it. The
 * page's controller drives a runtime (./runtime) like any other; this one
 * turns each call into a message to the world and reads the answer.
 *
 * Down, page to world: `script-hello` (are you ready?), `script-run`,
 * `script-cancel`, `script-restart`, `script-stop`, `script-style`,
 * `script-context`, `script-panel`.
 * Up, world to page: `script-ready`, `script-ran`, `script-context`,
 * `script-status`, `script-log`.
 *
 * Every message names the space it is about. A world that has walked
 * through a portal is running another space's scripts: the page's requests
 * are for the space it opened and are not carried out anywhere else.
 */
import type { SwapMode, WorldScriptStatus } from "./host";
import type {
    RunResult,
    WorldScriptContext,
    WorldScriptRuntime,
} from "./runtime";
import { SCRIPT_MESSAGE } from "./basics";
import { watchSilence, type Timers } from "./silence";
import { cleanStyle } from "./style";

export { SCRIPT_MESSAGE };
/**
 * A run is tried for some of the world's frames first, so its answer is
 * waited for by silence, not by the clock (./silence): this long with
 * nothing heard from the world while the page is on show. A page in the
 * background has a world that draws no frames, and is waited out.
 */
export const RUN_ANSWER_MS = 45_000;
export const CONTEXT_ANSWER_MS = 4_000;
const NO_ANSWER = "The world didn't answer.";
const WORLD_LOADING = "The world is still loading.";

/**
 * Whether the page is on show (its framed world draws frames only then),
 * and a way to hear of it going out of sight or coming back.
 */
export interface PageSight {
    onShow(): boolean;
    watch(changed: () => void): () => void;
}

const pageSight: PageSight = {
    onShow: () =>
        typeof document === "undefined" ||
        document.visibilityState !== "hidden",
    watch(changed) {
        if (typeof document === "undefined") return () => {};
        document.addEventListener("visibilitychange", changed);
        return () => document.removeEventListener("visibilitychange", changed);
    },
};

const text = (value: unknown, max: number) =>
    typeof value === "string" ? value.slice(0, max) : undefined;

/** What a world says of a run, as far as the page takes its word. */
export function readRunResult(data: any): RunResult {
    return data?.ok === true
        ? { ok: true }
        : {
              ok: false,
              reason: text(data?.reason, 4000) || "It didn't run.",
              fault: data?.fault === "world" ? "world" : "script",
          };
}

/** The world's colours and artworks, cut to what the model call accepts. */
export function readContext(data: any): WorldScriptContext {
    const colour = (value: unknown) =>
        typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
            ? value
            : undefined;
    const sky = colour(data?.sky);
    const fog = colour(data?.fog);
    return {
        ...(sky ? { sky } : {}),
        ...(fog ? { fog } : {}),
        artworks: (Array.isArray(data?.artworks) ? data.artworks : [])
            .filter(
                (artwork: any) =>
                    typeof artwork?.id === "string" &&
                    typeof artwork?.name === "string"
            )
            .slice(0, 200)
            .map((artwork: any) => ({
                id: artwork.id.slice(0, 200),
                name: artwork.name.slice(0, 120),
            })),
    };
}

export function readStatus(data: any): WorldScriptStatus | null {
    const status = data?.status;
    switch (status?.state) {
        case "idle":
        case "starting":
            return { state: status.state };
        case "running":
            return { state: "running", version: Number(status.version) || 0 };
        case "stopped":
            return { state: "stopped", reason: text(status.reason, 400) || "" };
        default:
            return null;
    }
}

export function readLog(data: any) {
    const level = ["log", "warn", "error"].includes(data?.level)
        ? (data.level as "log" | "warn" | "error")
        : null;
    const line = text(data?.text, 2000);
    return level && line != null ? { level, text: line } : null;
}

export interface RemoteRuntime extends WorldScriptRuntime {
    /** A `script-` message from the world. */
    receive(kind: string, data: any): void;
}

export interface RemoteEvents {
    onReady?(failed?: string): void;
    onStatus?(status: WorldScriptStatus): void;
    onLog?(level: "log" | "warn" | "error", text: string): void;
}

/**
 * The page's side: a runtime that is the world in the frame. `post` sends
 * one message to it.
 */
export function createRemoteRuntime(
    space: string,
    post: (kind: string, data: object) => void,
    events: RemoteEvents = {},
    timers: Timers = globalThis,
    sight: PageSight = pageSight
): RemoteRuntime {
    let ready = false;
    let disposed = false;
    let asked = 0;
    const waiting = new Map<number, (data: any) => void>();
    /**
     * Told whenever this space's world says anything at all, and when the
     * page comes back on show: the wait for an answer starts again.
     */
    const hearing = new Set<() => void>();
    const heardNow = () => [...hearing].forEach((heard) => heard());
    const unwatch = sight.watch(heardNow);
    const send = (kind: string, data: object = {}) =>
        post(SCRIPT_MESSAGE + kind, { ...data, space });
    /**
     * One question to the world. `patient` waits by silence, for as long as
     * the world keeps talking or the page is not on show; otherwise the
     * answer is due within `waitMs`.
     */
    const request = (
        kind: string,
        data: object,
        waitMs: number,
        patient = false
    ) =>
        new Promise<any>((resolve) => {
            const n = ++asked;
            const watch = watchSilence(
                waitMs,
                () => done(null),
                patient ? sight.onShow : undefined,
                timers
            );
            const done = (answer: any) => {
                watch.stop();
                waiting.delete(n);
                hearing.delete(watch.heard);
                resolve(answer);
            };
            waiting.set(n, done);
            if (patient) hearing.add(watch.heard);
            send(kind, { ...data, n });
        });
    // The world may have been ready before this page was listening.
    send("hello");
    return {
        ready: () => ready,
        async run(source: string, mode: SwapMode, style) {
            if (!ready)
                return { ok: false, reason: WORLD_LOADING, fault: "world" };
            const answer = await request(
                "run",
                { source, mode, ...(style ? { style } : {}) },
                RUN_ANSWER_MS,
                true
            );
            if (answer) return readRunResult(answer);
            // Given up on here, so given up on there: a version that lands
            // later would run in a world whose page thinks it did not.
            if (!disposed) send("cancel");
            return { ok: false, reason: NO_ANSWER, fault: "world" };
        },
        restart(source) {
            send("restart", { source });
        },
        stop() {
            send("stop");
        },
        cancel() {
            send("cancel");
        },
        setStyle(style) {
            send("style", { style });
        },
        async context() {
            return readContext(
                ready ? await request("context", {}, CONTEXT_ANSWER_MS) : null
            );
        },
        receive(kind, data) {
            if (disposed || data?.space !== space) {
                // The world is somewhere else now: nothing here can run.
                if (kind === SCRIPT_MESSAGE + "ready") ready = false;
                return;
            }
            heardNow();
            switch (kind.slice(SCRIPT_MESSAGE.length)) {
                case "ready":
                    ready = true;
                    return events.onReady?.(text(data.failed, 400));
                case "ran":
                case "context":
                    return waiting.get(data.n)?.(data);
                case "status": {
                    const status = readStatus(data);
                    return status ? events.onStatus?.(status) : undefined;
                }
                case "log": {
                    const log = readLog(data);
                    return log
                        ? events.onLog?.(log.level, log.text)
                        : undefined;
                }
            }
        },
        dispose() {
            disposed = true;
            ready = false;
            unwatch();
            [...waiting.values()].forEach((answer) => answer(null));
        },
    };
}

/** The link a framed world has to its page (features/worlds/worldDocument). */
export interface PageLink {
    send(kind: string, data?: object): void;
    listen(handler: (kind: string, data: any) => void): () => void;
}

/**
 * The world's side: carries out what the page asks of this space's runtime
 * and tells the page what the runtime reports. Returns what the runtime's
 * events should call, and a way to stop.
 */
export function serveRuntime(
    space: string,
    link: PageLink,
    runtime: () => WorldScriptRuntime | null,
    onPanel: (open: boolean) => void = () => {}
) {
    const send = (kind: string, data: object = {}) =>
        link.send(SCRIPT_MESSAGE + kind, { ...data, space });
    const release = link.listen((kind, data) => {
        if (!kind.startsWith(SCRIPT_MESSAGE) || data?.space !== space) return;
        const target = runtime();
        switch (kind.slice(SCRIPT_MESSAGE.length)) {
            case "hello":
                return target?.ready() ? send("ready") : undefined;
            case "run": {
                const mode: SwapMode = data.mode === "keep" ? "keep" : "fresh";
                const answer = (result: RunResult) =>
                    send("ran", { n: data.n, ...result });
                if (!target || typeof data.source !== "string")
                    return answer({
                        ok: false,
                        reason: WORLD_LOADING,
                        fault: "world",
                    });
                return void target
                    .run(data.source, mode, cleanStyle(data.style) || undefined)
                    .then(answer, (error) =>
                        answer({
                            ok: false,
                            reason: String(error?.message || error),
                            fault: "world",
                        })
                    );
            }
            case "cancel":
                return target?.cancel();
            case "restart":
                return target?.restart(
                    typeof data.source === "string" ? data.source : ""
                );
            case "stop":
                return target?.stop();
            case "style": {
                const style = cleanStyle(data.style);
                return style ? target?.setStyle(style) : undefined;
            }
            case "context":
                return void (
                    target?.context() ?? Promise.resolve({ artworks: [] })
                ).then((context) => send("context", { n: data.n, ...context }));
            case "panel":
                return onPanel(data.open === true);
        }
    });
    return {
        events: {
            onReady: (failed?: string) =>
                send("ready", failed ? { failed } : {}),
            onStatus: (status: WorldScriptStatus) => send("status", { status }),
            onLog: (level: "log" | "warn" | "error", text: string) =>
                send("log", { level, text: text.slice(0, 2000) }),
        },
        dispose: release,
    };
}
