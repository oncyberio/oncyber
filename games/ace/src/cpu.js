import { COURT } from "./config.js";
import { findIntercept, incoming, seek, steer } from "./athlete.js";
import { predict } from "./physics.js";

// The CPU reads the ball after a short reaction delay, runs to a contact point,
// then recovers toward a home position biased away from the human's angle.

export function createBrain(difficulty, rng) {
    return {
        d: difficulty,
        rng,
        seenHit: -1,
        reactAt: 0,
        plan: null,
        nextShot: null,
        homeX: 0,
        netRush: false,
    };
}

/** Choose a shot type and aim for the coming contact. */
function decide(brain, ath, foe) {
    const { d, rng } = brain;
    const foeAtNet = Math.abs(foe.z) < 5.5;
    let shot = "topspin";
    const roll = rng();
    if (foeAtNet && roll < 0.4) shot = "lob";
    else if (roll < 0.15) shot = "slice";
    else if (!foeAtNet && roll < 0.22) shot = "drop";
    else if (roll < 0.6) shot = "flat";
    // Aim away from the human: their x relative to the CPU's right.
    const foeLateral = (foe.x * ath.right) / COURT.halfWidth;
    let aimX =
        -Math.sign(foeLateral || rng() - 0.5) *
        (0.45 + rng() * 0.55 * d.aggression + 0.2);
    if (rng() < 0.3 - d.aggression * 0.2) aimX = (rng() - 0.5) * 0.6;
    const aimY = rng() < 0.15 * d.aggression ? -1 : rng() * 0.6;
    const power = d.power[0] + (d.power[1] - d.power[0]) * rng();
    return {
        shot,
        aim: { x: Math.max(-1, Math.min(1, aimX)), y: aimY },
        power,
    };
}

/**
 * Update the CPU athlete. `hitCount` increments on every strike so the brain
 * can notice a new ball. Returns { wantSwing: boolean }.
 */
export function thinkCPU(brain, ath, foe, ball, hitCount, now, dt, canMove) {
    const d = brain.d;
    if (!canMove) {
        steer(ath, 0, 0, d.speed, dt);
        return { wantSwing: false };
    }
    if (hitCount !== brain.seenHit) {
        brain.seenHit = hitCount;
        brain.reactAt = now + d.reaction * (0.7 + brain.rng() * 0.6);
        brain.plan = null;
        brain.nextShot = null;
    }
    const coming = incoming(ath, ball);
    if (
        coming &&
        now >= brain.reactAt &&
        (!brain.plan || brain.replanAt <= now)
    ) {
        const prediction = predict(ball, 3.2, 3);
        const nearNet = Math.abs(ath.z) < 6.5;
        const plan = findIntercept(ath, ball, prediction, {
            speed: d.speed,
            allowVolley: nearNet || ball.bounces > 0,
            mustBounce: brain.mustBounce,
        });
        if (plan) {
            // Imperfect reads: rookies misjudge where to stand.
            const wobble = (brain.rng() - 0.5) * d.error * 0.35;
            plan.standX += wobble;
            brain.plan = plan;
            brain.nextShot = decide(brain, ath, foe);
        }
        brain.replanAt = now + 0.25;
    }
    let want = { x: 0, z: 0 };
    if (coming && brain.plan) {
        want = seek(ath, brain.plan.standX, brain.plan.standZ, d.speed);
    } else if (!coming) {
        // Recover: baseline, shading toward the side the human can angle.
        const homeZ = ath.side * (brain.netRush ? 4.5 : COURT.halfLength - 0.2);
        const homeX = Math.max(-1.6, Math.min(1.6, foe.x * 0.35));
        want = seek(ath, homeX, homeZ, d.speed * 0.8);
    }
    steer(ath, want.x, want.z, d.speed, dt);
    return { wantSwing: coming && !!brain.plan };
}
