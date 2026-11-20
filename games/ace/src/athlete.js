import { COURT, PLAYER } from "./config.js";
import { PLAY_LIMIT, sideOf } from "./rules.js";

// Shared footwork and contact rules for the human and the CPU.

export function createAthlete(who) {
    const side = sideOf(who);
    return {
        who,
        side, // +1 near half, -1 far half
        dir: -side, // forward direction along z (toward the net and beyond)
        right: side, // world x sign of the athlete's right hand side
        x: 0,
        z: side * (COURT.halfLength + 0.6),
        vx: 0,
        vz: 0,
        speed: 0,
        state: "ready", // ready | charge | swing | toss | celebrate | sad
        stateTime: 0,
        pending: null, // { shot, at } armed shot waiting for the ball
        charge: 0,
        swing: null, // { kind, shot, t, quality }
        plan: null, // { x, z } assisted contact position
        aim: { x: 0, y: 0 },
        look: { x: 0, z: 0 },
        emotion: 0,
    };
}

export function local(ath, x, z) {
    return {
        lateral: (x - ath.x) * ath.right,
        forward: (z - ath.z) * ath.dir,
    };
}

/** Is the ball coming toward this athlete's half? */
export function incoming(ath, ball) {
    return ball.v.z * ath.dir < -0.5;
}

/**
 * Best contact point along a predicted path for this athlete: the sample with
 * a comfortable height that the athlete can reach soonest relative to the
 * ball's arrival. Returns { t, x, y, z, side } or null.
 */
export function findIntercept(ath, ball, prediction, opts = {}) {
    const {
        speed = PLAYER.speed,
        allowVolley = true,
        mustBounce = false,
    } = opts;
    let best = null;
    let bestScore = Infinity;
    for (const s of prediction.samples) {
        const onMyHalf = ath.side > 0 ? s.z > 0.6 : s.z < -0.6;
        if (!onMyHalf) continue;
        if (s.bounces >= 2) break;
        if (mustBounce && s.bounces < 1) continue;
        if (!allowVolley && s.bounces < 1) continue;
        if (s.y < 0.32 || s.y > 2.1) continue;
        if (
            Math.abs(s.x) > PLAY_LIMIT.x - 1 ||
            Math.abs(s.z) > PLAY_LIMIT.z - 0.5
        )
            continue;
        // Stand beside the ball on the forehand side unless the backhand is nearer.
        const toBall = (s.x - ath.x) * ath.right;
        const hand = toBall >= -0.15 ? 1 : -1;
        const standX = s.x - hand * ath.right * PLAYER.sweetLateral;
        const standZ = s.z - ath.dir * 0.25;
        const dist = Math.hypot(standX - ath.x, standZ - ath.z);
        const need = dist / speed;
        const slack = s.t - need;
        // Prefer reachable points at a nice height, a little after the bounce.
        const heightPenalty = Math.abs(s.y - 1.0) * 0.6;
        const volleyPenalty = s.bounces < 1 ? 0.25 : 0;
        const latePenalty = slack < 0 ? 4 + -slack * 8 : 0;
        const score = latePenalty + heightPenalty + volleyPenalty + s.t * 0.15;
        if (score < bestScore) {
            bestScore = score;
            best = {
                t: s.t,
                x: s.x,
                y: s.y,
                z: s.z,
                standX,
                standZ,
                hand,
                slack,
                bounced: s.bounces >= 1,
            };
        }
    }
    return best;
}

/**
 * Can the athlete strike the ball right now? Returns contact info or null.
 * `reach` lets the CPU difficulty tune the stretch distance.
 */
export function contact(ath, ball, reach = PLAYER.reach) {
    if (!incoming(ath, ball)) return null;
    const { lateral, forward } = local(ath, ball.p.x, ball.p.z);
    const h = ball.p.y;
    if (h < 0.1 || h > 2.7) return null;
    if (forward > 0.55 || forward < -0.7) return null;
    const abs = Math.abs(lateral);
    if (abs > reach) return null;
    const lateralQ = 1 - Math.min(1, Math.abs(abs - PLAYER.sweetLateral) / 0.9);
    const heightQ = 1 - Math.min(1, Math.abs(h - PLAYER.sweetHeight) / 1.2);
    const depthQ = 1 - Math.min(1, Math.abs(forward - 0.15) / 0.7);
    const sweet = Math.max(0, lateralQ * 0.45 + heightQ * 0.3 + depthQ * 0.25);
    const stretch = abs > reach - 0.3 || h < 0.25;
    const kind = h > 1.85 ? "smash" : lateral >= -0.1 ? "forehand" : "backhand";
    return { lateral, forward, height: h, sweet, stretch, kind };
}

/** Move toward a desired velocity with snappy, slightly floaty acceleration. */
export function steer(ath, wantX, wantZ, maxSpeed, dt) {
    const accel = 38;
    const tx = wantX * maxSpeed;
    const tz = wantZ * maxSpeed;
    const dx = tx - ath.vx;
    const dz = tz - ath.vz;
    const d = Math.hypot(dx, dz);
    const stepV = accel * dt;
    if (d <= stepV) {
        ath.vx = tx;
        ath.vz = tz;
    } else {
        ath.vx += (dx / d) * stepV;
        ath.vz += (dz / d) * stepV;
    }
    ath.x += ath.vx * dt;
    ath.z += ath.vz * dt;
    // Each player stays on their own half.
    const minZ = ath.side > 0 ? 0.7 : -PLAY_LIMIT.z;
    const maxZ = ath.side > 0 ? PLAY_LIMIT.z : -0.7;
    ath.x = Math.max(-PLAY_LIMIT.x, Math.min(PLAY_LIMIT.x, ath.x));
    ath.z = Math.max(minZ, Math.min(maxZ, ath.z));
    ath.speed = Math.hypot(ath.vx, ath.vz);
}

/** Desired velocity (unit-ish) to arrive at a point, slowing in the last metre. */
export function seek(ath, x, z, maxSpeed) {
    const dx = x - ath.x;
    const dz = z - ath.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.03) return { x: 0, z: 0 };
    const scale = Math.min(1, d / Math.max(0.35, maxSpeed * 0.09));
    return { x: (dx / d) * scale, z: (dz / d) * scale };
}
