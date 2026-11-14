// Mini game simulations: Bloom Dash (an obstacle race) and Bump Bout (a
// ring-out scuffle). Deterministic from a seed and the cheer inputs, with no
// rendering, so one client can host and the rest just draw its snapshots.

import { rng } from "./sim.js";

// ------------------------------------------------------------------ race

export const COURSE = [
    { kind: "run", len: 26 },
    { kind: "swim", len: 14 },
    { kind: "run", len: 8 },
    { kind: "climb", len: 5 },
    { kind: "glide", len: 12 },
    { kind: "run", len: 24 },
];
export const COURSE_LENGTH = COURSE.reduce((s, c) => s + c.len, 0);
// Fruit floating over every lane: run through one for a burst.
export const RACE_FRUITS = [7, 15, 21, 42, 69, 76].map((s, i) => ({
    s,
    kind: ["puffberry", "sunpeach", "moonplum"][i % 3],
}));
export const RACE_LIMIT = 150;

const SEGMENT_STAT = { run: "run", swim: "swim", climb: "power", glide: "fly" };

/** Which course segment `s` metres in falls on, and how far into it. */
export function segmentAt(s) {
    let start = 0;
    for (let i = 0; i < COURSE.length; i++) {
        const seg = COURSE[i];
        if (s < start + seg.len || i === COURSE.length - 1)
            return { i, seg, start, u: Math.min(1, (s - start) / seg.len) };
        start += seg.len;
    }
}

export function segmentSpeed(kind, lv) {
    switch (kind) {
        case "swim":
            return 1.3 + lv * 0.04;
        case "climb":
            return 0.6 + lv * 0.025;
        case "glide":
            return 2.1 + lv * 0.045;
        default:
            return 2.7 + lv * 0.045;
    }
}

/**
 * entrants: [{ stats: { swim: {lv}, ... }, happy }]. Up to 4 lanes.
 */
export function createRace(entrants, seed) {
    return {
        t: 0,
        seed,
        rand: rng(seed),
        over: false,
        finished: 0,
        racers: entrants.slice(0, 4).map((e, lane) => ({
            lane,
            lv: {
                swim: e.stats.swim.lv,
                fly: e.stats.fly.lv,
                run: e.stats.run.lv,
                power: e.stats.power.lv,
                stamina: e.stats.stamina.lv,
            },
            happy: e.happy ?? 0,
            s: 0,
            v: 0,
            stam: 1,
            act: "run",
            hold: 0,
            boost: 0,
            cheerCd: 0,
            done: false,
            time: 0,
            place: 0,
            fruit: 0,
        })),
        pickups: [],
    };
}

export function stepRace(race, dt) {
    if (race.over) return;
    race.t += dt;
    const R = race.rand;
    for (const r of race.racers) {
        r.boost = Math.max(0, r.boost - dt);
        r.cheerCd = Math.max(0, r.cheerCd - dt);
        if (r.done) {
            r.v = 0;
            continue;
        }
        const { seg } = segmentAt(r.s);
        if (r.hold > 0) {
            // Stopped: tripped, distracted or catching its breath.
            r.hold -= dt;
            r.v = 0;
            r.stam = Math.min(1, r.stam + dt * 0.08);
            if (r.hold <= 0) r.act = seg.kind;
            continue;
        }
        // Little dramas, rarer for happy, well-trained bloomlings.
        const distract = Math.max(0.004, 0.035 - r.happy / 3000) * dt;
        const trip = seg.kind === "run" ? 0.02 * (1 - r.lv.run / 120) * dt : 0;
        const roll = R();
        if (roll < distract) {
            r.act = "look";
            r.hold = 1.1;
            continue;
        }
        if (roll < distract + trip) {
            r.act = "trip";
            r.hold = 0.8;
            continue;
        }
        r.stam = Math.max(0, r.stam - dt * 0.02 * (1 - r.lv.stamina / 140));
        let v = segmentSpeed(seg.kind, r.lv[SEGMENT_STAT[seg.kind]]);
        if (r.stam < 0.2) v *= 0.6;
        if (r.boost > 0) v *= 1.3;
        r.v = v;
        r.act = r.stam < 0.2 ? "tired" : seg.kind;
        const before = r.s;
        r.s += v * dt;
        while (r.fruit < RACE_FRUITS.length && r.s >= RACE_FRUITS[r.fruit].s) {
            if (before < RACE_FRUITS[r.fruit].s) {
                r.boost = Math.max(r.boost, 1.0);
                r.stam = Math.min(1, r.stam + 0.15);
                race.pickups.push({ lane: r.lane, i: r.fruit });
            }
            r.fruit++;
        }
        if (r.s >= COURSE_LENGTH) {
            r.s = COURSE_LENGTH;
            r.done = true;
            r.time = race.t;
            r.place = ++race.finished;
            r.act = "cheer";
        }
    }
    if (race.finished === race.racers.length || race.t >= RACE_LIMIT) {
        // Anyone still out there is placed by distance.
        race.racers
            .filter((r) => !r.done)
            .sort((a, b) => b.s - a.s)
            .forEach((r) => {
                r.done = true;
                r.place = ++race.finished;
                r.time = race.t;
            });
        race.over = true;
    }
}

