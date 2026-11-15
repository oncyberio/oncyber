import { PLAYER } from "./config.js";
import { setupPoint } from "./engine.js";
import { stepBall } from "./physics.js";

// 1 v 1 between two party members. One of them, the authority, runs the
// real engine with the other steering the far athlete. This file is the
// wire between them: the authority's engine packed into a snapshot about
// thirty times a second, the other side's view rebuilt from it (turned
// around, so each player sees themselves on the near half), and their
// input on the way back. Renderer-free so the tests can play a match.

const r3 = (n) => Math.round(n * 1000) / 1000;
const SHOT_NAMES = new Set(["flat", "topspin", "slice", "lob", "drop"]);
const clamp1 = (n) => (Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0);

function packAthlete(a, plan) {
    return [
        r3(a.x),
        r3(a.z),
        r3(a.vx),
        r3(a.vz),
        a.state,
        r3(a.stateTime),
        r3(a.charge),
        a.pending ? a.pending.shot : 0,
        a.swing
            ? [
                  a.swing.kind,
                  a.swing.shot,
                  r3(a.swing.t),
                  a.swing.grade,
                  a.swing.stretch ? 1 : 0,
              ]
            : 0,
        plan ? [r3(plan.standX), r3(plan.standZ), plan.hand] : 0,
    ];
}
const packSpot = (l) => (l ? [r3(l.x), r3(l.z), r3(l.t)] : 0);

// Everything below that reads a packet treats it as untrusted: another
// member's browser wrote it. Numbers must be finite, words must be short
// lowercase names (they index tables and reach the HUD), and the shape
// must be the one `snapshot` writes.
const WORD = /^[a-z-]{1,16}$/;
function clean(value, depth = 0) {
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value === "string") return WORD.test(value);
    return (
        Array.isArray(value) &&
        depth < 3 &&
        value.length <= 16 &&
        value.every((v) => clean(v, depth + 1))
    );
}
const SNAPSHOT_SHAPE = [0, 0, 0, 10, 10, 10, 8, 4, 0, 2, 2];
const listOf = (value, length) =>
    Array.isArray(value) && value.length === length;
function validSnapshot(snap) {
    return (
        listOf(snap, SNAPSHOT_SHAPE.length) &&
        clean(snap) &&
        typeof snap[1] === "string" &&
        SNAPSHOT_SHAPE.every((length, i) =>
            length ? listOf(snap[i], length) : !Array.isArray(snap[i])
        ) &&
        [snap[4], snap[5]].every(
            (a) =>
                typeof a[4] === "string" &&
                (a[7] === 0 || SHOT_NAMES.has(a[7])) &&
                (a[8] === 0 || listOf(a[8], 5)) &&
                (a[9] === 0 || listOf(a[9], 3))
        ) &&
        snap[9].every((l) => l === 0 || listOf(l, 3))
    );
}

const EVENT_TYPES = new Set([
    "setup",
    "toss",
    "retoss",
    "charge",
    "whiff",
    "hit",
    "bounce",
    "net",
    "verdict",
    "point",
    "match",
]);
const SIDES = new Set(["who", "winner", "gameWinner", "server"]);
/** An engine event off the wire, keeping only fields of the right kind. */
export function readEvent(raw) {
    if (!raw || typeof raw !== "object" || !EVENT_TYPES.has(raw.type))
        return null;
    const out = { type: raw.type };
    for (const [key, value] of Object.entries(raw).slice(0, 24)) {
        if (key === "type") continue;
        if (SIDES.has(key)) {
            if (value === 0 || value === 1 || value === null) out[key] = value;
        } else if (typeof value === "number") {
            if (Number.isFinite(value)) out[key] = value;
        } else if (typeof value === "boolean") out[key] = value;
        else if (typeof value === "string") {
            if (WORD.test(value)) out[key] = value;
        } else if (key === "games") {
            if (
                listOf(value, 2) &&
                value.every((n) => Number.isInteger(n) && n >= 0 && n < 100)
            )
                out.games = [value[0], value[1]];
        } else if (key === "target") {
            if (value && Number.isFinite(value.x) && Number.isFinite(value.z))
                out.target = { x: value.x, z: value.z };
        }
    }
    return out;
}

/** The authority's engine as one small array (see `applySnapshot`). */
export function snapshot(e) {
    const b = e.ball;
    const m = e.match;
    return [
        r3(e.time),
        e.phase,
        r3(e.phaseTime),
        [
            r3(b.p.x),
            r3(b.p.y),
            r3(b.p.z),
            r3(b.v.x),
            r3(b.v.y),
            r3(b.v.z),
            r3(b.spinAccel),
            b.bounces,
            (b.held ? 1 : 0) | (b.netTouched ? 2 : 0) | (e.ballVisible ? 4 : 0),
            b.shot,
        ],
        packAthlete(e.athletes[0], e.plans[0]),
        // A CPU standing in winds up from its own plan.
        packAthlete(e.athletes[1], e.rival ? e.plans[1] : e.brain.plan),
        [
            m.games[0],
            m.games[1],
            m.points[0],
            m.points[1],
            m.server,
            m.faults,
            m.winner ?? -1,
            m.gamesToWin,
        ],
        [
            e.rally?.lastHitter ?? -1,
            e.rally?.serving ? 1 : 0,
            e.hitCount,
            e.rallyHits,
        ],
        r3(e.tossAt),
        [packSpot(e.landings[0]), packSpot(e.landings[1])],
        [e.serveGauges[0] ?? -1, e.serveGauges[1] ?? -1],
    ];
}

