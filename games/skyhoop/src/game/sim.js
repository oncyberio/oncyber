// Skyhoop's match simulation: riders on brooms, the Comet (the scoring ball),
// two Bolts (heavy balls that knock riders off line) and the Wisp (a quick
// glowing mote; catching it scores and ends the match). Pure and seeded: no
// three.js, no DOM, plain {x, y, z} vectors, a fixed 60 Hz step. The game
// module draws it and turns input into the player's intent; the same flight
// model flies the player and every bot.

export const STEP = 1 / 60;

/** The pitch: an oval of half-length A and half-width B, in metres. */
export const PITCH = { a: 82, b: 38, floor: 1.1, ceiling: 62 };
/** Hoops stand at x = ±HOOP_X, facing along the pitch. */
export const HOOP_X = 66;
export const HOOPS = [
    { z: -9, y: 12.5, r: 2.2 },
    { z: 0, y: 17.5, r: 2.5 },
    { z: 9, y: 12.5, r: 2.2 },
];
export const COMET_R = 0.42;
export const BOLT_R = 0.36;

export const GOAL_POINTS = 10;
export const WISP_POINTS = 30;

/** Team 0 defends the hoops at x = -HOOP_X and attacks +HOOP_X. */
export const TEAMS = [
    { name: "Ember", short: "EMB", sign: 1 },
    { name: "Tide", short: "TID", sign: -1 },
];

export const ROLES = ["runner", "runner", "runner", "keeper", "striker", "striker", "finder"];
const TOP_SPEED = { runner: 25, keeper: 22, striker: 24, finder: 29 };
const BOOST = 13;

const NAMES = [
    ["Kestrel", "Juno", "Pip", "Ash", "Marlow", "Rook", "Sable"],
    ["Wren", "Ozzie", "Tamsin", "Bly", "Corin", "Nell", "Vesper"],
];

export const DIFFICULTY = {
    easy: { react: 0.35, aimError: 0.11, speed: 0.86, steal: 0.35, keeper: 0.45, catch: 0.12 },
    normal: { react: 0.2, aimError: 0.065, speed: 0.95, steal: 0.5, keeper: 0.62, catch: 0.2 },
    hard: { react: 0.1, aimError: 0.035, speed: 1.02, steal: 0.62, keeper: 0.78, catch: 0.3 },
};

// ------------------------------------------------------------- vectors

export const vec = (x = 0, y = 0, z = 0) => ({ x, y, z });
const set = (o, x, y, z) => ((o.x = x), (o.y = y), (o.z = z), o);
const copy = (o, a) => set(o, a.x, a.y, a.z);
const addTo = (o, a, s = 1) => ((o.x += a.x * s), (o.y += a.y * s), (o.z += a.z * s), o);
const sub = (a, b) => vec(a.x - b.x, a.y - b.y, a.z - b.z);
const len = (a) => Math.hypot(a.x, a.y, a.z);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a) => {
    const l = len(a) || 1;
    return vec(a.x / l, a.y / l, a.z / l);
};
const scale = (a, s) => vec(a.x * s, a.y * s, a.z * s);
const lerpTo = (o, a, k) => set(o, o.x + (a.x - o.x) * k, o.y + (a.y - o.y) * k, o.z + (a.z - o.z) * k);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

/** Seeded random in [0, 1). */
export function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ------------------------------------------------------------- setup

/** Where a team's riders hover before the throw-up. */
function formation(team, role, index) {
    const s = TEAMS[team].sign;
    const lane = [-11, 0, 11][index % 3];
    switch (role) {
        case "runner":
            return vec(-s * 16, 15 + (index % 3 === 1 ? 3 : 0), lane);
        case "keeper":
            return vec(-s * (HOOP_X - 5), 15, 0);
        case "striker":
            return vec(-s * 28, 20, index % 2 ? 14 : -14);
        default:
            return vec(-s * 10, 34, s * 18);
    }
}

function makeRider(id, team, role, index, playerId) {
    const pos = formation(team, role, index);
    return {
        id,
        team,
        role,
        name: NAMES[team][index],
        bot: id !== playerId,
        pos,
        vel: vec(),
        fwd: vec(TEAMS[team].sign, 0, 0),
        aim: vec(TEAMS[team].sign, 0, 0),
        stamina: 1,
        boosting: false,
        stun: 0,
        spin: 0,
        invuln: 0,
        lunge: 0,
        lungeCd: 0,
        rollCd: 0,
        roll: 0,
        rollDir: 1,
        catchCd: 0,
        swatCd: 0,
        hold: 0,
        charge: 0,
        charging: false,
        swing: 0,
        think: 0,
        goal: copy(vec(), pos),
        goalSpeed: 0,
        wantBoost: false,
        intentLunge: false,
        // Visual-only signals the renderer reads (cleared by it).
        bank: 0,
    };
}

/**
 * A new match. `player` picks the team and rider the visitor flies
 * (`null` flies none: an all-bot exhibition, used by the arrival and checks).
 */
