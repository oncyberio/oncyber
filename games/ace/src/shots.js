import { BALL_RADIUS, COURT, SHOTS } from "./config.js";
import { launch } from "./physics.js";

// Turning an intention (shot type, aim, power, quality) into a ball flight.

export function gaussian(rng) {
    let u = 0;
    let v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function grade(quality) {
    if (quality >= 0.86) return "perfect";
    if (quality >= 0.62) return "great";
    if (quality >= 0.35) return "nice";
    return "weak";
}

/**
 * Pick a landing point on the opponent's half.
 * aim.x: -1..1 toward the athlete's left/right; aim.y: -1 short .. +1 deep.
 */
export function rallyTarget(ath, shot, aim, power, quality, rng) {
    const toward = -ath.side; // opponent half sign
    const reachX = 2.4 + power * 1.3 + (quality >= 0.86 ? 0.35 : 0);
    let lateral = aim.x;
    if (Math.abs(aim.x) < 0.2) {
        // No input: drift cross-court from wherever we are.
        lateral = Math.max(-0.55, Math.min(0.55, (-ath.x * ath.right) / 6));
    }
    let x = ath.right * lateral * reachX;
    let depth;
    if (shot === "lob") depth = 9.6 + aim.y * 1.4;
    else if (shot === "drop") depth = 2.4 + Math.max(0, aim.y) * 0.8;
    else if (shot === "topspin")
        depth = aim.y < -0.3 ? 5.0 : 9.3 + aim.y * 1.5 + power * 0.5;
    else if (shot === "slice") depth = aim.y < -0.3 ? 4.2 : 8.2 + aim.y * 2;
    else depth = aim.y < -0.3 ? 5.6 : 8.9 + aim.y * 1.8 + power * 0.6;
    // Accuracy: the cleaner the contact the tighter the spread; power widens it.
    const g = grade(quality);
    const spread = g === "perfect" ? 0.12 : (1 - quality) * (0.9 + power * 1.1);
    x += gaussian(rng) * spread;
    depth += gaussian(rng) * spread * 1.15;
    if (g === "perfect") {
        x = Math.max(
            -COURT.halfWidth + 0.3,
            Math.min(COURT.halfWidth - 0.3, x)
        );
        depth = Math.max(2.5, Math.min(COURT.halfLength - 0.35, depth));
    }
    return { x, y: BALL_RADIUS, z: toward * depth };
}

/** boxSign: x sign of the target service box. aim.x in -1..1 (athlete's view). */
export function serveTarget(ath, boxSign, aim, quality, rng) {
    const toward = -ath.side;
    // Inside the box: wide is near the sideline, "T" is near the centre line.
    const want = Math.max(-1, Math.min(1, aim.x * ath.right * boxSign));
    let x = boxSign * (2.05 + want * 1.6);
    let depth = COURT.serviceLine - 0.75;
    const g = grade(quality);
    const spread = g === "perfect" ? 0.08 : (1 - quality) * 1.15;
    x += gaussian(rng) * spread;
    depth += Math.abs(gaussian(rng)) * spread * 1.1 - spread * 0.25;
    if (g === "perfect") {
        x =
            boxSign *
            Math.max(0.35, Math.min(COURT.halfWidth - 0.3, Math.abs(x)));
        depth = Math.min(COURT.serviceLine - 0.3, depth);
    }
    return { x, y: BALL_RADIUS, z: toward * depth };
}

export function strike(ball, from, target, shot, power, opts) {
    return launch(ball, from, target, shot, power, opts);
}

/** Push a target out of play for an unforced error. */
export function spoil(target, ath, kind, rng) {
    const toward = -ath.side;
    if (kind === "long")
        target.z = toward * (COURT.halfLength + 0.4 + rng() * 1.3);
    else if (kind === "wide")
        target.x =
            (Math.sign(target.x) || (rng() < 0.5 ? -1 : 1)) *
            (COURT.halfWidth + 0.35 + rng() * 1.2);
    return target;
}

export const SHOT_COLORS = Object.fromEntries(
    Object.entries(SHOTS).map(([k, v]) => [k, v.color])
);
