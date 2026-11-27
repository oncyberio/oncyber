import vm from "vm";
import {
    buildSandboxDocument,
    WORLD_SCRIPT_CSP,
    WORLD_SCRIPT_HANG_MS,
    WORLD_SCRIPT_RELAY,
    WORLD_SCRIPT_SANDBOX,
    WORLD_SCRIPT_UNASKED_LIMIT,
} from "./sandboxDocument";
import { WORLD_SCRIPT_SDK, wrapUserSource } from "./sdk";

describe("the world script frame", () => {
    it("is sandboxed without same-origin access", () => {
        expect(WORLD_SCRIPT_SANDBOX).toBe("allow-scripts");
    });

    it("blocks the network and every other resource", () => {
        expect(WORLD_SCRIPT_CSP).toContain("default-src 'none'");
        expect(WORLD_SCRIPT_CSP).toContain("connect-src 'none'");
        expect(WORLD_SCRIPT_CSP).not.toMatch(/https?:/);
        expect(buildSandboxDocument()).toContain(WORLD_SCRIPT_CSP);
    });

    it("has exactly one script element and no user code in it", () => {
        const html = buildSandboxDocument();
        expect(html.match(/<\/script/gi)).toHaveLength(1);
        expect(html).not.toContain("__defineScript(function");
    });

    it("ships an SDK and a wrapper that parse", () => {
        expect(() => new Function(WORLD_SCRIPT_SDK)).not.toThrow();
        expect(
            () => new Function(wrapUserSource("world.add({ id: 'a' });"))
        ).not.toThrow();
    });
});

/**
 * The relay as it runs in the frame, with a worker and a port a test
 * speaks for.
 */
function relay() {
    let now = 1000;
    let watchdog = () => {};
    const toHost: any[] = [];
    const workers: any[] = [];
    let handed: (event: any) => void = () => {};
    const parent = {};
    const scope: any = {
        Date: { now: () => now },
        setInterval: (run: () => void) => (watchdog = run),
        URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} },
        Blob: function Blob() {},
        Worker: function Worker(this: any) {
            this.sent = [];
            this.postMessage = (message: any) => this.sent.push(message);
            this.terminate = () => (this.terminated = true);
            workers.push(this);
        },
        addEventListener: (_type: string, run: (event: any) => void) =>
            (handed = run),
        parent,
    };
    scope.window = scope;
    vm.runInNewContext(WORLD_SCRIPT_RELAY, scope);
    const port: any = { postMessage: (message: any) => toHost.push(message) };
    handed({ source: parent, ports: [port] });
    const host = (message: any) => port.onmessage({ data: message });
    host({ t: "boot", wrapped: "", start: { t: "start" } });
    const worker = workers[0];
    return {
        host,
        worker,
        toHost,
        says: (message: any) => worker.onmessage?.({ data: message }),
        /** Time goes by and the relay looks at its worker. */
        later(ms: number) {
            now += ms;
            watchdog();
        },
        stopped: () => toHost.filter((message) => message.t === "stopped"),
    };
}

describe("the relay between a script's worker and the page", () => {
    it("passes on the start's answer and each frame's, once", () => {
        const r = relay();
        r.says({ t: "ops", seq: -1, ops: [] });
        r.says({ t: "started" });
        r.host({ t: "tick", seq: 4 });
        r.says({ t: "ops", seq: 4, ops: [] });
        expect(r.toHost.map((message) => message.t)).toEqual([
            "relay-ready",
            "ops",
            "started",
            "ops",
        ]);
        expect(r.worker.sent.map((message: any) => message.t)).toEqual([
            "start",
            "tick",
        ]);
    });

    it("keeps to itself what nobody asked for", () => {
        const r = relay();
        r.says({ t: "ops", seq: -1, ops: [] });
        r.says({ t: "started" });
        const before = r.toHost.length;
        // No frame was sent: these answer nothing.
        r.says({ t: "ops", seq: 7, ops: [{ op: "toast" }] });
        r.says({ t: "ops", seq: -1, ops: [] });
        r.says({ t: "started" });
        r.says({ t: "kept", kept: {} });
        expect(r.toHost).toHaveLength(before);
        // An error or a restart is the script's to say whenever.
        r.says({ t: "error", text: "x" });
        expect(r.toHost).toHaveLength(before + 1);
    });

    it("stops a worker that does not answer its frame, whatever else it sends", () => {
        const r = relay();
        r.says({ t: "ops", seq: -1, ops: [] });
        r.says({ t: "started" });
        r.host({ t: "tick", seq: 1 });
        // Busy posting, in a loop or from a second thread, and never
        // answering: before, any of these counted as an answer.
        for (let i = 0; i < 50; i++) r.says({ t: "ops", seq: 900 + i });
        r.later(WORLD_SCRIPT_HANG_MS + 600);
        expect(r.worker.terminated).toBe(true);
        expect(r.stopped()[0].reason).toContain("stopped answering");
    });

    it("does not wait for the clock to stop one that floods", () => {
        const r = relay();
        r.says({ t: "ops", seq: -1, ops: [] });
        for (let i = 0; i <= WORLD_SCRIPT_UNASKED_LIMIT; i++)
            r.says({ t: "ops", seq: 500, ops: [] });
        expect(r.worker.terminated).toBe(true);
        expect(r.stopped()[0].reason).toContain("too much at once");
        // And nothing from it is heard after.
        expect(r.worker.onmessage).toBeNull();
    });

    it("leaves alone a worker that is owed nothing", () => {
        const r = relay();
        r.says({ t: "ops", seq: -1, ops: [] });
        r.says({ t: "started" });
        // No frames for a minute: a tab in the background.
        r.later(60_000);
        expect(r.worker.terminated).toBeUndefined();
        r.host({ t: "keep" });
        r.says({ t: "kept", kept: { score: 1 } });
        r.later(60_000);
        expect(r.worker.terminated).toBeUndefined();
        expect(r.toHost[r.toHost.length - 1]).toEqual({
            t: "kept",
            kept: { score: 1 },
        });
    });
});