export function createMatch({ seed = 1, playerTeam = 0, playerRole = "runner", difficulty = "normal", duration = 360, wispAt = 90 } = {}) {
    const random = rng(seed);
    const riders = [];
    let playerId = -1;
    if (playerTeam !== null && playerTeam !== undefined) playerId = playerTeam * ROLES.length + Math.max(0, ROLES.indexOf(playerRole));
    for (let team = 0; team < 2; team++)
        ROLES.forEach((role, i) => riders.push(makeRider(team * ROLES.length + i, team, role, i, playerId)));
    const m = {
        seed,
        random,
        time: 0,
        clock: duration,
        duration,
        wispAt,
        phase: "kickoff",
        phaseT: 3.2,
        score: [0, 0],
        riders,
        playerId,
        difficulty: DIFFICULTY[difficulty] ? difficulty : "normal",
        comet: {
            pos: vec(0, 15, 0),
            prev: vec(0, 15, 0),
            vel: vec(),
            holder: -1,
            lastTouch: -1,
            passTo: -1,
            shotBy: -1,
            spin: 0,
        },
        bolts: [0, 1].map((i) => ({
            pos: vec(0, 22 + i * 4, i ? 20 : -20),
            vel: vec(i ? -6 : 6, 0, 0),
            target: -1,
            retarget: 1 + i,
            cool: 2,
            ignoreTeam: -1,
            ignoreT: 0,
        })),
        wisp: {
            active: false,
            pos: vec(0, 30, 0),
            vel: vec(),
            wander: vec(1, 0, 0),
            jink: 0,
            caughtBy: -1,
        },
        events: [],
        acc: 0,
        winner: -1,
        stats: { shots: [0, 0], goals: [0, 0], steals: [0, 0], hits: [0, 0], saves: [0, 0] },
    };
    return m;
}

export const playerRider = (m) => m.riders[m.playerId] || null;
const emit = (m, type, data = {}) => m.events.push({ type, t: m.time, ...data });

/** Hand the visitor a different rider of their team (runner <-> finder). */
export function swapPlayer(m, role) {
    const me = playerRider(m);
    if (!me) return null;
    const pick = m.riders.find((r) => r.team === me.team && r.role === role && r.id !== me.id) || null;
    if (!pick) return null;
    me.bot = true;
    me.charging = false;
    me.charge = 0;
    pick.bot = false;
    m.playerId = pick.id;
    emit(m, "swap", { rider: pick.id, role });
    return pick;
}

// ------------------------------------------------------------- stepping

/**
 * Advance the match by `dt` seconds in fixed steps. `input` is the player's
 * intent for this frame (see `game.js`); its one-shot fields (`pass`,
 * `roll`, `lunge`) are read in the first step only.
 */
export function stepMatch(m, dt, input = null) {
    m.acc = Math.min(m.acc + dt, 0.25);
    let first = true;
    while (m.acc >= STEP) {
        m.acc -= STEP;
        step(m, STEP, input, first);
        first = false;
    }
}

function step(m, dt, input, first) {
    m.time += dt;
    const c = m.comet;
    if (m.phase === "kickoff") {
        m.phaseT -= dt;
        if (m.phaseT <= 0) {
            m.phase = "play";
            c.holder = -1;
            set(c.pos, 0, 15, 0);
            set(c.vel, 0, 7, 0);
            emit(m, "throw-up");
        }
    } else if (m.phase === "goal") {
        m.phaseT -= dt;
        if (m.phaseT <= 0) {
            m.phase = "play";
            keeperBall(m, m.restartTeam);
        }
    } else if (m.phase === "play") {
        m.clock = Math.max(0, m.clock - dt);
        if (!m.wisp.active && m.duration - m.clock >= m.wispAt) {
            m.wisp.active = true;
            set(m.wisp.pos, (m.random() - 0.5) * 60, 30, (m.random() - 0.5) * 30);
            emit(m, "wisp", { pos: copy(vec(), m.wisp.pos) });
        }
        if (m.clock <= 0) finish(m, -1);
    }
    if (m.phase === "end") {
        // Riders drift to a hover; balls settle.
        for (const r of m.riders) {
            r.goalSpeed = 0;
            fly(m, r, dt, null);
        }
        return;
    }
    for (const r of m.riders) {
        r.stun = Math.max(0, r.stun - dt);
        r.invuln = Math.max(0, r.invuln - dt);
        r.lunge = Math.max(0, r.lunge - dt);
        r.lungeCd = Math.max(0, r.lungeCd - dt);
        r.rollCd = Math.max(0, r.rollCd - dt);
        r.roll = Math.max(0, r.roll - dt);
        r.catchCd = Math.max(0, r.catchCd - dt);
        r.swatCd = Math.max(0, r.swatCd - dt);
        r.swing = Math.max(0, r.swing - dt);
        if (r.bot) think(m, r, dt);
        fly(m, r, dt, r.bot ? null : input, first);
    }
    separate(m);
    stepComet(m, dt);
    for (const b of m.bolts) stepBolt(m, b, dt);
    if (m.wisp.active) stepWisp(m, dt);
}

function finish(m, catcher) {
    if (m.phase === "end") return;
    m.phase = "end";
    m.winner = m.score[0] === m.score[1] ? -1 : m.score[0] > m.score[1] ? 0 : 1;
    emit(m, "end", { winner: m.winner, catcher });
}

function keeperBall(m, team) {
    const keeper = m.riders.find((r) => r.team === team && r.role === "keeper");
    const c = m.comet;
    c.holder = keeper.id;
    c.passTo = -1;
    c.shotBy = -1;
    keeper.hold = 0;
    copy(c.pos, keeper.pos);
    set(c.vel, 0, 0, 0);
    emit(m, "keeper-ball", { team, rider: keeper.id });
}

// ------------------------------------------------------------- flight

const UP = vec(0, 1, 0);

function topSpeed(m, r) {
    const base = TOP_SPEED[r.role];
    return r.bot && r.team !== playerTeamOf(m) ? base * DIFFICULTY[m.difficulty].speed : base;
}
const playerTeamOf = (m) => (m.riders[m.playerId] ? m.riders[m.playerId].team : -1);

