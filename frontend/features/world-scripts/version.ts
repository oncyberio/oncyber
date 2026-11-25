/**
 * One running source: a script in its own sandboxed frame
 * (sandboxDocument.ts), reached over one transferred MessagePort. The host
 * (./host.ts) opens one per version it tries or runs.
 *
 * `ScriptVersion` is everything about a version but the frame itself, so a
 * test can stand a script up without a browser.
 */
import {
    buildSandboxDocument,
    buildWorkerScript,
    WORLD_SCRIPT_SANDBOX,
} from "./sandboxDocument";
import { WORLD_SCRIPT_LIMITS } from "./basics";

/** The sandbox frame itself opening: the browser's work, on a busy page. */
const FRAME_OPEN_TIMEOUT_MS = 15_000;
const KEEP_TIMEOUT_MS = 600;

type Listener = (message: any) => void;

export abstract class ScriptVersion {
    private listeners = new Set<Listener>();
    private closers = new Set<() => void>();
    /** A frame was sent and has not been answered. */
    awaitingTick = false;
    /** Seconds of the world's frames it has not been sent yet. */
    pendingDt = 0;
    /** Messages heard, and requests still allowed, since the last frame. */
    heard = 0;
    budget: number = WORLD_SCRIPT_LIMITS.maxOpsPerTick;
    errors = 0;
    closed = false;

    constructor(readonly source: string) {}

    /** Resolves once messages can be sent; rejects when it cannot open. */
    protected abstract opened(): Promise<void>;
    protected abstract post(message: unknown): void;
    /** Lets go of whatever carries the messages. */
    protected abstract shut(): void;

    /** A message from the script. */
    protected receive(message: unknown) {
        this.listeners.forEach((listener) => listener(message));
    }

    on(listener: Listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /** Told once, when the version is closed (by anyone). */
    onClosed(listener: () => void) {
        this.closers.add(listener);
        return () => this.closers.delete(listener);
    }

    send(message: unknown) {
        if (!this.closed) this.post(message);
    }

    async boot(start: Record<string, unknown>) {
        await this.opened();
        this.send({
            t: "boot",
            wrapped: buildWorkerScript(this.source),
            start,
        });
    }

    /** The script's keep() values, or nothing if it doesn't answer quickly. */
    kept(): Promise<Record<string, unknown>> {
        return new Promise((resolve) => {
            const done = (kept: Record<string, unknown>) => {
                clearTimeout(timer);
                off();
                gone();
                resolve(kept);
            };
            const timer = setTimeout(() => done({}), KEEP_TIMEOUT_MS);
            const off = this.on((message) => {
                if (message?.t !== "kept") return;
                done(
                    message.kept && typeof message.kept === "object"
                        ? message.kept
                        : {}
                );
            });
            const gone = this.onClosed(() => done({}));
            this.send({ t: "keep" });
        });
    }

    close() {
        if (this.closed) return;
        this.send({ t: "stop" });
        this.closed = true;
        this.shut();
        this.listeners.clear();
        const closers = [...this.closers];
        this.closers.clear();
        closers.forEach((closer) => closer());
    }
}

/** A version in a real sandboxed frame. */
export class FrameVersion extends ScriptVersion {
    readonly frame: HTMLIFrameElement;
    private port: MessagePort | null = null;
    private ready: Promise<void>;

    constructor(container: HTMLElement, source: string) {
        super(source);
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
                FRAME_OPEN_TIMEOUT_MS
            );
            // Closed before it opened: nobody is left to wait for it.
            this.onClosed(() => {
                clearTimeout(timer);
                reject(new Error("The script frame was closed."));
            });
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
                        this.receive(event.data);
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
        // A version closed before anyone waits on it is not an error.
        this.ready.catch(() => undefined);
        container.appendChild(frame);
    }

    protected opened() {
        return this.ready;
    }

    protected post(message: unknown) {
        this.port?.postMessage(message);
    }

    protected shut() {
        this.port?.close();
        this.frame.remove();
    }
}
