import assert from "node:assert/strict";
import test from "node:test";
import { RuntimeSession, Journey, compactJSON, runScenario } from "../src/index.ts";
const continuity = { avatar: { id: "visitor", position: [1, 0, 3], rotation: [0, 0, 0, 1] },
    camera: { position: [1, 2, 7], target: [1, 1, 3], fov: 55, mode: "third-person" },
    party: [{ id: "friend", position: [2, 0, 3], rotation: [0, 0, 0, 1] }] };
function make(extra = {}) {
    const events = [], messages = []; let count = 0, context, arrival;
    const options = { manifest: { input: { move: { keyboard: ["KeyW"] } }, assets: ["art.bin"], capabilities: ["assets", "audio"] },
        graphics: {}, services: { identity: { id: "visitor", name: "R" },
            asset: async () => new ArrayBuffer(2), call: async () => true }, sendUI: value => messages.push(value), now: () => count * 17,
        timeoutMs: 25 };
    const session = new RuntimeSession(ctx => { context = ctx; return {
        async prepare() { events.push("prepare"); }, enter(state) { arrival = state; events.push("enter"); },
        update() { count++; ctx.ui.publish({ count }); },
        suspend() { events.push("suspend"); return { count }; },
        restore(v) { count = v.count; events.push("restore"); },
        dispose() { events.push("dispose"); },
        inspect() { return { count }; }, ...extra,
    }; }, options);
    return { session, events, messages, get context() { return context; }, get arrival() { return arrival; } };
}
test("prepare/entry, declared input, mandatory suspend/restore and idempotent disposal", async () => {
    const f = make(); await f.session.prepare(); await f.session.enter(continuity);
    f.session.action("move", 1); assert.equal(f.context.input.move, 1);
    assert.throws(() => f.session.action("unknown"), /INPUT_ACTION_INVALID/);
    assert.throws(() => { f.context.input.move = 0; }, TypeError);
    await runScenario(f.session, { version: 1, steps: [{ type: "wait", frames: 10 }, { type: "assert", key: "count", equals: 10 }] }, async () => {});
    assert.equal(f.context.input.move, 0); assert.ok(f.messages.length < f.session.frames);
    assert.deepEqual(f.arrival, continuity); assert.notEqual(f.arrival, continuity);
    await f.session.dispose(); await f.session.dispose();
    assert.equal(f.events.filter(e => e === "dispose").length, 1);
    assert.equal(f.session.phase, "disposed"); assert.throws(() => f.session.action("move"), /RUNTIME_DISPOSED/);
});
test("asset and service permissions are enforced independently of game code", async () => {
    const f = make();
    await assert.rejects(f.context.services.asset("outside.bin", f.context.signal), /ASSET_NOT_DECLARED/);
    await assert.rejects(f.context.services.call("social", "read-chat", {}, f.context.signal), /CAPABILITY_NOT_GRANTED/);
    assert.equal((await f.context.services.asset("art.bin", f.context.signal)).byteLength, 2);
    await f.session.dispose();
});
test("quick actions survive press and release between frames without latching analog coordinates",async()=>{
    const observed=[];
    const f=make({update(){observed.push({held:f.context.input.move,pressed:f.context.pressed.move});}});
    await f.session.prepare();await f.session.enter(continuity);
    f.session.action('move',1);f.session.action('move',0);
    f.session.tick(1/60);f.session.tick(1/60);
    assert.deepEqual(observed,[{held:0,pressed:true},{held:0,pressed:false}]);
    f.session.action('move',1);f.session.clearInput();f.session.tick(1/60);
    assert.deepEqual(observed.at(-1),{held:0,pressed:false});
    assert.throws(()=>{f.context.pressed.move=true;},TypeError);
    await f.session.dispose();
});
test("relative input accumulates across events, is consumed once, and clears on suspension", async () => {
    const seen=[];
    const f=make({update(){seen.push([f.context.deltas.move,f.context.input.move]);}});
    await f.session.prepare();await f.session.enter(continuity);
    f.session.action('move',0.5);
    f.session.delta('move',0.2);f.session.delta('move',0.3);f.session.delta('move',-0.1);
    f.session.tick(1/20);f.session.tick(1/60);
    assert.deepEqual(seen,[[0.4,0.5],[0,0.5]]);
    assert.throws(()=>f.session.delta('unknown',0.1),/INPUT_ACTION_INVALID/);
    assert.throws(()=>f.session.delta('move',Infinity),/INPUT_ACTION_INVALID/);
    assert.throws(()=>f.session.delta('move',2),/INPUT_ACTION_INVALID/);
    assert.throws(()=>{f.context.deltas.move=1;},TypeError);
    f.session.delta('move',0.5);await f.session.suspend();await f.session.restore();
    f.session.tick(1/60);assert.deepEqual(seen.at(-1),[0,0]);
    await f.session.dispose();
});
test("bounded readiness waits stop on the declared state and cannot silently time out", async () => {
    const f = make(); await f.session.prepare(); await f.session.enter(continuity);
    await runScenario(f.session, {version:1,steps:[
        {type:"waitUntil",key:"count",equals:3,maxFrames:6},
        {type:"assert",key:"count",equals:3},
    ]}, async()=>{});
    assert.equal(f.session.inspect().count,4); // mandatory restore frame
    await assert.rejects(runScenario(f.session,{version:1,steps:[
        {type:"waitUntil",key:"missing",equals:true,maxFrames:2},
    ]},async()=>{}),/SCENARIO_TIMEOUT:missing/);
    await f.session.dispose();
});
test("compact UI messages cannot contain functions, buffers, accessors, cycles or oversized state", () => {
    for (const value of [() => {}, new Uint8Array(2), { get evil() { throw new Error("getter ran"); } }, { s: "x".repeat(17000) }])
        assert.throws(() => compactJSON(value), /UI_MESSAGE/);
    const cyclic = {}; cyclic.self = cyclic; assert.throws(() => compactJSON(cyclic), /UI_MESSAGE/);
    assert.deepEqual(compactJSON({ score: [2, 3] }), { score: [2, 3] });
});
test("travel preloads during the animation and preserves avatar, camera and party transforms", async () => {
    const from = make(), to = make(); await from.session.prepare(); await from.session.enter(continuity);
    const journey = new Journey(from.session);
    let clap; const barrier = new Promise(r => { clap = r; });
    const move = journey.travel(to.session, continuity, barrier, async () => true);
    await new Promise(r => setTimeout(r, 0));
    assert.equal(to.session.phase, "ready"); assert.equal(from.session.phase, "entered");
    clap(); await move;
    assert.equal(journey.active, to.session); assert.deepEqual(to.arrival, continuity); assert.equal(from.session.phase, "disposed");
    await to.session.dispose();
});
test("entry failure restores previous world; removal during preparation blocks the final entry", async () => {
    for (const removed of [true, false]) {
        const from = make(), to = make(removed ? {} : { enter() { throw new Error("ENTRY_FAILED"); } });
        await from.session.prepare(); await from.session.enter(continuity);
        const journey = new Journey(from.session); let checks = 0;
        await assert.rejects(journey.travel(to.session, continuity, Promise.resolve(), async () => !removed || ++checks < 2),
            removed ? /PLATFORM_RELEASE_UNAVAILABLE/ : /ENTRY_FAILED/);
        assert.equal(journey.active, from.session); assert.equal(from.session.phase, "entered"); assert.equal(to.session.phase, "disposed");
        await from.session.dispose();
    }
});
test("a hung preparation becomes a timeout and cannot later enter", async () => {
    const f = make({ prepare: () => new Promise(() => {}) });
    await assert.rejects(f.session.prepare(), /RUNTIME_TIMEOUT/);
    assert.equal(f.session.phase, "failed"); await f.session.dispose();
});
test("cleanup failure after a travel commit does not dispose the live destination", async () => {
    const from = make({ dispose() { throw new Error("CLEANUP_FAILED"); } }), to = make();
    await from.session.prepare(); await from.session.enter(continuity);
    const journey = new Journey(from.session);
    await assert.rejects(journey.travel(to.session, continuity, Promise.resolve(), async () => true), /CLEANUP_FAILED/);
    assert.equal(journey.active, to.session); assert.equal(to.session.phase, "entered");
    to.session.tick(1 / 60); await to.session.dispose();
});
test("a hung disposer cannot indefinitely hold travel cleanup", async () => {
    const f = make({ dispose: () => new Promise(() => {}) });
    await assert.rejects(f.session.dispose(), /RUNTIME_DISPOSE_TIMEOUT/);
    assert.equal(f.session.phase, "disposed");
});
test("message traversal stops before expanding a wide shared graph", () => {
    const leaves = Array(1000).fill(1), wide = Array(1000).fill(leaves);
    assert.throws(() => compactJSON(wide), /UI_MESSAGE_SIZE/);
});
