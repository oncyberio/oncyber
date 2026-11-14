import * as THREE from "three/webgpu";
import { COURSE_LENGTH, raceStandings, segmentAt } from "./games.js";
import { RING } from "./arenas.js";
import {
    CLIMB,
    FINISH_D,
    GLIDE,
    HALF,
    START_D,
    TRACK_Y,
    pathOf,
    pathPoint,
} from "./racecourse.js";
import { WATER, heightAt } from "./terrain.js";

// Camera direction: spring-damped motion, a no-clipping resolve against the
// ground, water and solid props, and the shot list for the mini games
// (course fly-over, chase, section shots, finish orbit, dojo orbit).

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = (t) => t * t * (3 - 2 * t);

/** Critically damped spring toward `goal` (state: { p, v } Vector3s). */
export function spring(state, goal, dt, k = 4) {
    if (!state.p) {
        state.p = goal.clone();
        state.v = new THREE.Vector3();
        return state.p;
    }
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
        state.v.addScaledVector(state.p.clone().sub(goal), -k * k * h);
        state.v.multiplyScalar(Math.max(0, 1 - 2 * k * h));
        state.p.addScaledVector(state.v, h);
    }
    return state.p;
}

const ray = new THREE.Raycaster();
const dir = new THREE.Vector3();
const probe = new THREE.Vector3();

/**
 * Keep the camera out of things: pull it in toward the target when a solid
 * prop or the ground sits between them, and never below ground or water.
 */
export function resolveCamera(target, pos, occluders = [], floorExtra = null) {
    // A look target below the ground would drag the camera underground.
    const floorAt = (x, z) =>
        Math.max(
            heightAt(x, z),
            WATER,
            floorExtra ? floorExtra(x, z) : -Infinity
        ) + 0.45;
    target = target.clone();
    target.y = Math.max(target.y, floorAt(target.x, target.z) - 0.3);
    dir.subVectors(pos, target);
    let dist = dir.length();
    if (dist < 1e-3) return pos;
    dir.divideScalar(dist);
    // Ground and water along the line of sight (a heightfield march).
    for (let i = 1; i <= 16; i++) {
        const t = (i / 16) * dist;
        probe.copy(target).addScaledVector(dir, t);
        if (probe.y < floorAt(probe.x, probe.z) && t > 0.8) {
            dist = Math.max(0.8, t - 0.4);
            break;
        }
    }
    if (occluders.length) {
        ray.set(target, dir);
        ray.far = dist;
        const hit = ray.intersectObjects(occluders, true)[0];
        if (hit) dist = Math.max(0.8, hit.distance - 0.35);
    }
    pos.copy(target).addScaledVector(dir, dist);
    pos.y = Math.max(pos.y, floorAt(pos.x, pos.z));
    return pos;
}

// ------------------------------------------------------------- race shots

const INTRO = 4.5; // seconds of fly-over at the start of the countdown