/** A cheer from the stands. Returns false while on cooldown. */
export function cheerRacer(race, lane) {
    const r = race.racers[lane];
    if (!r || r.done || r.cheerCd > 0) return false;
    r.cheerCd = 2.2;
    r.boost = 1.4;
    r.stam = Math.min(1, r.stam + 0.12);
    if (r.act === "look" || r.act === "trip") r.hold = Math.min(r.hold, 0.1);
    return true;
}

export function raceStandings(race) {
    return race.racers
        .slice()
        .sort((a, b) =>
            a.done && b.done
                ? a.place - b.place
                : a.done
                ? -1
                : b.done
                ? 1
                : b.s - a.s
        );
}

// ------------------------------------------------------------------ bout

export const RING_RADIUS = 4.2;
export const BOUT_LIMIT = 60;

export function createBout(a, b, seed) {
    const fighter = (e, x) => ({
        x,
        z: 0,
        vx: 0,
        vz: 0,
        face: x < 0 ? 0 : Math.PI,
        hp: 100,
        lv: {
            swim: e.stats.swim.lv,
            fly: e.stats.fly.lv,
            run: e.stats.run.lv,
            power: e.stats.power.lv,
            stamina: e.stats.stamina.lv,
        },
        act: "circle",
        timer: 0.6,
        super: false,
        cheerCd: 0,
        orbit: 1,
    });
    return {
        t: 0,
        seed,
        rand: rng(seed),
        f: [fighter(a, -2), fighter(b, 2)],
        winner: -1,
        reason: "",
        over: false,
        hits: [],
    };
}

/** The cheer gauge: a needle sweeping 0..1; the middle is the sweet spot. */
export function gauge(bout, i) {
    const p = (bout.t * 0.9 + i * 0.37) % 2;
    return p < 1 ? p : 2 - p;
}

export function cheerQuality(g) {
    const d = Math.abs(g - 0.5);
    return d < 0.06 ? "perfect" : d < 0.16 ? "good" : "miss";
}

/** Cheer for fighter i. Returns the quality, or null while on cooldown. */
export function cheerFighter(bout, i) {
    const f = bout.f[i];
    if (!f || bout.over || f.cheerCd > 0) return null;
    const q = cheerQuality(gauge(bout, i));
    f.cheerCd = q === "miss" ? 1.2 : 2;
    if (q === "perfect") f.super = true;
    else if (q === "good") f.hp = Math.min(100, f.hp + 5);
    return q;
}

