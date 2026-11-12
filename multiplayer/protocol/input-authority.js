// Shared authoritative input core. Used by workers and the deterministic feel lab.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputAuthority = void 0;
const movement_1 = require("./movement");
/** Time credit prevents clients advancing simulation faster than real time. */
class InputAuthority {
    constructor(p, now) {
        this.sequence = 0;
        this.queue = new Map();
        this.credit = 6;
        this.gapSince = 0;
        this.reset = false;
        this.yaw = 0;
        this.simulated = 0;
        this.missing = 0;
        this.state = (0, movement_1.state)(p);
        this.updated = now;
        this.lastInputAt = now;
    }
    place(p, now) {
        this.state = (0, movement_1.state)(p);
        this.queue.clear();
        this.credit = 0;
        this.updated = this.lastInputAt = now;
        this.gapSince = 0;
        this.yaw = this.state.rotation;
        this.reset = true;
        return { seq: this.sequence, state: { ...this.state }, resetInputs: true, position: [this.state.x, this.state.y, this.state.z, this.state.rotation], animation: this.state.animation, floor: this.state.floor, serverTime: now, corrected: true };
    }
    discard(inputs, now) {
        const newest = inputs[inputs.length - 1];
        if (newest && newest.sequence > this.sequence) this.sequence = newest.sequence;
        return this.place(this.state, now);
    }
    diagnostics() {
        return { queued: this.queue.size, missing: this.missing, simulated: this.simulated };
    }
    receive(inputs) {
        const newest = inputs[inputs.length - 1];
        if (newest.sequence > this.sequence) this.lastInputAt = this.updated;
        if (newest.sequence - this.sequence > 180) {
            this.sequence = newest.sequence;
            this.queue.clear();
            this.reset = true;
            this.state.vx = this.state.vz = this.state.vy = 0;
            return;
        }
        for (const i of inputs) if (i.sequence > this.sequence && this.queue.size < 180) this.queue.set(i.sequence, i);
    }
    advance(now) {
        // Preserve earned time across short worker/network pauses. A 200ms
        // cap discarded time during stalls, leaving a permanent input backlog.
        // Recovery banks at most 1.5s and still spends only 100ms per tick.
        // Quiet connections return to the ordinary 200ms allowance; clients
        // never earn more simulation time than elapsed server wall time.
        const recoveryWindow = this.queue.size > 0 || now - this.lastInputAt <= 1500;
        this.credit = Math.min(recoveryWindow ? 90 : 12, this.credit + Math.max(0, now - this.updated) / 1000 / movement_1.STEP);
        this.updated = now;
        let changed = false,
            processed = 0;
        while (this.credit >= 1 && this.queue.size && processed < 6) {
            let i = this.queue.get(this.sequence + 1);
            if (!i) {
                if (!this.gapSince) this.gapSince = now;
                if (now - this.gapSince < 100) break;
                i = { sequence: this.sequence + 1, strafe: 0, forward: 0, yaw: this.yaw, running: false, jump: false, animation: this.state.animation };
                this.missing++;
            } else this.gapSince = 0;
            this.queue.delete(i.sequence);
            this.sequence = i.sequence;
            this.yaw = i.yaw;
            (0, movement_1.step)(this.state, i);
            this.credit--;
            processed++;
            this.simulated++;
            changed = true;
        }
        if (!changed && !this.reset) return null;
        const ack = { seq: this.sequence, state: { ...this.state }, resetInputs: this.reset, position: [this.state.x, this.state.y, this.state.z, this.state.rotation], animation: this.state.animation, floor: this.state.floor, serverTime: now, corrected: this.reset };
        this.reset = false;
        return ack;
    }
}
exports.InputAuthority = InputAuthority;