/** Desired camera for Bloom Dash: { pos, look, k }. */
export function raceShot(m, course, now) {
    const views = m.views;
    const sim = m.sim;
    const center = course.center;
    const startBehind = pathPoint(START_D - 6.5, 0);
    const startLook = pathPoint(START_D + 3, 0);
    const behindStart = v3(startBehind.x, TRACK_Y + 2.6, startBehind.z);
    const lookStart = v3(startLook.x, TRACK_Y + 0.6, startLook.z);
    if (!sim || m.phase === "lobby") {
        const a = now * 0.15;
        return {
            pos: v3(
                center.x + Math.cos(a) * 32,
                24,
                center.z + Math.sin(a) * 32
            ),
            look: v3(center.x, 3, center.z),
            k: 2,
        };
    }
    if (m.phase === "countdown") {
        const elapsed = m.countTotal - m.countT;
        if (elapsed < INTRO) {
            // Fly-over: a high arc around the islet that swoops down behind
            // the start line, looking at the course then at the racers.
            const u = smooth(Math.min(1, elapsed / INTRO));
            const a = Math.PI * 0.2 + u * Math.PI * 1.1;
            const high = v3(
                center.x + Math.cos(a) * 36,
                30 - u * 8,
                center.z + Math.sin(a) * 36
            );
            const w = smooth(Math.max(0, (u - 0.55) / 0.45));
            const pos = high.lerp(behindStart, w);
            const look = v3(center.x, 3, center.z).lerp(
                lookStart,
                smooth(Math.min(1, u * 1.4))
            );
            return { pos, look, k: 6, snap: elapsed < 0.05 };
        }
        // Slow push in on the line-up.
        const k = Math.min(1, (elapsed - INTRO) / 3);
        return {
            pos: behindStart
                .clone()
                .lerp(lookStart, 0.12 * k)
                .setY(TRACK_Y + 2.6 - k * 0.4),
            look: lookStart,
            k: 3,
        };
    }
    const order = raceStandings(sim);
    const leader = order[0];
    const i = m.mine >= 0 ? m.mine : leader.lane;
    const r = sim.racers[i];
    const v = views[i];
    if (!r || !v) return { pos: behindStart, look: lookStart, k: 3 };
    const vp = v3(v.x, v.y, v.z);

    // Finished: orbit the finish gate.
    if (r.done || m.phase === "results") {
        const f = pathPoint(FINISH_D + 2, 0);
        const a = now * 0.35;
        return {
            pos: v3(
                f.x + Math.cos(a) * 7.5,
                TRACK_Y + 3.2,
                f.z + Math.sin(a) * 7.5
            ),
            look: v3(f.x, TRACK_Y + 0.9, f.z),
            k: 2.5,
        };
    }
    const seg = segmentAt(r.s).seg.kind;
    // Frame the leader too when they're close ahead.
    const lv = views[leader.lane];
    let look = vp.clone().add(v3(0, 0.5, 0));
    if (lv && leader.lane !== i) {
        const gap = Math.hypot(lv.x - v.x, lv.z - v.z);
        if (gap < 14) look.lerp(v3(lv.x, lv.y + 0.5, lv.z), 0.35);
    }
    if (seg === "swim") {
        // Low dolly alongside the pool.
        const p = pathPoint(pathOf(r.s - 1.5).d, -(HALF + 3.2));
        return { pos: v3(p.x, TRACK_Y + 1.4, p.z), look, k: 3 };
    }
    if (seg === "climb") {
        // Look up the wall from behind.
        const p = pathPoint(pathOf(CLIMB.s0 - 5.5).d, 0.6);
        return {
            pos: v3(p.x, TRACK_Y + 1.6 + (v.y - TRACK_Y) * 0.75, p.z),
            look: vp.clone().add(v3(0, 0.8, 0)),
            k: 3,
        };
    }
    if (seg === "glide") {
        // Crane shot from the outside of the curve.
        const p = pathPoint(pathOf(r.s - 0.5).d, HALF + 2.6);
        const ahead = pathPoint(pathOf(Math.min(GLIDE.s1 + 2, r.s + 4)).d, 0);
        return {
            pos: v3(p.x, v.y + 1.3, p.z),
            look: vp.clone().lerp(v3(ahead.x, TRACK_Y + 0.5, ahead.z), 0.3),
            k: 3,
        };
    }
    // Chase from behind and above, down the middle of the track.
    const back = pathPoint(pathOf(Math.min(r.s, COURSE_LENGTH) - 5.5).d, 0);
    const ahead = pathPoint(pathOf(Math.min(r.s + 4, COURSE_LENGTH + 6)).d, 0);
    look.lerp(v3(ahead.x, TRACK_Y + 0.5, ahead.z), 0.25);
    return { pos: v3(back.x, TRACK_Y + 3.1, back.z), look, k: 4 };
}

/** Dojo: a slow orbit that keeps both fighters in frame. */
export function boutShot(m, now) {
    const [a, b] = m.views;
    const mid =
        a && b
            ? v3((a.x + b.x) / 2, RING.y + 0.4, (a.z + b.z) / 2)
            : v3(RING.x, RING.y + 0.4, RING.z);
    mid.lerp(v3(RING.x, mid.y, RING.z), 0.35);
    const spread = a && b ? Math.hypot(a.x - b.x, a.z - b.z) : 3;
    const intro =
        m.phase === "countdown"
            ? Math.max(0, m.countT - 3) / Math.max(0.01, m.countTotal - 3)
            : 0;
    const ang = Math.PI / 2 + Math.sin(now * 0.15) * 0.5 + intro * 2.5;
    const dist = 5 + spread * 0.5 + intro * 8;
    return {
        pos: v3(
            mid.x + Math.cos(ang) * dist,
            RING.y + 2.6 + spread * 0.25 + intro * 6,
            mid.z + Math.sin(ang) * dist
        ),
        look: mid,
        k: 3,
    };
}
