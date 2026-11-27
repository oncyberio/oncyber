import assert from "node:assert/strict";
import test from "node:test";
import { RuntimeSession, AVATAR_MAX_BYTES } from "../src/index.ts";
import { runCheck, sampleFrames } from "../src/check.ts";

const continuity = { avatar: { id: "v", position: [0, 0, 0], rotation: [0, 0, 0, 1] },
    camera: { position: [0, 1, 4], target: [0, 1, 0], fov: 50, mode: "third-person" }, party: [] };

function session({ capabilities = [], avatar, update } = {}) {
    let count = 0, ctx;
    const s = new RuntimeSession(c => { ctx = c; return {
        async prepare() {}, enter() {}, update() { count++; update?.(count); },
        suspend() { return { count }; }, restore(v) { count = v.count; }, dispose() {},
        inspect() { return { count, booted: true }; },
    }; }, { manifest: { input: { jump: { keyboard: ["Space"] } }, assets: [], capabilities },
        graphics: {}, services: { identity: { id: "v", name: "V" }, asset: async () => new ArrayBuffer(0),
            call: async () => true, avatar }, sendUI() {}, timeoutMs: 50 });
    return { s, get ctx() { return ctx; } };
}
let clock = 0;
const frame = async () => (clock += 16);

test("avatar bytes need the capability and stay under the size cap", async () => {
    const denied = session({ avatar: async () => new ArrayBuffer(4) });
    await assert.rejects(denied.ctx.services.avatar("a.vrm", new AbortController().signal), /CAPABILITY_NOT_GRANTED/);
    const big = session({ capabilities: ["avatar"], avatar: async () => new ArrayBuffer(AVATAR_MAX_BYTES + 1) });
    await assert.rejects(big.ctx.services.avatar("a.vrm", new AbortController().signal), /AVATAR_TOO_LARGE/);
    const ok = session({ capabilities: ["avatar"], avatar: async () => new ArrayBuffer(4) });
    assert.equal((await ok.ctx.services.avatar("a.vrm", new AbortController().signal)).byteLength, 4);
    const none = session({ capabilities: ["avatar"] });
    await assert.rejects(none.ctx.services.avatar("a.vrm", new AbortController().signal), /HOST_SERVICE_ADAPTER_REQUIRED/);
});

test("frame samples report median, p95 and worst gaps", async () => {
    const gaps = [16, 16, 16, 50];
    let t = 0, i = 0;
    const result = await sampleFrames(4, async () => (t += i++ === 0 ? 0 : gaps[(i - 2) % 4]));
    assert.equal(result.count, 4);
    assert.equal(result.medianMs, 16);
    assert.equal(result.worstMs, 50);
});

test("a passing scenario reports every stage and holds the host clock meanwhile", async () => {
    const { s } = session();
    await s.prepare(); await s.enter(continuity);
    const holds = [];
    const report = await runCheck({ session: s, backend: "test", bootMs: 12, frame, frames: 5,
        scenario: { version: 1, steps: [{ type: "wait", frames: 3 }, { type: "assert", key: "booted", equals: true }] },
        pauseHostClock: paused => holds.push(paused) });
    assert.equal(report.status, "passed");
    assert.deepEqual(report.stages.map(x => x.stage), ["boot", "scenario", "lifecycle", "frames"]);
    assert.deepEqual(holds, [true, false]);
    assert.equal(report.frames.count, 5);
});

test("a failing assertion or a throwing update fails the check with the reason", async () => {
    const a = session(); await a.s.prepare(); await a.s.enter(continuity);
    const failed = await runCheck({ session: a.s, backend: "test", bootMs: 1, frame, frames: 2, pauseHostClock() {},
        scenario: { version: 1, steps: [{ type: "assert", key: "count", equals: 99 }] } });
    assert.equal(failed.status, "failed");
    assert.match(failed.stages.find(x => x.stage === "scenario").error, /SCENARIO_ASSERT:count/);
    const b = session({ update: n => { if (n === 2) throw new Error("boom"); } });
    await b.s.prepare(); await b.s.enter(continuity);
    const crashed = await runCheck({ session: b.s, backend: "test", bootMs: 1, frame, frames: 2, pauseHostClock() {},
        scenario: { version: 1, steps: [{ type: "wait", frames: 5 }] } });
    assert.equal(crashed.status, "failed");
    assert.match(crashed.stages.find(x => x.stage === "scenario").error, /boom/);
});

test("a game that never entered fails at boot without running the scenario", async () => {
    const { s } = session();
    const report = await runCheck({ session: s, backend: "test", bootMs: 1, frame, pauseHostClock() { throw new Error("not reached"); },
        scenario: { version: 1, steps: [{ type: "wait", frames: 1 }] } });
    assert.equal(report.status, "failed");
    assert.deepEqual(report.stages.map(x => x.stage), ["boot"]);
});
