"use strict";
// Shared collision-free locomotion. Inputs are normalized before local prediction.
const STEP = 1 / 60;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angle = (v) => Math.atan2(Math.sin(v), Math.cos(v));
const finite = (v) => (Number.isFinite(v) ? v : 0);
function input(value) {
    return { strafe: Math.round(clamp(finite(value.strafe), -1, 1) * 127) / 127, forward: Math.round(clamp(finite(value.forward), -1, 1) * 127) / 127, yaw: Math.fround(angle(finite(value.yaw))), running: !!value.running, jump: !!value.jump, animation: Number.isInteger(value.animation) ? clamp(value.animation, -1, 127) : -1 };
}
function state(p = {}) {
    return { x: p.x || 0, y: p.y || 0, z: p.z || 0, rotation: p.rotation || 0, vx: 0, vz: 0, vy: 0, jumpHeld: false, jumpCount: p.y > 0 ? 1 : 0, animation: -1, floor: true };
}
// Briefly pass through walk before run/sprint: 95% run in ~0.53s and
// sprint in ~0.83s. Direction easing and short release braking are independent.
const ACCELERATION = 6.4;
function advanceVelocity(s, strafe, forward, running, dt) {
    dt = clamp(finite(dt), 0, 0.1);
    const moving = Math.abs(strafe) + Math.abs(forward) > 0.01;
    const length = Math.max(1, Math.hypot(strafe, forward));
    const target = running ? 5.4 : 3.2;
    const previousSpeed = Math.hypot(s.vx, s.vz);
    const ease = 1 - Math.exp(-(moving ? 12 : 28) * dt);
    s.vx += ((strafe / length) * target - s.vx) * ease;
    s.vz += ((forward / length) * target - s.vz) * ease;
    const speed = Math.hypot(s.vx, s.vz);
    const maximum = previousSpeed + ACCELERATION * dt;
    if (moving && speed > maximum) {
        s.vx *= maximum / speed;
        s.vz *= maximum / speed;
    }
    if (!moving && speed < 0.06) s.vx = s.vz = 0;
}
function step(s, i, dt = STEP) {
    dt = clamp(dt, 0, STEP);
    const moving = Math.abs(i.strafe) + Math.abs(i.forward) > 0.01;
    advanceVelocity(s, i.strafe, i.forward, i.running, dt);
    if (!s.y && s.vy <= 0) s.jumpCount = 0;
    s.jumpCount ??= s.y > 0 ? 1 : 0;
    if (i.jump && !s.jumpHeld && s.jumpCount < 2) {
        s.vy = 6;
        s.jumpCount++;
    }
    s.jumpHeld = i.jump;
    if (s.y > 0 || s.vy > 0) {
        s.vy -= 18 * dt;
        s.y = Math.max(0, s.y + s.vy * dt);
        if (!s.y) { s.vy = 0; s.jumpCount = 0; }
    }
    const dx = Math.cos(i.yaw) * s.vx + Math.sin(i.yaw) * s.vz;
    const dz = -Math.sin(i.yaw) * s.vx + Math.cos(i.yaw) * s.vz;
    s.x = clamp(s.x + dx * dt, -200, 200);
    s.z = clamp(s.z + dz * dt, -200, 200);
    if (Math.hypot(dx, dz) > 0.1) s.rotation = angle(s.rotation + angle(i.yaw + Math.atan2(-s.vx, -s.vz) - s.rotation) * (1 - Math.exp(-12 * dt)));
    s.animation = moving ? -1 : i.animation;
    s.floor = s.y === 0;
    return s;
}
function validState(s) {
    return !!s && ["x", "y", "z", "rotation", "vx", "vz", "vy"].every((k) => Number.isFinite(s[k])) && Math.abs(s.x) <= 200 && Math.abs(s.z) <= 200 && s.y >= 0 && s.y <= 3 && Math.hypot(s.vx, s.vz) <= 5.401 && Math.abs(s.vy) <= 12 && (s.jumpCount === undefined || (Number.isInteger(s.jumpCount) && s.jumpCount >= 0 && s.jumpCount <= 2)) && typeof s.jumpHeld === "boolean" && typeof s.floor === "boolean" && Number.isInteger(s.animation) && s.animation >= -1 && s.animation <= 127;
}
// Each datagram repeats at most twelve recent 60Hz inputs (200ms of history).
function encodeInputs(inputs) {
    if (!Array.isArray(inputs) || !inputs.length || inputs.length > 12) throw new RangeError("Invalid input batch");
    const bytes = new Uint8Array(3 + inputs.length * 12),
        view = new DataView(bytes.buffer);
    bytes[0] = 2;
    bytes[1] = 3;
    bytes[2] = inputs.length;
    inputs.forEach((v, n) => {
        if (!Number.isInteger(v.sequence) || v.sequence < 1 || v.sequence > 0xffffffff || !["strafe", "forward", "yaw"].every((k) => Number.isFinite(v[k])) || !Number.isInteger(v.animation) || v.animation < -1 || v.animation > 127) throw new RangeError("Invalid input");
        const i = input(v),
            o = 3 + n * 12;
        view.setUint32(o, v.sequence, true);
        view.setInt8(o + 4, Math.round(i.strafe * 127));
        view.setInt8(o + 5, Math.round(i.forward * 127));
        view.setFloat32(o + 6, i.yaw, true);
        bytes[o + 10] = Number(i.running) | (Number(i.jump) << 1);
        view.setInt8(o + 11, i.animation);
    });
    return bytes;
}
function decodeInputs(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes[0] !== 2 || bytes[1] !== 3 || bytes[2] < 1 || bytes[2] > 12 || bytes.length !== 3 + bytes[2] * 12) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
        out = [];
    for (let n = 0; n < bytes[2]; n++) {
        const o = 3 + n * 12,
            sequence = view.getUint32(o, true),
            strafe = view.getInt8(o + 4),
            forward = view.getInt8(o + 5),
            yaw = view.getFloat32(o + 6, true),
            flags = bytes[o + 10],
            animation = view.getInt8(o + 11);
        if (!sequence || (n && sequence <= out[n - 1].sequence) || strafe === -128 || forward === -128 || !Number.isFinite(yaw) || Math.abs(yaw) > 3.142 || flags > 3 || animation < -1) return null;
        out.push({ sequence, strafe: strafe / 127, forward: forward / 127, yaw, running: !!(flags & 1), jump: !!(flags & 2), animation });
    }
    return out;
}
module.exports = { STEP, ACCELERATION, advanceVelocity, input, state, step, validState, encodeInputs, decodeInputs };