export function stepBout(bout, dt) {
    if (bout.over) return;
    bout.t += dt;
    bout.hits.length = 0;
    const R = bout.rand;
    const [A, B] = bout.f;
    for (const [me, foe, i] of [
        [A, B, 0],
        [B, A, 1],
    ]) {
        me.cheerCd = Math.max(0, me.cheerCd - dt);
        me.timer -= dt;
        const dx = foe.x - me.x;
        const dz = foe.z - me.z;
        const dist = Math.hypot(dx, dz) || 1;
        const nx = dx / dist;
        const nz = dz / dist;
        if (me.act !== "dash" && me.act !== "recoil")
            me.face = Math.atan2(nx, nz);
        if (me.act === "circle") {
            const sp = 1.1 + me.lv.run * 0.018;
            // Close in while circling, and drift back toward the middle.
            const cx = -me.x * 0.15;
            const cz = -me.z * 0.15;
            me.vx +=
                (nx * sp + -nz * sp * 0.6 * me.orbit + cx - me.vx) * dt * 4;
            me.vz += (nz * sp + nx * sp * 0.6 * me.orbit + cz - me.vz) * dt * 4;
            if (dist < 2.6 && me.timer <= 0) {
                me.act = "windup";
                me.timer = Math.max(0.25, 0.6 - me.lv.run * 0.003);
            }
        } else if (me.act === "windup") {
            me.vx *= Math.exp(-dt * 10);
            me.vz *= Math.exp(-dt * 10);
            if (me.timer <= 0) {
                me.act = "dash";
                me.timer = 0.38;
                const sp = 6 + me.lv.run * 0.04;
                me.vx = nx * sp;
                me.vz = nz * sp;
            }
        } else if (me.act === "dash") {
            if (me.timer <= 0) {
                me.act = "circle";
                me.timer = 0.5 + R() * 0.6;
                me.orbit = R() < 0.5 ? -1 : 1;
            }
        } else if (me.act === "recoil" || me.act === "dodge") {
            if (me.timer <= 0) {
                me.act = "circle";
                me.timer = 0.4 + R() * 0.4;
            }
        }
        me.x += me.vx * dt;
        me.z += me.vz * dt;
        if (me.act !== "dash") {
            const k = Math.exp(-dt * 5);
            me.vx *= k;
            me.vz *= k;
        }
        void i;
    }

    // Contact.
    const dx = B.x - A.x;
    const dz = B.z - A.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.95) {
        const nx = dx / (dist || 1);
        const nz = dz / (dist || 1);
        const dashA = A.act === "dash";
        const dashB = B.act === "dash";
        const hit = (att, def, sx, sz, ai) => {
            if (def.act !== "dash" && R() < def.lv.fly * 0.004) {
                // Hop aside.
                def.act = "dodge";
                def.timer = 0.4;
                def.vx = -sz * 4;
                def.vz = sx * 4;
                bout.hits.push({ by: ai, dodge: true });
                return;
            }
            const boost = att.super ? 1.7 : 1;
            const dmg =
                Math.max(3, 9 + att.lv.power * 0.22 - def.lv.stamina * 0.08) *
                boost;
            const knock =
                Math.max(2.5, 4.6 + att.lv.power * 0.05 - def.lv.power * 0.02) *
                boost;
            def.hp = Math.max(0, def.hp - dmg);
            def.vx = sx * knock;
            def.vz = sz * knock;
            def.act = "recoil";
            def.timer = 0.6;
            att.vx = -sx * 1.5;
            att.vz = -sz * 1.5;
            att.act = "recoil";
            att.timer = 0.3;
            bout.hits.push({ by: ai, dmg, super: att.super });
            att.super = false;
        };
        if (dashA && dashB) {
            // Clash: the stronger push wins it.
            const pa = A.lv.power + (A.super ? 40 : 0) + R() * 10;
            const pb = B.lv.power + (B.super ? 40 : 0) + R() * 10;
            if (pa >= pb) hit(A, B, nx, nz, 0);
            else hit(B, A, -nx, -nz, 1);
        } else if (dashA) hit(A, B, nx, nz, 0);
        else if (dashB) hit(B, A, -nx, -nz, 1);
        else {
            // Just bumping shoulders: push apart.
            const push = (0.95 - dist) * 0.5;
            A.x -= nx * push;
            A.z -= nz * push;
            B.x += nx * push;
            B.z += nz * push;
        }
    }

    for (let i = 0; i < 2; i++) {
        const f = bout.f[i];
        if (Math.hypot(f.x, f.z) > RING_RADIUS + 0.25) {
            f.act = "out";
            return endBout(bout, 1 - i, "ring-out");
        }
        if (f.hp <= 0) {
            f.act = "dizzy";
            return endBout(bout, 1 - i, "knockout");
        }
    }
    if (bout.t >= BOUT_LIMIT) endBout(bout, A.hp >= B.hp ? 0 : 1, "decision");
}

function endBout(bout, winner, reason) {
    bout.over = true;
    bout.winner = winner;
    bout.reason = reason;
    const w = bout.f[winner];
    w.act = "win";
    w.vx = w.vz = 0;
}