/** One rider's flight: the bot's goal or the player's input becomes a velocity. */
function fly(m, r, dt, input, first) {
    let desired;
    let rate = 2.4;
    const top = topSpeed(m, r);
    if (r.stun > 0) {
        desired = vec(0, -1.5, 0);
        rate = 1.2;
        r.spin += dt * 9 * (r.stun / 1.1);
        r.boosting = false;
    } else if (input) {
        // The player: fly where the aim points; strafe and lift on top.
        copy(r.aim, norm(input.aim));
        const right = norm(vec(-r.aim.z, 0, r.aim.x));
        const throttle = clamp(input.throttle, -1, 1);
        r.boosting = input.boost && r.stamina > 0.05 && throttle > 0;
        let speed = throttle > 0 ? top * throttle + (r.boosting ? BOOST : 0) : 0;
        desired = scale(r.aim, speed);
        addTo(desired, right, (input.strafe || 0) * 11);
        addTo(desired, UP, (input.lift || 0) * 10);
        rate = throttle > 0 ? 2.2 : throttle < 0 ? 3.6 : 0.9;
        if (first) {
            if (input.roll && r.rollCd <= 0) startRoll(m, r, input.strafe >= 0 ? 1 : -1, right);
            if (input.lunge) lungeOrThrow(m, r, input);
            if (input.pass) playerPass(m, r);
        }
        playerCharge(m, r, input, dt);
    } else {
        const to = sub(r.goal, r.pos);
        const d = len(to);
        const want = Math.min(r.goalSpeed || top, d * (r.goalSpeed >= 30 ? 7 : 1.6));
        r.boosting = r.wantBoost && r.stamina > 0.3 && d > 25;
        if (r.role === "keeper") rate = r.goalSpeed >= 30 ? 9 : 3.5;
        desired = scale(norm(to), want + (r.boosting ? BOOST : 0));
        if (d > 0.5) copy(r.aim, norm(to));
        if (r.intentLunge) {
            r.intentLunge = false;
            lungeOrThrow(m, r, null);
        }
    }
    if (r.lunge > 0) addTo(desired, r.fwd, 14);
    if (r.roll > 0) {
        const right = norm(vec(-r.fwd.z, 0, r.fwd.x));
        addTo(desired, right, r.rollDir * 16 * (r.roll / 0.55));
    }
    r.stamina = clamp(r.stamina + (r.boosting ? -0.32 : 0.16) * dt, 0, 1);
    const k = 1 - Math.exp(-rate * dt);
    const before = vec(r.vel.x, r.vel.z, 0);
    lerpTo(r.vel, desired, k);
    // Bounds: a soft floor and ceiling, and the oval's wall.
    if (r.pos.y < PITCH.floor + 1) r.vel.y += (PITCH.floor + 1 - r.pos.y) * 18 * dt;
    if (r.pos.y > PITCH.ceiling) r.vel.y -= (r.pos.y - PITCH.ceiling) * 10 * dt;
    const e = (r.pos.x / PITCH.a) ** 2 + (r.pos.z / PITCH.b) ** 2;
    if (e > 0.86) {
        const n = norm(vec(r.pos.x / PITCH.a ** 2, 0, r.pos.z / PITCH.b ** 2));
        const out = dot(r.vel, n);
        const push = (e - 0.86) * 160;
        if (out > -push * 0.1) addTo(r.vel, n, -(Math.max(0, out) * 0.12 + push * dt));
    }
    addTo(r.pos, r.vel, dt);
    r.pos.y = clamp(r.pos.y, 0.6, PITCH.ceiling + 4);
    if (e > 1.02) {
        const s = Math.sqrt(1.02 / e);
        r.pos.x *= s;
        r.pos.z *= s;
    }
    // Facing follows velocity when moving, the aim when hovering.
    const sp = len(r.vel);
    const face = sp > 3 ? scale(r.vel, 1 / sp) : r.aim;
    lerpTo(r.fwd, face, 1 - Math.exp(-(sp > 3 ? 7 : 3) * dt));
    copy(r.fwd, norm(r.fwd));
    // Bank from the turn rate (horizontal).
    const turn = before.x * r.vel.z - before.y * r.vel.x;
    const target = clamp((-turn / Math.max(40, sp * sp)) * 22, -1.1, 1.1);
    r.bank += (target - r.bank) * (1 - Math.exp(-6 * dt));
    if (r.stun <= 0) r.spin *= Math.exp(-6 * dt);
}

function startRoll(m, r, dir, right) {
    r.roll = 0.55;
    r.rollDir = dir;
    r.rollCd = 1.5;
    r.invuln = Math.max(r.invuln, 0.6);
    void right;
    emit(m, "roll", { rider: r.id });
}

function separate(m) {
    const rs = m.riders;
    for (let i = 0; i < rs.length; i++)
        for (let j = i + 1; j < rs.length; j++) {
            const a = rs[i];
            const b = rs[j];
            const d = dist(a.pos, b.pos);
            if (d > 1.6 || d < 1e-4) continue;
            const n = scale(sub(a.pos, b.pos), (1.6 - d) / d / 2);
            addTo(a.pos, n);
            addTo(b.pos, n, -1);
            // A lunge into an opponent is a tackle.
            if (a.team !== b.team) {
                tackle(m, a, b);
                tackle(m, b, a);
            }
        }
}

// ------------------------------------------------------------- actions

function lungeOrThrow(m, r, input) {
    const c = m.comet;
    if (c.holder === r.id) return;
    if (r.lungeCd > 0 || r.stun > 0) return;
    r.lunge = 0.35;
    r.lungeCd = 1.3;
    emit(m, "lunge", { rider: r.id });
    void input;
}