/** Stats travel with a point, not with every snapshot. */
export const packStats = (m) => [
    ...m.stats.map((s) => [s.aces, s.winners, s.perfects, s.faults]),
    m.longestRally,
];

/**
 * Write a snapshot into `view` (an engine object that is never updated
 * here). `mirror` turns the court around: the guest is athlete 0 on the
 * near half of their own screen. Spectators take it as sent.
 */
export function applySnapshot(view, snap, mirror) {
    if (!validSnapshot(snap)) return false;
    const s = mirror ? -1 : 1;
    const ix = mirror ? [1, 0] : [0, 1];
    const who = (w) => (w < 0 ? null : mirror ? 1 - w : w);
    const snapTo = !view.remote;
    view.remote = true;
    view.rival = null;
    view.time = snap[0];
    view.phase = snap[1];
    view.phaseTime = snap[2];
    const [px, py, pz, vx, vy, vz, spin, bounces, flags, shot] = snap[3];
    const b = view.ball;
    b.p.x = s * px;
    b.p.y = py;
    b.p.z = s * pz;
    b.v.x = s * vx;
    b.v.y = vy;
    b.v.z = s * vz;
    b.spinAccel = spin;
    b.bounces = bounces;
    b.held = !!(flags & 1);
    b.netTouched = !!(flags & 2);
    view.ballVisible = !!(flags & 4);
    b.shot = shot;
    view.plans = [null, null];
    for (const k of [0, 1]) {
        const a = view.athletes[k];
        const p = snap[4 + ix[k]];
        a.tx = s * p[0];
        a.tz = s * p[1];
        if (snapTo) {
            a.x = a.tx;
            a.z = a.tz;
        }
        a.vx = s * p[2];
        a.vz = s * p[3];
        a.speed = Math.hypot(a.vx, a.vz);
        a.state = p[4];
        a.stateTime = p[5];
        a.charge = p[6];
        a.pending = p[7]
            ? { shot: p[7], at: view.time - p[6] * PLAYER.maxCharge }
            : null;
        a.swing = p[8]
            ? {
                  kind: p[8][0],
                  shot: p[8][1],
                  t: p[8][2],
                  grade: p[8][3],
                  stretch: !!p[8][4],
              }
            : null;
        view.plans[k] = p[9]
            ? { standX: s * p[9][0], standZ: s * p[9][1], hand: p[9][2] }
            : null;
    }
    view.plan = view.plans[0];
    // The far athlete poses from its own state, not a CPU's plan.
    view.brain.plan = view.plans[1];
    const mm = snap[6];
    const m = view.match;
    m.games = [mm[ix[0]], mm[ix[1]]];
    m.points = [mm[2 + ix[0]], mm[2 + ix[1]]];
    m.server = who(mm[4] === 1 ? 1 : 0);
    m.faults = mm[5];
    m.winner = who(mm[6] === 0 || mm[6] === 1 ? mm[6] : -1);
    m.gamesToWin = Math.max(1, Math.min(9, Math.floor(mm[7]) || 2));
    const r = snap[7];
    view.rally = {
        ...(view.rally || {}),
        lastHitter: who(r[0] === 0 || r[0] === 1 ? r[0] : -1),
        serving: !!r[1],
    };
    view.hitCount = r[2];
    view.rallyHits = r[3];
    view.tossAt = snap[8];
    const spot = (l) => (l ? { x: s * l[0], z: s * l[1], t: l[2] } : null);
    view.landings = [spot(snap[9][ix[0]]), spot(snap[9][ix[1]])];
    view.landing = view.landings[0];
    const gauge = (g) => (g < 0 ? null : g);
    view.serveGauges = [gauge(snap[10][ix[0]]), gauge(snap[10][ix[1]])];
    view.serveGauge = view.serveGauges[0] ?? undefined;
    return true;
}

export function applyStats(view, stats, mirror) {
    const count = (n) => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
    if (!listOf(stats, 3) || !listOf(stats[0], 4) || !listOf(stats[1], 4))
        return;
    const ix = mirror ? [1, 0] : [0, 1];
    for (const k of [0, 1]) {
        const [aces, winners, perfects, faults] = stats[ix[k]].map(count);
        view.match.stats[k] = { aces, winners, perfects, faults };
    }
    view.match.longestRally = count(stats[2]);
}

