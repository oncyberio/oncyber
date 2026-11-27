import { BALL_RADIUS, COURT, GRAVITY, SHOTS } from "./config.js";

// Ball flight uses constant acceleration per segment (gravity plus a spin term),
// so the shot solver below is exact and prediction matches the real ball.

export const STEP = 1 / 240;

export function createBall() {
    return {
        p: { x: 0, y: 1, z: 0 },
        v: { x: 0, y: 0, z: 0 },
        spinAccel: 0, // extra downward acceleration
        shot: "topspin",
        bounces: 0,
        spinVisual: 0,
        netTouched: false,
        held: false, // during a serve toss before release, follows hand when true
    };
}

export function netHeightAt(x) {
    const t = Math.min(1, Math.abs(x) / COURT.postX);
    return COURT.netCenter + (COURT.netPost - COURT.netCenter) * t * t;
}

/**
 * Advance the ball one fixed step. Returns a list of events:
 * { type: "bounce", x, z, speed } | { type: "net", cord: boolean }.
 */
export function stepBall(ball, dt = STEP, events = []) {
    if (ball.held) return events;
    const ay = -(GRAVITY + ball.spinAccel);
    const p = ball.p;
    const v = ball.v;
    const pz = p.z;
    const nx = p.x + v.x * dt;
    const ny = p.y + v.y * dt + 0.5 * ay * dt * dt;
    const nz = p.z + v.z * dt;
    v.y += ay * dt;

    // Net plane crossing.
    if (pz > 0 !== nz > 0 && Math.abs(nx) < COURT.postX + 0.2) {
        const top = netHeightAt(nx);
        if (ny < top + BALL_RADIUS) {
            const cord = ny > top - 0.05 && !ball.netTouched;
            ball.netTouched = true;
            if (cord) {
                // Clipped the tape: pops up and dribbles over at a fraction of speed.
                v.z *= 0.32;
                v.x *= 0.5;
                v.y = Math.abs(v.y) * 0.25 + 1.6;
                ball.spinAccel = 0;
                p.x = nx;
                p.y = top + BALL_RADIUS + 0.01;
                p.z = nz;
                events.push({ type: "net", cord: true, x: nx, y: top });
                return events;
            }
            v.z *= -0.12;
            v.x *= 0.3;
            v.y *= 0.2;
            p.x = nx;
            p.y = Math.max(ny, BALL_RADIUS);
            p.z = pz > 0 ? 0.06 : -0.06;
            events.push({ type: "net", cord: false, x: nx, y: ny });
            return events;
        }
    }

    if (ny <= BALL_RADIUS && v.y < 0) {
        const recipe = SHOTS[ball.shot] || SHOTS.topspin;
        const speed = Math.hypot(v.x, v.y, v.z);
        p.x = nx;
        p.z = nz;
        p.y = BALL_RADIUS;
        const first = ball.bounces === 0;
        v.y = -v.y * (first ? recipe.bounce : 0.55);
        const skid = first ? recipe.skid : 0.8;
        v.x *= skid;
        v.z *= skid;
        // Spin bites on the first bounce and then mostly washes out.
        ball.spinAccel *= 0.25;
        ball.bounces += 1;
        if (v.y < 0.4) v.y = 0;
        events.push({
            type: "bounce",
            x: nx,
            z: nz,
            speed,
            index: ball.bounces,
        });
        return events;
    }

    p.x = nx;
    p.y = ny;
    p.z = nz;
    if (p.y <= BALL_RADIUS && v.y === 0) {
        // Rolling: friction.
        p.y = BALL_RADIUS;
        v.x *= 0.995;
        v.z *= 0.995;
    }
    return events;
}

export function cloneBall(ball) {
    return {
        ...ball,
        p: { ...ball.p },
        v: { ...ball.v },
    };
}

/**
 * Sample the ball's future. Returns { samples: [{t,x,y,z,bounces}], bounces: [{t,x,z}] }.
 * Samples are taken every `every` steps.
 */