function tackle(m, a, b) {
    const c = m.comet;
    if (a.lunge <= 0 || c.holder !== b.id || b.invuln > 0) return;
    a.lunge = 0;
    const odds = a.bot ? DIFFICULTY[m.difficulty].steal : 0.72;
    const victim = b.bot ? 1 : 0.85;
    if (m.random() < odds * victim) {
        take(m, a, "steal");
        m.stats.steals[a.team]++;
        b.stun = Math.max(b.stun, 0.35);
    } else {
        // Fumble: the Comet pops loose.
        release(m, b, vec((m.random() - 0.5) * 8, 4, (m.random() - 0.5) * 8));
        emit(m, "fumble", { rider: b.id });
    }
}

function take(m, r, how) {
    const c = m.comet;
    const from = c.holder;
    c.holder = r.id;
    c.passTo = -1;
    c.shotBy = -1;
    c.lastTouch = r.id;
    r.hold = 0;
    r.charge = 0;
    r.charging = false;
    emit(m, how, { rider: r.id, from, team: r.team });
}

function release(m, r, vel) {
    const c = m.comet;
    c.holder = -1;
    copy(c.vel, vel);
    copy(c.pos, heldSpot(r));
    copy(c.prev, c.pos);
    r.catchCd = 0.45;
    r.charge = 0;
    r.charging = false;
}

/** Where a held Comet sits: in front of the rider's chest. */
export function heldSpot(r) {
    return vec(r.pos.x + r.fwd.x * 0.95, r.pos.y + 0.55 + r.fwd.y * 0.95, r.pos.z + r.fwd.z * 0.95);
}

function shoot(m, r, dir, power) {
    const c = m.comet;
    const speed = 27 + 19 * power;
    const v = scale(norm(dir), speed);
    addTo(v, r.vel, 0.25);
    release(m, r, v);
    c.shotBy = r.id;
    c.lastTouch = r.id;
    m.stats.shots[r.team]++;
    // The other keeper reads the shot at once.
    for (const k of m.riders) if (k.role === "keeper" && k.team !== r.team) k.think = 0;
    emit(m, "shot", { rider: r.id, team: r.team, power });
}

/** The ball velocity that meets `target` (leading it) from `from`. */
function passVelocity(from, target, speed = 30) {
    let t = dist(from, target.pos) / speed;
    const aimAt = vec(target.pos.x + target.vel.x * t, target.pos.y + target.vel.y * t + 0.4, target.pos.z + target.vel.z * t);
    t = Math.max(0.2, dist(from, aimAt) / speed);
    const v = scale(sub(aimAt, from), 1 / t);
    v.y += 0.5 * COMET_GRAVITY * t;
    return v;
}

function passTo(m, r, mate) {
    const c = m.comet;
    const v = passVelocity(heldSpot(r), mate);
    release(m, r, v);
    c.passTo = mate.id;
    c.lastTouch = r.id;
    emit(m, "pass", { rider: r.id, to: mate.id, team: r.team });
}

/** The teammate closest to the player's aim, within a wide cone. */
export function passTarget(m, r) {
    let best = null;
    let bestScore = -Infinity;
    for (const o of m.riders) {
        if (o.team !== r.team || o.id === r.id || o.stun > 0) continue;
        const to = sub(o.pos, r.pos);
        const d = len(to);
        if (d < 3 || d > 70) continue;
        const align = dot(norm(to), r.aim);
        if (align < 0.2) continue;
        const score = align * 2 - d / 60 + (o.role === "runner" ? 0.4 : 0) - (o.role === "keeper" ? 0.3 : 0);
        if (score > bestScore) {
            bestScore = score;
            best = o;
        }
    }
    return best;
}

function playerPass(m, r) {
    if (m.comet.holder !== r.id || m.phase !== "play") return;
    const mate = passTarget(m, r);
    if (mate) passTo(m, r, mate);
}

/** Hold the throw to charge, release to shoot along the aim (with a gentle assist toward a hoop). */
function playerCharge(m, r, input, dt) {
    const c = m.comet;
    if (c.holder !== r.id || m.phase !== "play") {
        r.charging = false;
        r.charge = 0;
        return;
    }
    if (input.shoot) {
        r.charging = true;
        r.charge = Math.min(1, r.charge + dt / 0.75);
    } else if (r.charging) {
        const dir = assistAim(m, r, r.aim);
        shoot(m, r, dir, r.charge);
    }
}

/** The hoop an aim points at, if it points close enough. */
export function aimedHoop(m, r, aim = r.aim) {
    const sx = TEAMS[r.team].sign;
    let best = null;
    let bestAlign = 0.975;
    for (let i = 0; i < HOOPS.length; i++) {
        const h = hoopCenter(sx, i);
        const to = sub(h, r.pos);
        const d = len(to);
        if (d > 70) continue;
        const align = dot(scale(to, 1 / d), aim);
        if (align > bestAlign) {
            bestAlign = align;
            best = { index: i, center: h, distance: d, align };
        }
    }
    return best;
}

function assistAim(m, r, aim) {
    const hoop = aimedHoop(m, r, aim);
    if (!hoop) return aim;
    const want = norm(sub(hoop.center, heldSpot(r)));
    // Arc compensation for the Comet's slow fall.
    const t = hoop.distance / 36;
    want.y += (0.5 * COMET_GRAVITY * t * t) / Math.max(5, hoop.distance);
    const k = clamp((hoop.align - 0.975) / 0.02, 0, 1) * 0.85;
    return norm(lerpTo(copy(vec(), aim), norm(want), k));
}

export const hoopCenter = (side, i) => vec(side * HOOP_X, HOOPS[i].y, HOOPS[i].z);

// ------------------------------------------------------------- the Comet

const COMET_GRAVITY = 5.5;