/** Carry a view forward between snapshots so it moves every frame. */
export function stepView(view, dt) {
    if (view.freeze > 0) {
        view.freeze -= dt;
        return;
    }
    view.time += dt;
    view.phaseTime += dt;
    const ease = Math.min(1, dt * 18);
    for (const a of view.athletes) {
        a.stateTime += dt;
        if (a.swing) {
            a.swing.t += dt;
            if (a.swing.t > 0.55) {
                a.swing = null;
                if (a.state === "swing") a.state = "ready";
            }
        }
        if (a.pending) a.charge = Math.min(1, a.charge + dt / PLAYER.maxCharge);
        a.tx += a.vx * dt;
        a.tz += a.vz * dt;
        a.x += (a.tx - a.x) * ease;
        a.z += (a.tz - a.z) * ease;
        a.look.x = view.ball.p.x;
        a.look.z = view.ball.p.z;
    }
    if (["toss", "rally", "dead", "between", "over"].includes(view.phase))
        stepBall(view.ball, dt, []);
}

/** An engine event as the guest sees it: sides swapped, court turned. */
export function mirrorEvent(e) {
    const out = { ...e };
    const flip = (key) => {
        if (typeof out[key] === "number") out[key] = 1 - out[key];
    };
    for (const key of ["who", "winner", "gameWinner", "server"]) flip(key);
    for (const key of ["x", "z"])
        if (typeof out[key] === "number") out[key] = -out[key];
    if (out.target)
        out.target = { ...out.target, x: -out.target.x, z: -out.target.z };
    if (Array.isArray(out.games)) out.games = [out.games[1], out.games[0]];
    if (out.label && typeof out.label.leader === "number")
        out.label = { ...out.label, leader: 1 - out.label.leader };
    return out;
}

/** The engine events worth sending: everything but the per-frame noise. */
export function wireEvents(events) {
    return events.map((e) => {
        const out = { ...e };
        delete out.t;
        delete out.label; // each screen words the score itself
        for (const key of ["x", "y", "z", "speed", "power"])
            if (typeof out[key] === "number") out[key] = r3(out[key]);
        if (out.target)
            out.target = { x: r3(out.target.x), z: r3(out.target.z) };
        return out;
    });
}

// ----------------------------------------------------------------- input

export const packInput = (input) => [
    r3(clamp1(input.move.x)),
    r3(clamp1(input.move.z)),
    r3(clamp1(input.aim.x)),
    r3(clamp1(input.aim.y)),
];

/** A person takes the far athlete. */
export function seatRival(engine) {
    engine.rival = {
        input: {
            move: { x: 0, z: 0 },
            aim: { x: 0, y: 0 },
            press: null,
            release: false,
            gauge: null,
        },
    };
    engine.brain.plan = null;
    engine.brain.nextShot = null;
    const a = engine.athletes[1];
    a.pending = null;
    a.charge = 0;
    if (a.state === "charge") a.state = "ready";
}

/** The CPU holds the far athlete's place (their person dropped or left). */
export function standIn(engine) {
    engine.rival = null;
    const a = engine.athletes[1];
    a.pending = null;
    a.charge = 0;
    if (a.state === "charge") a.state = "ready";
    engine.plans[1] = null;
    engine.cpuTossAt = 0;
    engine.cpuServeAt = 0;
    engine.brain.seenHit = -1;
}

/**
 * The rival's stick, sent in their own screen's axes (they see themselves
 * on the near half), turned into the far athlete's world axes. Aim is
 * already relative to the athlete.
 */
export function applyRivalMove(engine, packed) {
    const input = engine.rival?.input;
    if (!input || !Array.isArray(packed)) return;
    input.move = { x: -clamp1(packed[0]), z: -clamp1(packed[1]) };
    input.aim = { x: clamp1(packed[2]), y: clamp1(packed[3]) };
}

/** A button edge from the rival; `gauge` is the serve level they saw. */
export function applyRivalEdge(engine, kind, shot, gauge) {
    const input = engine.rival?.input;
    if (!input) return;
    if (kind === "press" && SHOT_NAMES.has(shot)) input.press = shot;
    if (kind === "release") input.release = true;
    input.gauge =
        typeof gauge === "number" && gauge >= 0 && gauge <= 1 ? gauge : null;
}

/**
 * The guest takes the match over (the authority dropped): their view
 * becomes a real engine with the CPU across the net, and the point in
 * play is replayed from the serve. Scores and stats carry over.
 */
export function adopt(view) {
    view.remote = false;
    view.rival = null;
    view.freeze = 0;
    view.events.length = 0;
    for (const a of view.athletes) {
        if (Number.isFinite(a.tx)) {
            a.x = a.tx;
            a.z = a.tz;
        }
    }
    view.brain.plan = null;
    view.brain.seenHit = -1;
    view.cpuServeAt = 0;
    if (view.match.winner === null && view.phase !== "over") setupPoint(view);
    return view;
}
