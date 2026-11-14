import assert from "node:assert/strict";
import test from "node:test";
import { RuntimeSession, runScenario } from "../src/index.ts";
import { describeDevices, gamepadMap, parseGamepad, parseTouch, readGamepad, scanDeviceCode, stickValues, touchLayout } from "../src/devices.ts";
import { checkProfile, deviceAct } from "../src/deviceCheck.ts";

const input = {
    up: { keyboard: ["KeyW"], touch: "stick-up", gamepad: ["left-stick-up", "dpad-up"] },
    down: { touch: "stick-down", gamepad: "left-stick-down" },
    moveX: { touch: "stick-x", gamepad: "left-stick-x" },
    jump: { keyboard: ["Space"], touch: "button", gamepad: "button-a" },
    hit: { touch: "button:Hit", gamepad: ["left-bumper", "right-bumper"] },
    roster: { touch: "roster" },
    mute: { keyboard: ["KeyM"] },
};
const pad = (buttons = {}, axes = [0, 0, 0, 0]) => ({ axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: Boolean(buttons[i]), value: buttons[i] ? 1 : 0 })) });

test("touch bindings name a stick direction, an axis or a labelled button", () => {
    assert.deepEqual(parseTouch("stick-up"), { kind: "stick", axis: "y", sign: 1 });
    assert.deepEqual(parseTouch("stick-x"), { kind: "stick", axis: "x", sign: 0 });
    assert.deepEqual(parseTouch("button", "jump"), { kind: "button", label: "Jump" });
    assert.deepEqual(parseTouch("button:Hit", "flat"), { kind: "button", label: "Hit" });
    assert.equal(parseTouch("roster"), null);
    assert.equal(parseTouch(undefined), null);
    const layout = touchLayout(input);
    assert.deepEqual(layout.stick.map(s => s.action), ["up", "down", "moveX"]);
    assert.deepEqual(layout.buttons, [{ action: "jump", label: "Jump" }, { action: "hit", label: "Hit" }]);
    assert.deepEqual(layout.custom, ["roster"]);
});

test("the stick reports directions from 0 to 1 and axes from -1 to 1, never past full tilt", () => {
    const { stick } = touchLayout(input);
    assert.deepEqual(stickValues(stick, 0, 1), { up: 1, down: 0, moveX: 0 });
    assert.deepEqual(stickValues(stick, -0.5, -1), { up: 0, down: 0.894, moveX: -0.447 });
    assert.deepEqual(stickValues(stick, 0, 0), { up: 0, down: 0, moveX: 0 });
});

test("gamepad bindings follow the standard mapping, up and right positive", () => {
    assert.deepEqual(parseGamepad("button-a"), { kind: "button", index: 0 });
    assert.deepEqual(parseGamepad("dpad-right"), { kind: "button", index: 15 });
    assert.deepEqual(parseGamepad("right-stick-y"), { kind: "axis", index: 3, sign: 0, invert: true });
    assert.equal(parseGamepad("left-stick"), null);
    const map = gamepadMap(input);
    assert.deepEqual(map.map(m => m.action), ["up", "down", "moveX", "jump", "hit"]);
    // Stick pushed fully up (axis 1 is -1) and right.
    assert.deepEqual(readGamepad(map, pad({}, [1, -1, 0, 0])), { up: 0.707, down: 0, moveX: 0.707, jump: 0, hit: 0 });
    // Inside the dead zone nothing moves; the d-pad and either bumper still count.
    assert.deepEqual(readGamepad(map, pad({ 12: true, 5: true }, [0.1, 0.15, 0, 0])), { up: 1, down: 0, moveX: 0, jump: 0, hit: 1 });
    assert.deepEqual(readGamepad(map, pad({ 0: true }, [0, 1, 0, 0])), { up: 0, down: 1, moveX: 0, jump: 1, hit: 0 });
});