function stepComet(m, dt) {
    const c = m.comet;
    c.spin += dt * (2 + len(c.vel) * 0.4);
    copy(c.prev, c.pos);
    if (c.holder >= 0) {
        const r = m.riders[c.holder];
        r.hold += dt;
        copy(c.pos, heldSpot(r));
        copy(c.vel, r.vel);
        return;
    }
    if (m.phase === "kickoff") {
        set(c.pos, 0, 15 + Math.sin(m.time * 2) * 0.25, 0);
        return;
    }
    c.vel.y -= COMET_GRAVITY * dt;
    const drag = Math.exp(-0.35 * dt);
    c.vel.x *= drag;
    c.vel.z *= drag;
    addTo(c.pos, c.vel, dt);
    if (c.pos.y < COMET_R + 0.1) {
        c.pos.y = COMET_R + 0.1;
        if (c.vel.y < 0) c.vel.y *= -0.45;
        c.vel.x *= 0.8;
        c.vel.z *= 0.8;
    }
    // A resting Comet floats back up to catching height.
    if (c.pos.y < 4 && Math.hypot(c.vel.x, c.vel.z) < 6) c.vel.y += (4 - c.pos.y) * 3 * dt + COMET_GRAVITY * dt * 0.8;
    const e = ((c.pos.x / PITCH.a) ** 2 + (c.pos.z / PITCH.b) ** 2) / 0.8;
    if (e > 1 && Math.abs(c.pos.x) < HOOP_X - 2) {
        const n = norm(vec(c.pos.x / PITCH.a ** 2, 0, c.pos.z / PITCH.b ** 2));
        const out = dot(c.vel, n);
        if (out > 0) addTo(c.vel, n, -1.6 * out);
        c.pos.x /= Math.sqrt(e);
        c.pos.z /= Math.sqrt(e);
    }
    if (m.phase === "play") {
        if (checkHoops(m)) return;
        catchComet(m);
    }
}

function checkHoops(m) {
    const c = m.comet;
    for (const side of [1, -1]) {
        const x = side * HOOP_X;
        const before = (c.prev.x - x) * side;
        const after = (c.pos.x - x) * side;
        if (!(before < 0 && after >= 0)) continue;
        const t = before / (before - after);
        const y = c.prev.y + (c.pos.y - c.prev.y) * t;
        const z = c.prev.z + (c.pos.z - c.prev.z) * t;
        for (let i = 0; i < HOOPS.length; i++) {
            const h = HOOPS[i];
            const d = Math.hypot(y - h.y, z - h.z);
            if (d < h.r - COMET_R * 0.5) {
                // The team attacking this end scores.
                const team = side === TEAMS[0].sign ? 0 : 1;
                m.score[team] += GOAL_POINTS;
                m.stats.goals[team]++;
                m.phase = "goal";
                m.phaseT = 3.2;
                m.restartTeam = 1 - team;
                emit(m, "goal", { team, hoop: i, side, by: c.lastTouch, pos: vec(x, h.y, h.z) });
                return true;
            }
            if (d < h.r + 0.45) {
                // Off the rim.
                c.vel.x *= -0.5;
                c.vel.y += (y - h.y) * 2;
                c.vel.z += (z - h.z) * 2;
                c.pos.x = x - side * 0.3;
                emit(m, "rim", { hoop: i, side });
                return false;
            }
        }
    }
    // Wide of the hoops and past the end: the defending keeper restarts.
    if (Math.abs(c.pos.x) > HOOP_X + 7) {
        const side = Math.sign(c.pos.x);
        const team = side === TEAMS[0].sign ? 1 : 0;
        keeperBall(m, team);
        return true;
    }
    return false;
}

function catchComet(m) {
    const c = m.comet;
    let best = null;
    let bestD = Infinity;
    for (const r of m.riders) {
        if (r.stun > 0 || r.catchCd > 0 || r.role === "striker" || r.role === "finder") continue;
        let reach = r.bot ? 1.7 : 2.6;
        if (c.passTo === r.id) reach += 1.2;
        if (r.role === "keeper") reach += c.shotBy >= 0 && m.riders[c.shotBy].team !== r.team ? 1.6 : 0.6;
        if (r.lunge > 0) reach += 0.6;
        const d = dist(r.pos, c.pos);
        if (d < reach && d < bestD) {
            bestD = d;
            best = r;
        }
    }
    if (!best) return;
    const shot = c.shotBy >= 0 && m.riders[c.shotBy].team !== best.team;
    if (shot && best.role === "keeper") {
        // A keeper's save, with the difficulty's odds for bots.
        if (best.bot && m.random() > DIFFICULTY[m.difficulty].keeper) {
            best.catchCd = 0.6;
            return;
        }
        m.stats.saves[best.team]++;
        take(m, best, "save");
        return;
    }
    const intercepted = c.passTo >= 0 && m.riders[c.passTo].team !== best.team;
    take(m, best, intercepted ? "intercept" : "catch");
}

// ------------------------------------------------------------- Bolts

