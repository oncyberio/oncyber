// Bloomling care rules: stats, needs, gifts, growth and evolution.
// Pure data in and out (no three.js), so it runs in node tests and stays the
// single place the numbers live.

export const STATS = ["swim", "fly", "run", "power", "stamina"];
export const STAT_LABEL = {
    swim: "Swim",
    fly: "Fly",
    run: "Run",
    power: "Power",
    stamina: "Stamina",
};
export const MAX_LEVEL = 99;
export const MAX_BLOOMLINGS = 4;

// Seconds of garden life (scaled by happiness) before a child cocoons.
export const GROW_AT = 900;
export const HATCH_AFTER = 45;

const NAMES = [
    "Pip",
    "Mochi",
    "Tofu",
    "Bean",
    "Nori",
    "Puddle",
    "Sprig",
    "Dumpling",
    "Kiki",
    "Bubbles",
    "Zuzu",
    "Momo",
    "Fennel",
    "Biscuit",
    "Clover",
    "Taro",
    "Pebble",
    "Juniper",
    "Yuzu",
    "Wobble",
    "Peanut",
    "Miso",
    "Lulu",
    "Sunny",
];

export const BASE_COLORS = [0x8fd3ff, 0x9ff0c8, 0xffd27a, 0xffb3d1, 0xc9b6ff];

/** Small deterministic PRNG (mulberry32). */
export function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function newId(random = Math.random) {
    return (
        Date.now().toString(36).slice(-5) +
        Math.floor(random() * 36 ** 5)
            .toString(36)
            .padStart(5, "0")
    );
}

/** A fresh egg. Everything else is decided when it hatches. */
export function newEgg(random = Math.random, at = { x: 0, z: 0 }) {
    const stats = {};
    for (const s of STATS) stats[s] = { lv: 0, xp: 0 };
    return {
        id: newId(random),
        name: NAMES[Math.floor(random() * NAMES.length)],
        stage: "egg",
        hatch: 0,
        growth: 0,
        age: 0,
        stats,
        happy: 30,
        full: 80,
        energy: 90,
        align: 0,
        bond: 0,
        evolution: null,
        look: {
            color: BASE_COLORS[Math.floor(random() * BASE_COLORS.length)],
            tint: null,
            parts: { ears: 0, wings: 0, fins: 0, arms: 0, shell: 0 },
        },
        home: { x: at.x, z: at.z },
        wins: { race: 0, bout: 0 },
    };
}

/** Add experience; returns the number of levels gained. */
export function addXp(c, stat, amount) {
    const s = c.stats[stat];
    if (!s || s.lv >= MAX_LEVEL) return 0;
    s.xp += amount;
    let gained = 0;
    while (s.xp >= 100 && s.lv < MAX_LEVEL) {
        s.xp -= 100;
        s.lv++;
        gained++;
    }
    if (s.lv >= MAX_LEVEL) s.xp = 0;
    return gained;
}

export const FRUITS = {
    puffberry: {
        label: "Puffberry",
        color: 0xff5f7e,
        full: 28,
        happy: 6,
        align: 0,
        xp: { stamina: 12 },
    },
    sunpeach: {
        label: "Sun Peach",
        color: 0xffc23d,
        full: 22,
        happy: 12,
        align: 0.07,
        xp: { run: 6, fly: 6 },
    },
    moonplum: {
        label: "Moon Plum",
        color: 0x8a5cff,
        full: 22,
        happy: 12,
        align: -0.07,
        xp: { swim: 6, power: 6 },
    },
    rainbow: {
        label: "Prism Fruit",
        color: 0xffffff,
        full: 35,
        happy: 25,
        align: 0,
        xp: { swim: 20, fly: 20, run: 20, power: 20, stamina: 20 },
    },
};

export const CRITTERS = {
    hopper: {
        label: "Hopper",
        stat: "run",
        part: "ears",
        color: 0xf6efe4,
        blurb: "A fluffy bunny-ish hopper. Run up, longer ears.",
    },
    tweet: {
        label: "Tweet",
        stat: "fly",
        part: "wings",
        color: 0x5fc3ff,
        blurb: "A tiny round bird. Fly up, little wings.",
    },
    fishlet: {
        label: "Fishlet",
        stat: "swim",
        part: "fins",
        color: 0xff9a4d,
        blurb: "Splashes in the pond. Swim up, frilly fins.",
    },
    digger: {
        label: "Digger",
        stat: "power",
        part: "arms",
        color: 0xa8775a,
        blurb: "A mole with big paws. Power up, stronger arms.",
    },
    shellby: {
        label: "Shellby",
        stat: "stamina",
        part: "shell",
        color: 0x63c46a,
        blurb: "A slow little turtle. Stamina up, a shell back.",
    },
};

