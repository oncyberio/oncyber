// The rules of a round of Lantern Tag, as plain data and pure functions (no
// renderer, no DOM), so one member of a party can run it, any other can take
// it over from a snapshot, and the tests can play whole rounds.
//
// Lanterns stand on fixed posts. A few are lit at a time; a lit lantern fades
// after LIFE seconds and counts for the night, unless a player walks up to it
// first. A round lasts `duration` seconds; the score is lanterns caught.

/** Seconds a round lasts. */
export const ROUND_SECONDS = 90;
/** Seconds a lit lantern burns before it fades. */
export const LIFE = 9;
/** Seconds between a lantern going out and the next one lighting. */
export const RELIGHT = 0.6;
/** Metres from a lit lantern's post within which a player catches it. */
export const REACH = 1.4;
/** Half the courtyard's width, and how close to the wall a player can get. */
export const YARD = 12;
export const WALL = YARD - 0.6;
/** The well in the middle: nobody walks through it. */
export const WELL = 1.5;

/** Where the lantern posts stand: [x, z] in metres, the well at the origin. */
export const POSTS = (() => {
    const posts = [];
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        posts.push([Math.sin(a) * 9.2, Math.cos(a) * 9.2]);
    }
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        posts.push([Math.sin(a) * 4.6, Math.cos(a) * 4.6]);
    }
    return posts.map(([x, z]) => [
        Math.round(x * 100) / 100,
        Math.round(z * 100) / 100,
    ]);
})();

/** A small seeded generator (mulberry32): the same seed, the same round. */
export function random(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** A number from any text (a trip id, a match id), for `random`. */
export function seedFrom(text) {
    let h = 2166136261;
    for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return h >>> 0;
}

/** How many lanterns burn at once for this many players. */
export const litFor = (players) =>
    Math.max(2, Math.min(5, 2 + Math.floor((players - 1) / 2)));

const clampNumber = (value, min, max, fallback) =>
    typeof value === "number" && Number.isFinite(value)
        ? Math.max(min, Math.min(max, value))
        : fallback;

/**
 * A new round. `players` are ids (roster ids in a party, "self" alone).
 * State: `elapsed`, `lit` (post index -> second it was lit), `scores` (by
 * id), `gone` (ids who left: their score stays), `missed` (lanterns that
 * faded: the night's score), `over`.
 */
export function createRound({ id, seed, duration = ROUND_SECONDS, players }) {
    return {
        id: String(id),
        seed: seed >>> 0,
        draws: 0,
        duration,
        elapsed: 0,
        lit: {},
        nextAt: 0,
        scores: Object.fromEntries(players.map((p) => [p, 0])),
        gone: [],
        missed: 0,
        over: false,
    };
}

/** The ids still playing. */
export const playing = (round) =>
    Object.keys(round.scores).filter((id) => !round.gone.includes(id));

// The generator is rebuilt from the seed and the count of draws, so a
// member who takes the round over from a snapshot draws the same posts.
function draw(round) {
    const next = random(round.seed + round.draws * 7919);
    round.draws++;
    return next();
}

/**
 * Advance by `seconds`. Returns what happened, for sound and effects:
 * `[{ type: "lit" | "faded" | "over", post }]`.
 */
export function stepRound(round, seconds) {
    const events = [];
    if (round.over || !(seconds > 0)) return events;
    round.elapsed = Math.min(round.duration, round.elapsed + seconds);
    for (const [post, since] of Object.entries(round.lit))
        if (round.elapsed - since >= LIFE) {
            delete round.lit[post];
            round.missed++;
            round.nextAt = Math.max(round.nextAt, round.elapsed + RELIGHT);
            events.push({ type: "faded", post: Number(post) });
        }
    if (round.elapsed >= round.duration) {
        round.over = true;
        round.lit = {};
        events.push({ type: "over", post: -1 });
        return events;
    }
    const want = litFor(Math.max(1, playing(round).length));
    while (
        Object.keys(round.lit).length < want &&
        round.elapsed >= round.nextAt
    ) {
        const dark = POSTS.map((_, i) => i).filter((i) => !(i in round.lit));
        const post = dark[Math.floor(draw(round) * dark.length)];
        round.lit[post] = round.elapsed;
        round.nextAt = round.elapsed + RELIGHT;
        events.push({ type: "lit", post });
    }
    return events;
}

/** Is `position` ([x, z]) close enough to catch the lantern on `post`? */
export function inReach(position, post, reach = REACH) {
    const at = POSTS[post];
    return (
        !!at && Math.hypot(position[0] - at[0], position[1] - at[1]) <= reach
    );
}

/** The lit lanterns `position` is touching right now. */
export const touching = (round, position) =>
    Object.keys(round.lit)
        .map(Number)
        .filter((post) => inReach(position, post));

/**
 * `player` catches the lantern on `post` that was lit at `since`. False
 * when it is no longer that lantern (someone else was first, or it faded).
 */
export function catchLantern(round, player, post, since) {
    if (
        round.over ||
        !(player in round.scores) ||
        round.gone.includes(player) ||
        !(post in round.lit) ||
        Math.abs(round.lit[post] - since) > 0.051
    )
        return false;
    delete round.lit[post];
    round.scores[player]++;
    round.nextAt = Math.max(round.nextAt, round.elapsed + RELIGHT);
    return true;
}

/** A player joins a round in progress, from zero, or comes back to it. */
export function joinRound(round, player) {
    if (round.over) return false;
    if (!(player in round.scores)) {
        if (Object.keys(round.scores).length >= 8) return false;
        round.scores[player] = 0;
    }
    round.gone = round.gone.filter((id) => id !== player);
    return true;
}

/** A player left or dropped: the round goes on and their score stays. */
export function leaveRound(round, player) {
    if (player in round.scores && !round.gone.includes(player))
        round.gone.push(player);
}

const tenths = (seconds) => Math.round(seconds * 10);

/** The whole round as a small array of rounded numbers, for the channel. */
export function snapshot(round) {
    return [
        round.id,
        round.seed,
        round.draws,
        round.duration,
        tenths(round.elapsed),
        tenths(round.nextAt),
        Object.entries(round.lit).map(([post, since]) => [
            Number(post),
            tenths(since),
        ]),
        Object.entries(round.scores).map(([id, score]) => [
            id,
            score,
            round.gone.includes(id) ? 1 : 0,
        ]),
        round.missed,
        round.over ? 1 : 0,
    ];
}

/**
 * A snapshot from the network back into a round, or null. Nothing in it is
 * trusted: numbers are clamped, posts and ids checked.
 */
export function readSnapshot(value, knows = () => true) {
    if (!Array.isArray(value) || value.length < 10) return null;
    const [id, seed, draws, duration, elapsed, nextAt, lit, scores, missed] =
        value;
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{6,64}$/.test(id))
        return null;
    if (!Array.isArray(lit) || !Array.isArray(scores)) return null;
    const length = clampNumber(duration, 5, 600, NaN);
    if (!Number.isFinite(length)) return null;
    const round = {
        id,
        seed: clampNumber(seed, 0, 4294967295, 0) >>> 0,
        draws: Math.floor(clampNumber(draws, 0, 1e6, 0)),
        duration: length,
        elapsed: clampNumber(elapsed, 0, length * 10, 0) / 10,
        nextAt: clampNumber(nextAt, 0, length * 10 + 100, 0) / 10,
        lit: {},
        scores: {},
        gone: [],
        missed: Math.floor(clampNumber(missed, 0, 1e4, 0)),
        over: value[9] === 1,
    };
    for (const entry of lit.slice(0, POSTS.length)) {
        if (!Array.isArray(entry)) continue;
        const post = entry[0];
        if (!Number.isInteger(post) || post < 0 || post >= POSTS.length)
            continue;
        round.lit[post] = clampNumber(entry[1], 0, length * 10, 0) / 10;
    }
    for (const entry of scores.slice(0, 8)) {
        if (!Array.isArray(entry)) continue;
        const player = entry[0];
        if (typeof player !== "string" || !player || player.length > 64)
            continue;
        if (!knows(player)) continue;
        round.scores[player] = Math.floor(clampNumber(entry[1], 0, 1e4, 0));
        if (entry[2] === 1) round.gone.push(player);
    }
    return round;
}