function stepBolt(m, b, dt) {
    b.cool = Math.max(0, b.cool - dt);
    b.ignoreT = Math.max(0, b.ignoreT - dt);
    if (b.ignoreT <= 0) b.ignoreTeam = -1;
    b.retarget -= dt;
    if (m.phase === "kickoff") {
        set(b.vel, Math.sin(m.time * 1.3 + b.pos.z) * 3, 0, 0);
        addTo(b.pos, b.vel, dt);
        return;
    }
    if (b.retarget <= 0 || b.target < 0) pickBoltTarget(m, b);
    const target = m.riders[b.target];
    let speed = 16.5;
    if (target && b.cool <= 0) {
        const lead = scale(target.vel, 0.2);
        const want = norm(sub(addTo(copy(vec(), target.pos), lead), b.pos));
        const k = 1 - Math.exp(-1.05 * dt);
        lerpTo(b.vel, scale(want, speed), k);
    } else {
        // Coasting after a hit or a swat.
        const s = len(b.vel);
        if (s < 8) addTo(b.vel, norm(vec(-b.pos.x, 20 - b.pos.y, -b.pos.z)), 6 * dt);
    }
    addTo(b.pos, b.vel, dt);
    // Bounce off the oval and the floor and ceiling.
    if (b.pos.y < 2) b.vel.y = Math.abs(b.vel.y) + 1;
    if (b.pos.y > PITCH.ceiling) b.vel.y = -Math.abs(b.vel.y);
    const e = (b.pos.x / PITCH.a) ** 2 + (b.pos.z / PITCH.b) ** 2;
    if (e > 0.95) {
        const n = norm(vec(b.pos.x / PITCH.a ** 2, 0, b.pos.z / PITCH.b ** 2));
        const out = dot(b.vel, n);
        if (out > 0) addTo(b.vel, n, -2 * out);
    }
    for (const r of m.riders) {
        if (r.stun > 0 || r.invuln > 0 || r.team === b.ignoreTeam) continue;
        const d = dist(r.pos, b.pos);
        // Strikers swat a Bolt that comes within reach.
        if (r.role === "striker" && d < (r.bot ? 2.6 : 3.4) && r.swatCd <= 0) {
            swat(m, r, b);
            continue;
        }
        if (d < 1.05 && b.cool <= 0) {
            hit(m, r, b);
            break;
        }
    }
}

function pickBoltTarget(m, b) {
    const c = m.comet;
    let total = 0;
    const weights = m.riders.map((r) => {
        let w = 1;
        if (r.id === c.holder) w = 4;
        if (r.role === "finder" && m.wisp.active) w = 2.5;
        if (r.role === "striker") w = 0.4;
        if (!r.bot) w *= 1.15;
        // Nearer riders are likelier.
        w *= 1 / (1 + dist(r.pos, b.pos) / 40);
        total += w;
        return w;
    });
    let pick = m.random() * total;
    for (let i = 0; i < weights.length; i++) {
        pick -= weights[i];
        if (pick <= 0) {
            b.target = i;
            break;
        }
    }
    b.retarget = 4 + m.random() * 3.5;
    b.cool = Math.max(b.cool, 0.8);
}

function swat(m, r, b) {
    r.swatCd = 0.7;
    r.swing = 0.3;
    const foes = m.riders.filter((o) => o.team !== r.team && o.stun <= 0);
    const c = m.comet;
    let target = foes.find((o) => o.id === c.holder) || null;
    if (!target && m.wisp.active) target = foes.find((o) => o.role === "finder") || null;
    if (!target || dist(target.pos, r.pos) > 60) {
        // The nearest foe ahead.
        let best = Infinity;
        for (const o of foes) {
            const d = dist(o.pos, r.pos);
            if (d < best) {
                best = d;
                target = o;
            }
        }
    }
    // The player swats along the aim.
    let dir = !r.bot ? r.aim : target ? norm(sub(addTo(copy(vec(), target.pos), target.vel, 0.4), b.pos)) : r.fwd;
    if (!r.bot && target) {
        const toT = norm(sub(target.pos, b.pos));
        if (dot(toT, r.aim) > 0.93) dir = toT;
    }
    copy(b.vel, scale(dir, 33));
    b.target = target ? target.id : -1;
    b.retarget = 2.5;
    b.cool = 0.9;
    b.ignoreTeam = r.team;
    b.ignoreT = 1.4;
    emit(m, "swat", { rider: r.id, team: r.team, pos: copy(vec(), b.pos) });
}

function hit(m, r, b) {
    r.stun = 1.1;
    r.spin = 0;
    const push = norm(b.vel);
    addTo(r.vel, push, 12);
    r.vel.y += 3;
    const c = m.comet;
    if (c.holder === r.id) release(m, r, vec(push.x * 6 + r.vel.x * 0.3, 5, push.z * 6 + r.vel.z * 0.3));
    copy(b.vel, scale(push, -9));
    b.vel.y += 6;
    b.cool = 1.6;
    b.retarget = 1.6;
    b.target = -1;
    if (b.ignoreTeam >= 0) m.stats.hits[b.ignoreTeam]++;
    emit(m, "hit", { rider: r.id, team: r.team, pos: copy(vec(), b.pos) });
}

// ------------------------------------------------------------- the Wisp

function stepWisp(m, dt) {
    const w = m.wisp;
    w.jink -= dt;
    // Nearest finder chasing it.
    let chaser = null;
    let near = Infinity;
    for (const r of m.riders) {
        if (r.role !== "finder" || r.stun > 0) continue;
        const d = dist(r.pos, w.pos);
        if (d < near) {
            near = d;
            chaser = r;
        }
    }
    if (w.jink <= 0) {
        w.jink = 0.5 + m.random() * 1.2;
        set(w.wander, m.random() - 0.5, (m.random() - 0.5) * 0.6, m.random() - 0.5);
        copy(w.wander, norm(w.wander));
    }
    let want = scale(w.wander, 13);
    if (chaser && near < 16) {
        const away = norm(sub(w.pos, chaser.pos));
        const side = norm(vec(-away.z, away.y * 0.3, away.x));
        const s = 23 + (16 - near) * 0.6;
        want = addTo(scale(away, s * 0.75), side, s * 0.55 * (w.jink > 0.8 ? 1 : -1));
    }
    // Stay over the pitch and between 4 m and 45 m up.
    const e = (w.pos.x / (PITCH.a - 8)) ** 2 + (w.pos.z / (PITCH.b - 6)) ** 2;
    if (e > 0.8) addTo(want, norm(vec(-w.pos.x, 0, -w.pos.z)), 20 * (e - 0.8) * 5);
    if (w.pos.y < 5) want.y += 10;
    if (w.pos.y > 44) want.y -= 10;
    lerpTo(w.vel, want, 1 - Math.exp(-3.2 * dt));
    addTo(w.pos, w.vel, dt);
    w.pos.y = clamp(w.pos.y, 3, 50);
    // A catch.
    for (const r of m.riders) {
        if (r.role !== "finder" || r.stun > 0 || m.phase !== "play") continue;
        const reach = (r.bot ? 1.25 : 2.1) + (r.lunge > 0 ? 0.8 : 0);
        if (dist(r.pos, w.pos) > reach) continue;
        // Bots close in many times before a clean grab.
        if (r.bot && m.random() > DIFFICULTY[m.difficulty].catch * 0.1) {
            w.jink = 0;
            continue;
        }
        w.caughtBy = r.id;
        w.active = false;
        m.score[r.team] += WISP_POINTS;
        emit(m, "wisp-catch", { rider: r.id, team: r.team, pos: copy(vec(), w.pos) });
        finish(m, r.id);
        return;
    }
}

