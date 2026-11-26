/**
 * For tests: a world script without a browser. The real SDK (./sdk) and a
 * script run in a context of their own, as they do in the sandbox's worker;
 * messages are copied on the way in and out, as a worker's are.
 */
import vm from "vm";
import v8 from "v8";
import { WORLD_SCRIPT_SDK, wrapUserSource } from "./sdk";
import { ScriptVersion } from "./version";

/** A structured clone: what cannot cross to a worker throws here too. */
export const copied = <T>(value: T): T =>
    v8.deserialize(new Uint8Array(v8.serialize(value)));

const VIEW = {
    player: { position: [0, 0, 0], forward: [0, 0, 1], yaw: 0 },
    camera: { position: [0, 1.6, 0], forward: [0, 0, 1] },
};

/** The SDK and an already wrapped script, in a worker-like scope. */
export function openSandbox(
    wrapped: string,
    onPost: (message: any) => void = () => {}
) {
    const posted: any[] = [];
    const scope: any = {
        postMessage(message: unknown) {
            const copy = copied(message);
            posted.push(copy);
            onPost(copy);
        },
        // What a real worker scope has, to see that the SDK takes it away.
        fetch() {},
        Worker: function Worker() {},
        importScripts() {},
    };
    scope.self = scope;
    vm.runInNewContext(WORLD_SCRIPT_SDK + "\n" + wrapped, scope);
    const send = (message: unknown) =>
        scope.onmessage({ data: copied(message) });
    let seq = 0;
    return {
        scope,
        posted,
        send,
        /** Starts the script; the start's extras are the host's to give. */
        start(extra: Record<string, unknown> = {}) {
            send({
                t: "start",
                mode: "fresh",
                kept: {},
                things: {},
                seed: 7,
                view: VIEW,
                artworks: [],
                doors: [],
                ...extra,
            });
        },
        /**
         * One frame; returns the requests the script answered it with.
         * `at` is where the visitor stands for it.
         */
        tick(dt = 1 / 60, at?: number[]) {
            const before = posted.length;
            const view = at
                ? { ...VIEW, player: { ...VIEW.player, position: at } }
                : VIEW;
            send({ t: "tick", seq: ++seq, dt, view });
            return posted
                .slice(before)
                .filter((message) => message.t === "ops")
                .flatMap((message) => message.ops as any[]);
        },
        /** Every request sent so far. */
        ops: () =>
            posted
                .filter((message) => message.t === "ops")
                .flatMap((message) => message.ops as any[]),
        errors: () =>
            posted
                .filter((message) => message.t === "error")
                .map((message) => String(message.text)),
    };
}

/** A script, run. */
export function runScript(source: string, start: Record<string, unknown> = {}) {
    const sandbox = openSandbox(wrapUserSource(source));
    sandbox.start(start);
    return sandbox;
}

/**
 * A version whose script runs in such a context: messages arrive a moment
 * later in both directions, never inside the call, as with a port.
 */
export class SandboxVersion extends ScriptVersion {
    private sandbox: ReturnType<typeof openSandbox> | null = null;

    protected opened() {
        return Promise.resolve();
    }

    protected post(message: any) {
        void Promise.resolve().then(() => {
            if (this.closed) return;
            if (message.t === "boot") {
                try {
                    this.sandbox = openSandbox(
                        message.wrapped,
                        (said) =>
                            void Promise.resolve().then(() =>
                                this.receive(said)
                            )
                    );
                    this.sandbox.send(message.start);
                } catch (error) {
                    // As the relay reports a script that does not parse.
                    this.receive({
                        t: "error",
                        fatal: true,
                        text: String((error as Error).message),
                    });
                }
            } else if (message.t !== "stop") this.sandbox?.send(message);
        });
    }

    protected shut() {
        this.sandbox = null;
    }
}

/** A version a test speaks for: what it was sent, and a way to answer. */
export class ManualVersion extends ScriptVersion {
    sent: any[] = [];
    /** Set false for a frame that never opens. */
    opens = true;

    protected opened() {
        return this.opens
            ? Promise.resolve()
            : Promise.reject(new Error("The script frame did not open."));
    }

    protected post(message: any) {
        this.sent.push(message);
    }

    protected shut() {}

    says(message: unknown) {
        this.receive(message);
    }

    ticks() {
        return this.sent.filter((message) => message.t === "tick");
    }
}

/** Lets what was posted arrive. */
export async function arrive() {
    for (let i = 0; i < 12; i++) await Promise.resolve();
}