function mixColor(a, b, t) {
    const ar = (a >> 16) & 255,
        ag = (a >> 8) & 255,
        ab = a & 255;
    const br = (b >> 16) & 255,
        bg = (b >> 8) & 255,
        bb = b & 255;
    return (
        (Math.round(ar + (br - ar) * t) << 16) |
        (Math.round(ag + (bg - ag) * t) << 8) |
        Math.round(ab + (bb - ab) * t)
    );
}

/** Feed a fruit. Returns what changed, for the presentation. */
export function feed(c, kind) {
    const f = FRUITS[kind];
    if (!f || c.stage === "egg") return null;
    const ups = [];
    c.full = clamp(c.full + f.full, 0, 100);
    c.happy = clamp(c.happy + f.happy, -100, 100);
    c.align = clamp(c.align + f.align, -1, 1);
    c.growth += 15;
    for (const [stat, xp] of Object.entries(f.xp))
        if (addXp(c, stat, xp)) ups.push(stat);
    return { ups, align: f.align };
}

/** Give a small animal: a stat jump, a body part and a little of its colour. */
export function give(c, kind) {
    const k = CRITTERS[kind];
    if (!k || c.stage === "egg") return null;
    const gained = addXp(c, k.stat, 45);
    c.look.parts[k.part] = clamp((c.look.parts[k.part] || 0) + 0.34, 0, 1);
    c.look.tint = mixColor(c.look.tint ?? c.look.color, k.color, 0.18);
    c.happy = clamp(c.happy + 8, -100, 100);
    c.growth += 25;
    return { ups: gained ? [k.stat] : [], part: k.part };
}

/** Kind hands: petting nudges toward Sunny, roughhousing toward Shade. */
export function pet(c) {
    c.happy = clamp(c.happy + 6, -100, 100);
    c.align = clamp(c.align + 0.015, -1, 1);
    c.bond = clamp(c.bond + 1, 0, 1000);
}

export function toss(c, hard) {
    // A gentle toss is a game; a hard one is mischief. Both are remembered.
    c.happy = clamp(c.happy + (hard ? -4 : 3), -100, 100);
    c.align = clamp(c.align - (hard ? 0.03 : 0.012), -1, 1);
}

/** Needs over time. `asleep` and `activity` come from the behaviour layer. */
export function tick(c, dt, { asleep = false, activity = null } = {}) {
    if (c.stage === "egg") {
        c.hatch += dt;
        return;
    }
    if (c.stage === "cocoon") return;
    c.age += dt;
    c.full = clamp(c.full - dt * 0.12, 0, 100);
    c.energy = clamp(c.energy + dt * (asleep ? 0.9 : -0.07), 0, 100);
    // Happiness drifts toward what its needs say it should feel.
    const target =
        (c.full < 20 ? -40 : 15) +
        (c.energy < 15 ? -25 : 0) +
        Math.min(20, c.bond * 0.1);
    c.happy += (target - c.happy) * Math.min(1, dt * 0.004);
    if (c.stage === "child")
        c.growth += dt * (0.7 + Math.max(0, c.happy) / 150);
    if (activity && STATS.includes(activity)) addXp(c, activity, dt * 0.9);
}

export const ALIGNMENTS = {
    sunny: {
        label: "Sunny",
        blurb: "Raised with gentle hands and sweet peaches.",
    },
    shade: {
        label: "Shade",
        blurb: "A cheeky rascal raised on plums and roughhousing.",
    },
    breeze: {
        label: "Breeze",
        blurb: "Easygoing, a little of everything.",
    },
};

export function alignmentOf(c) {
    return c.align > 0.3 ? "sunny" : c.align < -0.3 ? "shade" : "breeze";
}

/** Which way the body grows: its best stat, or "all" if nothing stands out. */
export function typeOf(c) {
    const ranked = ["swim", "fly", "run", "power"]
        .map((s) => [s, c.stats[s].lv * 100 + c.stats[s].xp])
        .sort((a, b) => b[1] - a[1]);
    return ranked[0][1] - ranked[1][1] < 500 ? "all" : ranked[0][0];
}