// ------------------------------------------------------------- bots

function think(m, r, dt) {
    r.think -= dt;
    if (r.think > 0) return;
    r.think = DIFFICULTY[m.difficulty].react * (0.6 + m.random() * 0.8);
    r.wantBoost = false;
    r.goalSpeed = 0;
    if (m.phase === "kickoff") {
        const idx = m.riders.filter((o) => o.team === r.team && o.role === r.role).indexOf(r);
        copy(r.goal, formation(r.team, r.role, r.role === "runner" ? idx : r.role === "striker" ? idx : 0));
        r.goalSpeed = 12;
        return;
    }
    if (m.phase === "goal") {
        // Regroup toward the middle.
        const s = TEAMS[r.team].sign;
        set(r.goal, -s * 15 + (r.id % 3) * 4, 18 + (r.id % 4) * 3, (r.id % 5) * 6 - 12);
        if (r.role === "keeper") set(r.goal, -s * (HOOP_X - 5), 16, 0);
        r.goalSpeed = 14;
        return;
    }
    switch (r.role) {
        case "runner":
            return runner(m, r);
        case "keeper":
            return keeper(m, r);
        case "striker":
            return striker(m, r);
        default:
            return finder(m, r);
    }
}

function runner(m, r) {
    const c = m.comet;
    const s = TEAMS[r.team].sign;
    const carrier = c.holder >= 0 ? m.riders[c.holder] : null;
    if (carrier === r) return carry(m, r);
    const mates = m.riders.filter((o) => o.team === r.team && o.role === "runner");
    const lane = mates.indexOf(r);
    if (carrier && carrier.team === r.team) {
        // Support: run ahead of the carrier in a lane.
        const laneZ = [-12, 0, 12][lane];
        const laneY = [12, 20, 14][lane];
        set(r.goal, clamp(carrier.pos.x + s * 14, -HOOP_X + 6, HOOP_X - 8), laneY, laneZ);
        r.wantBoost = Math.abs(r.pos.x - r.goal.x) > 20;
        return;
    }
    if (carrier) {
        // Defend: the nearest runner presses, the others mark lanes.
        const presser = nearest(mates, carrier.pos);
        if (presser === r) {
            const ahead = addTo(copy(vec(), carrier.pos), carrier.vel, 0.35);
            copy(r.goal, ahead);
            r.wantBoost = true;
            if (dist(r.pos, carrier.pos) < 4.5 && r.lungeCd <= 0 && m.random() < 0.7) r.intentLunge = true;
        } else {
            const ownHoop = hoopCenter(-s, lane % 3);
            lerpTo(copy(r.goal, carrier.pos), ownHoop, 0.45);
        }
        return;
    }
    // Loose Comet: the two nearest chase where it is going.
    const order = [...mates].sort((a, b) => dist(a.pos, c.pos) - dist(b.pos, c.pos));
    if (order.indexOf(r) < 2) {
        const t = clamp(dist(r.pos, c.pos) / 25, 0, 1.2);
        set(r.goal, c.pos.x + c.vel.x * t, Math.max(2, c.pos.y + c.vel.y * t - 2.5 * t * t), c.pos.z + c.vel.z * t);
        r.wantBoost = true;
    } else {
        set(r.goal, c.pos.x * 0.6 - s * 10, 16, [-12, 0, 12][lane]);
    }
}