/** The scoreboard: `[{ id, score, gone }]`, best first, ties by id. */
export function standings(round) {
    return Object.entries(round.scores)
        .map(([id, score]) => ({ id, score, gone: round.gone.includes(id) }))
        .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
}

/**
 * The one result a finished round reports (docs/games/results.md), from
 * this visitor's side. Everyone who played is a side of one, in id order,
 * so every member's page reports the same teams. A round one person played
 * is against the night: the lanterns that faded are its score.
 */
export function roundResult(round, { format, self, name }) {
    if (!round.over || !(self in round.scores) || round.gone.includes(self))
        return null;
    const ids = Object.keys(round.scores).sort();
    const teams = ids.map((id) => ({
        score: round.scores[id],
        players: [
            {
                id,
                name: name(id),
                kind: id === self ? "self" : "peer",
            },
        ],
    }));
    if (teams.length < 2)
        teams.push({
            score: round.missed,
            players: [{ id: "cpu-night", name: "The night", kind: "cpu" }],
        });
    const best = Math.max(...teams.map((t) => t.score));
    const leaders = teams.filter((t) => t.score === best);
    return {
        format,
        teams,
        winner: leaders.length === 1 ? teams.indexOf(leaders[0]) : null,
    };
}

/**
 * Keep a walker inside the courtyard and out of the well. For the
 * locomotion kit's `constrain`: it adjusts `state.x` and `state.z`.
 */
export function keepInYard(state) {
    state.x = Math.max(-WALL, Math.min(WALL, state.x));
    state.z = Math.max(-WALL, Math.min(WALL, state.z));
    const d = Math.hypot(state.x, state.z);
    if (d < WELL) {
        const k = d > 1e-6 ? WELL / d : 0;
        state.x = d > 1e-6 ? state.x * k : 0;
        state.z = d > 1e-6 ? state.z * k : WELL;
    }
}

/**
 * Where a player with nobody at the controls heads: toward the nearest lit
 * lantern, as { strafe, forward } for a camera at yaw 0 (so forward -1 is
 * down -z). Used when a check plays the game (`?check`, `autoplay`).
 */
export function autopilot(round, position) {
    let best = null,
        distance = Infinity;
    for (const post of Object.keys(round?.lit ?? {})) {
        const at = POSTS[post];
        const d = Math.hypot(at[0] - position[0], at[1] - position[1]);
        if (d < distance) {
            distance = d;
            best = at;
        }
    }
    if (!best || distance < 0.3) return { strafe: 0, forward: 0 };
    return {
        strafe: (best[0] - position[0]) / distance,
        forward: (best[1] - position[1]) / distance,
    };
}