export function predict(ball, maxTime = 3, every = 4) {
    const sim = cloneBall(ball);
    sim.held = false;
    const samples = [];
    const bounces = [];
    const events = [];
    let t = 0;
    let n = 0;
    let net = null;
    while (t < maxTime) {
        events.length = 0;
        stepBall(sim, STEP, events);
        t += STEP;
        n += 1;
        for (const e of events) {
            if (e.type === "bounce") bounces.push({ t, x: e.x, z: e.z });
            if (e.type === "net" && !net) net = { t, cord: e.cord };
        }
        if (n % every === 0)
            samples.push({
                t,
                x: sim.p.x,
                y: sim.p.y,
                z: sim.p.z,
                bounces: sim.bounces,
            });
        if (sim.bounces >= 3) break;
    }
    return { samples, bounces, net };
}

/**
 * Solve the launch velocity that lands the ball at `target` (y = radius) after
 * `time` seconds, then lengthen the flight until the ball clears the net by
 * `clear` metres. Returns { v, time, spinAccel }.
 */
export function solveShot(from, target, time, shotName, clear = 0.3) {
    const recipe = SHOTS[shotName] || SHOTS.topspin;
    const g = GRAVITY + recipe.spin;
    let T = time;
    for (let i = 0; i < 24; i++) {
        const vx = (target.x - from.x) / T;
        const vz = (target.z - from.z) / T;
        const vy = (BALL_RADIUS - from.y + 0.5 * g * T * T) / T;
        const crosses = from.z > 0 !== target.z > 0;
        if (!crosses)
            return {
                v: { x: vx, y: vy, z: vz },
                time: T,
                spinAccel: recipe.spin,
            };
        const tn = -from.z / vz;
        const xn = from.x + vx * tn;
        const hn = from.y + vy * tn - 0.5 * g * tn * tn;
        if (hn >= netHeightAt(xn) + BALL_RADIUS + clear)
            return {
                v: { x: vx, y: vy, z: vz },
                time: T,
                spinAccel: recipe.spin,
            };
        T *= 1.05;
    }
    const vx = (target.x - from.x) / T;
    const vz = (target.z - from.z) / T;
    const vy = (BALL_RADIUS - from.y + 0.5 * g * T * T) / T;
    return { v: { x: vx, y: vy, z: vz }, time: T, spinAccel: recipe.spin };
}

/** Launch the ball from `from` toward `target`. */
export function launch(ball, from, target, shotName, power, opts = {}) {
    const recipe = SHOTS[shotName] || SHOTS.topspin;
    const time =
        (recipe.time[0] + (recipe.time[1] - recipe.time[0]) * power) *
        (opts.timeScale || 1);
    const solved = solveShot(
        from,
        target,
        time,
        shotName,
        opts.clear ?? recipe.clear
    );
    ball.p = { ...from };
    ball.v = solved.v;
    ball.spinAccel = solved.spinAccel;
    ball.shot = shotName;
    ball.bounces = 0;
    ball.netTouched = false;
    ball.held = false;
    return solved;
}

export function inSingles(x, z, side) {
    // side: +1 for the near half (z > 0), -1 for the far half.
    const r = BALL_RADIUS;
    if (Math.abs(x) > COURT.halfWidth + r) return false;
    if (side > 0) return z >= -r && z <= COURT.halfLength + r;
    return z <= r && z >= -COURT.halfLength - r;
}

/** Service box on the receiver's half. `boxSign` is the sign of x for the box. */
export function inServiceBox(x, z, receiverSide, boxSign) {
    const r = BALL_RADIUS;
    const zOk =
        receiverSide > 0
            ? z >= -r && z <= COURT.serviceLine + r
            : z <= r && z >= -COURT.serviceLine - r;
    const xOk =
        boxSign > 0
            ? x >= -r && x <= COURT.halfWidth + r
            : x <= r && x >= -COURT.halfWidth - r;
    return zOk && xOk;
}