export function readyToGrow(c, growAt = GROW_AT) {
    return c.stage === "child" && c.growth >= growAt;
}

export function evolve(c) {
    c.stage = "adult";
    c.evolution = { align: alignmentOf(c), type: typeOf(c) };
    c.happy = clamp(c.happy + 30, -100, 100);
    return c.evolution;
}

/** What the mood orb should show when nothing more specific is happening. */
export function restingMood(c) {
    if (c.stage === "egg" || c.stage === "cocoon") return "none";
    if (c.full < 15 || c.happy < -30) return "swirl";
    if (c.happy > 60) return "heart";
    return "ball";
}

/** Total of all levels, used to seed CPU rivals of a similar strength. */
export function power(c) {
    return STATS.reduce((sum, s) => sum + c.stats[s].lv, 0);
}

/** Keep only what persists, and repair anything malformed on load. */
export function sanitize(raw) {
    if (!raw || typeof raw !== "object" || typeof raw.id !== "string")
        return null;
    const c = newEgg(() => 0.5);
    c.id = raw.id.slice(0, 24);
    c.name = typeof raw.name === "string" ? raw.name.slice(0, 16) : c.name;
    c.stage = ["egg", "child", "cocoon", "adult"].includes(raw.stage)
        ? raw.stage === "cocoon"
            ? "child"
            : raw.stage
        : "egg";
    for (const k of ["hatch", "growth", "age", "bond"])
        c[k] = Number.isFinite(raw[k]) ? raw[k] : 0;
    c.happy = clamp(Number(raw.happy) || 0, -100, 100);
    c.full = clamp(Number.isFinite(raw.full) ? raw.full : 70, 0, 100);
    c.energy = clamp(Number.isFinite(raw.energy) ? raw.energy : 80, 0, 100);
    c.align = clamp(Number(raw.align) || 0, -1, 1);
    for (const s of STATS) {
        const v = raw.stats?.[s];
        c.stats[s] = {
            lv: clamp(Math.floor(v?.lv) || 0, 0, MAX_LEVEL),
            xp: clamp(Number(v?.xp) || 0, 0, 99.99),
        };
    }
    if (Number.isFinite(raw.look?.color)) c.look.color = raw.look.color;
    if (Number.isFinite(raw.look?.tint)) c.look.tint = raw.look.tint;
    for (const p of Object.keys(c.look.parts))
        c.look.parts[p] = clamp(Number(raw.look?.parts?.[p]) || 0, 0, 1);
    if (c.stage === "adult")
        c.evolution = {
            align: ALIGNMENTS[raw.evolution?.align]
                ? raw.evolution.align
                : alignmentOf(c),
            type: ["swim", "fly", "run", "power", "all"].includes(
                raw.evolution?.type
            )
                ? raw.evolution.type
                : typeOf(c),
        };
    if (Number.isFinite(raw.home?.x) && Number.isFinite(raw.home?.z))
        c.home = { x: raw.home.x, z: raw.home.z };
    c.wins = {
        race: Math.max(0, Math.floor(raw.wins?.race) || 0),
        bout: Math.max(0, Math.floor(raw.wins?.bout) || 0),
    };
    return c;
}

/** A rival for the mini games, with levels around `level` per stat. */
export function rival(random, level, name) {
    const c = newEgg(random);
    c.stage = random() < 0.5 ? "child" : "adult";
    c.name = name || c.name;
    for (const s of STATS)
        c.stats[s].lv = clamp(
            Math.round(level + (random() - 0.5) * level * 0.8),
            0,
            MAX_LEVEL
        );
    c.happy = 40;
    c.align = (random() - 0.5) * 1.6;
    const parts = Object.keys(c.look.parts);
    c.look.parts[parts[Math.floor(random() * parts.length)]] = 0.7;
    if (c.stage === "adult")
        c.evolution = { align: alignmentOf(c), type: typeOf(c) };
    return c;
}

/** The public look of a bloomling: what other players need to draw it. */
export function lookOf(c) {
    return {
        stage: c.stage,
        color: c.look.color,
        tint: c.look.tint,
        parts: { ...c.look.parts },
        align: c.stage === "adult" ? c.evolution?.align : alignmentOf(c),
        type: c.evolution?.type || null,
        name: c.name,
    };
}
