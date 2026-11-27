import {
    ALIGNMENTS,
    CRITTERS,
    HATCH_AFTER,
    STATS,
    STAT_LABEL,
    alignmentOf,
    typeOf,
} from "./sim.js";
import { bodyColor } from "./creature.js";
import { TIERS } from "./minigames.js";

// What the game tells its UI, as plain JSON. The UI (an HTML page in its own
// sandbox, or a native WebView) only draws this and sends named actions back.

const hex = (n) => `#${(n >>> 0).toString(16).padStart(6, "0")}`;
const r0 = (v) => Math.round(v);
const STAT_COLOR = {
    swim: "#2fb8ff",
    fly: "#a07bff",
    run: "#ff8a4a",
    power: "#ff5f7e",
    stamina: "#3fbf5a",
};

const colorOf = (c) =>
    c.stage === "egg"
        ? hex(c.look.color)
        : hex(bodyColor({ ...c.look, stage: c.stage, align: c.evolution?.align }));

export function rosterModel(garden) {
    return garden.bloomlings.map((b) => {
        const c = b.data;
        return {
            id: c.id,
            name: c.stage === "egg" ? "Egg" : c.name,
            egg: c.stage === "egg",
            color: colorOf(c),
            mood: b.away ? "away" : b.orb || "ball",
            full: r0(c.stage === "egg" ? (c.hatch / HATCH_AFTER) * 100 : c.full),
            hungry: c.stage !== "egg" && c.full < 25,
            happy: r0((c.happy + 100) / 2),
        };
    });
}

function hintFor(c) {
    if (c.stage === "egg") return "Eggs hatch on their own, quicker in your arms. Press E to pick it up.";
    if (c.full < 25) return `${c.name} is hungry! Shake a fruit tree (E) and hand over the fruit.`;
    if (c.energy < 20) return `${c.name} is sleepy. Let it nap.`;
    if (c.happy < -20) return `${c.name} is sad. Pet it (hold F) and keep its tummy full.`;
    if (c.stage === "child") {
        const top = typeOf(c);
        return `Gifts shape how ${c.name} grows up. ${top === "all" ? "Its stats are balanced." : `It's leaning toward ${STAT_LABEL[top]}.`} Wins: ${c.wins.race} races, ${c.wins.bout} bouts.`;
    }
    return `Wins: ${c.wins.race} races, ${c.wins.bout} bouts. Keep training with critters: ${Object.values(CRITTERS)
        .map((k) => k.label)
        .join(", ")}.`;
}

export function detailsModel(garden, id, growAt) {
    const b = garden.bloomlings.find((x) => x.data.id === id);
    if (!b) return null;
    const c = b.data;
    const align = c.stage === "adult" ? c.evolution.align : alignmentOf(c);
    const stage =
        c.stage === "egg"
            ? "An egg. Warm it up: hold it or pet it."
            : c.stage === "adult"
            ? `Adult · ${ALIGNMENTS[align].label}${c.evolution.type !== "all" ? ` ${STAT_LABEL[c.evolution.type]}` : ""} type`
            : `Child · leaning ${ALIGNMENTS[align].label}`;
    const growth = c.stage === "child" ? Math.min(1, c.growth / growAt) : c.stage === "adult" ? 1 : c.hatch / HATCH_AFTER;
    return {
        id,
        index: garden.bloomlings.indexOf(b),
        name: c.name,
        color: colorOf(c),
        stage,
        meters: [
            [c.stage === "egg" ? "Hatching" : "Growing up", r0(growth * 100), "#7fe3ff"],
            ["Tummy", r0(c.full), c.full < 25 ? "#ff5f7e" : "#ffc23d"],
            ["Happiness", r0((c.happy + 100) / 2), "#ff5f9e"],
            ["Energy", r0(c.energy), "#3fbf5a"],
        ],
        align: Math.round(((c.align + 1) / 2) * 100),
        stats: STATS.map((s) => [STAT_LABEL[s], c.stats[s].lv, r0(c.stats[s].xp), STAT_COLOR[s]]),
        hint: hintFor(c),
    };
}

export function menuModel(garden, menu) {
    if (!menu) return null;
    const eligible = garden.bloomlings.filter((b) => b.data.stage === "child" || b.data.stage === "adult");
    return {
        kind: menu.kind,
        who: eligible.map((b) => ({ name: b.data.name, color: colorOf(b.data) })),
        tiers: TIERS[menu.kind].map((t) => t.label),
        sel: { who: menu.who, tier: menu.tier },
    };
}

/** Compact match HUD (entrant looks reduced to a colour). */
export function matchModel(hud) {
    if (!hud) return null;
    const r2 = (v) => Math.round(v * 100) / 100;
    return {
        kind: hud.kind,
        phase: hud.phase,
        tier: hud.tier,
        mine: hud.mine,
        host: hud.host,
        lobbyT: r2(hud.lobbyT || 0),
        cheerCd: r2(hud.cheerCd || 0),
        t: hud.t !== undefined ? r2(hud.t) : null,
        entrants: hud.entrants.map((e) => ({ n: e.n, cpu: !!e.cpu, color: hex(bodyColor(e.L)) })),
        standings: hud.standings?.map((s) => ({ lane: s.lane, done: s.done, place: s.place, act: s.act })) || null,
        progress: hud.progress?.map(r2) || null,
        hp: hud.hp?.map(r0) || null,
        gauge: hud.gauge !== undefined ? r2(hud.gauge) : null,
        result: hud.result || null,
    };
}