test("game.json devices are described, with what each claimed device lacks", () => {
    const none = describeDevices({ runtime: { input } });
    assert.deepEqual(none.declared, []);
    assert.equal(none.findings[0].code, "DEVICES_UNDECLARED");
    const bad = describeDevices({ devices: ["desktop", "headset"], runtime: { input } });
    assert.deepEqual(bad.declared, ["desktop"]);
    assert.ok(bad.findings.some(f => f.code === "DEVICES_INVALID"));
    const all = describeDevices({ devices: ["desktop", "phone", "gamepad"], runtime: { input } }, ["up", "jump", "roster", "mute"]);
    assert.deepEqual(all.declared, ["desktop", "phone", "gamepad"]);
    assert.match(all.findings.find(f => f.code === "PHONE_ACTIONS_UNREACHABLE").message, /roster, mute/);
    assert.match(all.findings.find(f => f.code === "GAMEPAD_ACTIONS_UNREACHABLE").message, /roster, mute/);
    assert.ok(all.findings.some(f => f.code === "TOUCH_CUSTOM"));
    const typo = describeDevices({ devices: ["gamepad"], runtime: { input: { jump: { gamepad: "button-z" } } } });
    assert.ok(typo.findings.some(f => f.code === "GAMEPAD_BINDING_UNKNOWN"));
});

test("source that reads touch or gamepad events itself is pointed out", () => {
    const findings = scanDeviceCode([
        { path: "src/input.js", text: "const a = 1;\nwindow.addEventListener(\"touchstart\", go);\nnavigator.getGamepads();" },
        { path: "src/game.js", text: "if (ctx.pressed.jump) jump();\n// touch the ball" },
    ]);
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /^src\/input\.js:2 .*2 lines/);
});

const continuity = { avatar: { id: "v", position: [0, 0, 0], rotation: [0, 0, 0, 1] },
    camera: { position: [0, 1, 4], target: [0, 1, 0], fov: 50, mode: "third-person" }, party: [] };
async function entered() {
    let jumps = 0;
    const session = new RuntimeSession(ctx => ({
        async prepare() {}, enter() {}, update() { if (ctx.pressed.jump) jumps++; },
        suspend() { return { jumps }; }, restore(v) { jumps = v.jumps; }, dispose() {}, inspect() { return { jumps }; },
    }), { manifest: { input, assets: [], capabilities: [] }, graphics: {}, sendUI() {},
        services: { identity: { id: "v", name: "V" }, asset: async () => new ArrayBuffer(0), call: async () => true } });
    await session.prepare(); await session.enter(continuity);
    return session;
}
const scenario = { version: 1, steps: [{ type: "action", action: "jump" }, { type: "wait", frames: 1 },
    { type: "action", action: "jump", value: 0 }, { type: "assert", key: "jumps", equals: 1 }] };

test("the check profile comes from ?check and only device profiles get a driver", async () => {
    assert.equal(checkProfile(""), null);
    assert.equal(checkProfile("?check"), "desktop");
    assert.equal(checkProfile("?check=phone"), "phone");
    assert.equal(checkProfile("?a=1&check=gamepad"), "gamepad");
    assert.equal(deviceAct(await entered(), "desktop"), undefined);
    assert.equal(deviceAct(await entered(), null), undefined);
});

test("a device scenario step passes only once the device's input reaches the session", async () => {
    const session = await entered();
    let handler, asked = [];
    // Stands in for the check script: it presses the control, then answers.
    const act = deviceAct(session, "phone", {
        post(message) { asked.push(message); queueMicrotask(() => { session.action(message.action, message.value); handler({ type: "oncyber:check-input-done", id: message.id, error: null }); }); },
        listen(h) { handler = h; return () => {}; }, wait: async () => {},
    });
    await runScenario(session, scenario, async () => {}, act);
    assert.deepEqual(asked.map(m => [m.profile, m.action, m.value]), [["phone", "jump", 1], ["phone", "jump", 0]]);
});

test("a control that is missing, or pressed without effect, fails the step", async () => {
    let handler;
    const missing = deviceAct(await entered(), "phone", {
        post(message) { queueMicrotask(() => handler({ type: "oncyber:check-input-done", id: message.id, error: "NO_TOUCH_CONTROL:jump" })); },
        listen(h) { handler = h; return () => {}; }, wait: async () => {},
    });
    await assert.rejects(runScenario(await entered(), scenario, async () => {}, missing), /NO_TOUCH_CONTROL:jump/);
    const session = await entered();
    const dead = deviceAct(session, "gamepad", {
        post(message) { queueMicrotask(() => handler({ type: "oncyber:check-input-done", id: message.id, error: null })); },
        listen(h) { handler = h; return () => {}; }, wait: async () => {},
    });
    await assert.rejects(runScenario(session, scenario, async () => {}, dead), /DEVICE_INPUT_LOST:jump/);
    const silent = deviceAct(await entered(), "phone", { post() {}, listen() { return () => {}; }, wait: async () => {}, timeoutMs: 20 });
    await assert.rejects(silent("jump", 1), /DEVICE_DRIVER_TIMEOUT/);
});