function carry(m, r) {
    const s = TEAMS[r.team].sign;
    const diff = DIFFICULTY[m.difficulty];
    const foes = m.riders.filter((o) => o.team !== r.team);
    const keeper = foes.find((o) => o.role === "keeper");
    // Aim at the hoop the keeper covers least.
    let target = 0;
    let bestGap = -1;
    for (let i = 0; i < HOOPS.length; i++) {
        const gap = dist(hoopCenter(s, i), keeper.pos) + (i === r.id % 3 ? 2 : 0);
        if (gap > bestGap) {
            bestGap = gap;
            target = i;
        }
    }
    const hoop = hoopCenter(s, target);
    const dHoop = dist(r.pos, hoop);
    // Approach to a point in front of the hoop, then shoot.
    const approach = vec(hoop.x - s * 18, hoop.y + 1, hoop.z * 0.8);
    copy(r.goal, dHoop > 26 ? approach : hoop);
    r.wantBoost = dHoop > 40;
    const pressure = foes.reduce((p, o) => {
        const d = dist(o.pos, r.pos);
        return o.role === "runner" && d < 7 ? Math.max(p, 1 - d / 7) : p;
    }, 0);
    const front = (hoop.x - r.pos.x) * s;
    if (dHoop < 28 && front > 8 && r.hold > 0.5) {
        const aim = norm(sub(hoop, heldSpot(r)));
        const t = dHoop / 36;
        aim.y += (0.5 * COMET_GRAVITY * t * t) / dHoop;
        const err = diff.aimError * (1 + pressure);
        aim.x += (m.random() - 0.5) * err;
        aim.y += (m.random() - 0.5) * err;
        aim.z += (m.random() - 0.5) * err * 1.6;
        shoot(m, r, aim, 0.55 + m.random() * 0.4);
        return;
    }
    if (pressure > 0.45 && r.hold > 0.6) {
        // Pass to the most open runner ahead.
        let best = null;
        let bestScore = -Infinity;
        for (const o of m.riders) {
            if (o.team !== r.team || o === r || o.stun > 0 || o.role === "striker" || o.role === "finder") continue;
            const open = foes.reduce((mn, f) => Math.min(mn, dist(f.pos, o.pos)), 99);
            const ahead = (o.pos.x - r.pos.x) * s;
            const score = Math.min(open, 15) + ahead * 0.4 - dist(o.pos, r.pos) * 0.08 - (o.role === "keeper" ? 10 : 0);
            if (score > bestScore) {
                bestScore = score;
                best = o;
            }
        }
        if (best && bestScore > 4) return passTo(m, r, best);
        if (r.rollCd <= 0 && m.random() < 0.5) startRoll(m, r, m.random() < 0.5 ? -1 : 1, null);
    }
}

function keeper(m, r) {
    const s = TEAMS[r.team].sign;
    const c = m.comet;
    if (c.holder === r.id) {
        r.goalSpeed = 6;
        set(r.goal, -s * (HOOP_X - 10), 15, 0);
        if (r.hold > 0.9) {
            const mates = m.riders.filter((o) => o.team === r.team && o.role === "runner" && o.stun <= 0);
            const open = mates.sort((a, b) => dist(b.pos, r.pos) * 0 + a.pos.x * -s - b.pos.x * -s)[0];
            if (open) passTo(m, r, open);
        }
        return;
    }
    const home = vec(-s * (HOOP_X - 3.5), 15, 0);
    // Slide across the hoops toward the Comet's line.
    const threat = (c.pos.x * -s) / HOOP_X; // 1 at our end
    const k = clamp(threat, 0, 1);
    set(r.goal, home.x, clamp(c.pos.y, 11, 19) * k + 15 * (1 - k), clamp(c.pos.z, -10, 10) * k);
    if (c.holder < 0 && c.vel.x * -s > 6 && dist(c.pos, r.pos) < 24) {
        // A shot coming in: meet it on the line.
        const t = Math.abs((r.pos.x - c.pos.x) / (c.vel.x || 1));
        set(r.goal, home.x, clamp(c.pos.y + c.vel.y * t, 9, 21), clamp(c.pos.z + c.vel.z * t, -12, 12));
        r.goalSpeed = 30;
        r.wantBoost = true;
    }
}

function striker(m, r) {
    const mates = m.riders.filter((o) => o.team === r.team);
    // Guard the Bolt most likely to hurt a teammate.
    let best = null;
    let bestScore = Infinity;
    for (const b of m.bolts) {
        const victim = m.riders[b.target];
        let score = dist(b.pos, r.pos);
        if (victim && victim.team === r.team) score -= 20;
        if (b.ignoreTeam === r.team) score += 30;
        if (score < bestScore) {
            bestScore = score;
            best = b;
        }
    }
    const pair = mates.filter((o) => o.role === "striker").indexOf(r);
    if (best && bestScore < 16) {
        // Get to the Bolt's path, a little ahead of it.
        set(r.goal, best.pos.x + best.vel.x * 0.25, best.pos.y + best.vel.y * 0.25, best.pos.z + best.vel.z * 0.25);
        r.wantBoost = dist(r.pos, best.pos) > 18;
        return;
    }
    // Otherwise ride escort near the team's carrier or the middle.
    const c = m.comet;
    const anchor = c.holder >= 0 && m.riders[c.holder].team === r.team ? m.riders[c.holder].pos : c.pos;
    set(r.goal, anchor.x - TEAMS[r.team].sign * 6, anchor.y + 5, anchor.z + (pair ? 8 : -8));
}

function finder(m, r) {
    const w = m.wisp;
    if (!w.active) {
        // Circle high, scanning.
        const t = m.time * 0.18 + r.team * Math.PI;
        set(r.goal, Math.cos(t) * 46, 36 + Math.sin(t * 2) * 5, Math.sin(t) * 22);
        r.goalSpeed = 15;
        return;
    }
    const lead = clamp(dist(r.pos, w.pos) / 30, 0, 0.8);
    set(r.goal, w.pos.x + w.vel.x * lead, w.pos.y + w.vel.y * lead, w.pos.z + w.vel.z * lead);
    r.wantBoost = true;
    if (dist(r.pos, w.pos) < 3.5 && r.lungeCd <= 0) r.intentLunge = true;
}

function nearest(list, p) {
    let best = null;
    let bd = Infinity;
    for (const o of list) {
        if (o.stun > 0) continue;
        const d = dist(o.pos, p);
        if (d < bd) {
            bd = d;
            best = o;
        }
    }
    return best;
}

/** Plain facts for inspect() and tests. */
export function summary(m) {
    return {
        phase: m.phase,
        clock: Math.round(m.clock),
        score: `${m.score[0]}-${m.score[1]}`,
        holder: m.comet.holder,
        wisp: m.wisp.active,
        winner: m.winner,
    };
}
