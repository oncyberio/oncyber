import * as THREE from "three/webgpu";
import {
    BOUT_LIMIT,
    COURSE_LENGTH,
    RING_RADIUS,
    cheerFighter,
    cheerRacer,
    createBout,
    createRace,
    gauge,
    raceStandings,
    segmentAt,
    stepBout,
    stepRace,
} from "./games.js";
import { RING, buildDojo } from "./arenas.js";
import { boutShot, raceShot } from "./camera.js";
import {
    animateCourse,
    buildRaceCourse,
    coursePoint,
    setLights,
} from "./racecourse.js";
import {
    createBloomling,
    disposeBloomling,
    orbColor,
    poseBloomling,
    setOrb,
    updateOrb,
} from "./creature.js";
import { burst, dust, hearts, sparkles, splash } from "./fx.js";
import { play } from "./sound.js";
import { STATS, addXp, lookOf, rival, rng } from "./sim.js";
import { ACTS } from "./garden.js";

// Match flow for both mini games. One client hosts: it runs the simulation
// and streams snapshots in its garden packets; everyone else (racers and
// spectators) draws those and sends cheers back. Alone, you just host.

export const TIERS = {
    race: [
        { id: "sprout", label: "Sprout Cup", level: 1 },
        { id: "bloom", label: "Bloom Cup", level: 12 },
        { id: "star", label: "Star Cup", level: 30 },
    ],
    bout: [
        { id: "pebble", label: "vs. Pebble", level: 1 },
        { id: "thistle", label: "vs. Thistle", level: 16 },
        { id: "boulder", label: "vs. Boulder", level: 34 },
    ],
};
const CPU_NAMES = [
    "Rusty",
    "Mimi",
    "Tango",
    "Pogo",
    "Saffron",
    "Bao",
    "Kip",
    "Noodle",
];
const LOBBY_SECS = 10;
const STEP = 1 / 60;

export function createMinigames(ctx) {
    const mg = {
        ctx,
        match: null,
        offers: new Map(),
        course: buildRaceCourse(ctx.scene),
        dojo: buildDojo(ctx.scene),
        cheerCd: 0,
    };
    return mg;
}

function entrantOf(ctx, b) {
    const c = b.data;
    return {
        o: ctx.selfId(),
        c: c.id,
        n: c.name,
        L: lookOf(c),
        s: STATS.map((k) => c.stats[k].lv),
        h: Math.round(c.happy),
        cpu: 0,
    };
}

function cpuEntrant(random, level, name) {
    const r = rival(random, level, name);
    return {
        o: "",
        c: `cpu-${name}`,
        n: name,
        L: lookOf(r),
        s: STATS.map((k) => r.stats[k].lv),
        h: 40,
        cpu: 1,
    };
}

const asStats = (e) => {
    const stats = {};
    STATS.forEach(
        (k, i) =>
            (stats[k] = {
                lv: Math.max(0, Math.min(99, Number(e.s?.[i]) || 0)),
            })
    );
    return { stats, happy: Number(e.h) || 0 };
};

function readEntrant(e) {
    if (!e || typeof e.c !== "string" || !e.L || typeof e.L !== "object")
        return null;
    return {
        o: typeof e.o === "string" ? e.o : "",
        c: e.c.slice(0, 40),
        n: String(e.n || "Bloomling").slice(0, 16),
        L: e.L,
        s: Array.isArray(e.s) ? e.s.slice(0, 5) : [0, 0, 0, 0, 0],
        h: Number(e.h) || 0,
        cpu: e.cpu ? 1 : 0,
    };
}

// ------------------------------------------------------------- lifecycle

/** Open a match from the gate/cave menu with one of your bloomlings. */
export function openMatch(mg, kind, tierIndex, b) {
    if (mg.match) return;
    const ctx = mg.ctx;
    const id = `${ctx.selfId() || "solo"}-${Date.now().toString(36)}`;
    const tier = TIERS[kind][tierIndex] || TIERS[kind][0];
    const me = entrantOf(ctx, b);
    mg.match = {
        id,
        kind,
        tier,
        host: true,
        hostId: ctx.selfId(),
        phase: "lobby",
        lobbyT: ctx.online() ? LOBBY_SECS : 0.01,
        entrants: [me],
        mine: 0,
        myBloomling: b,
        views: [],
        t: 0,
        acc: 0,
        lastSnap: performance.now(),
        snaps: [],
    };
    b.away = true;
    ctx.enterArena(kind);
    if (ctx.online()) {
        ctx.send({
            k: "m-open",
            id,
            kind,
            tier: tierIndex,
            e: me,
            until: LOBBY_SECS,
        });
        ctx.toast(`Waiting ${LOBBY_SECS}s for other players to join…`);
    }
    ctx.ui.matchChanged();
}

export function joinOffer(mg, id, b) {
    const offer = mg.offers.get(id);
    if (!offer || mg.match) return;
    const ctx = mg.ctx;
    const me = b ? entrantOf(ctx, b) : null;
    mg.match = {
        id,
        kind: offer.kind,
        tier: TIERS[offer.kind][offer.tier] || TIERS[offer.kind][0],
        host: false,
        hostId: offer.from,
        phase: "lobby",
        lobbyT: 99,
        entrants: [],
        mine: -1,
        myEntrant: me,
        myBloomling: b,
        views: [],
        t: 0,
        acc: 0,
        lastSnap: performance.now(),
        snaps: [],
    };
    if (b) {
        b.away = true;
        ctx.send({ k: "m-join", id, e: me });
    }
    mg.offers.delete(id);
    ctx.enterArena(offer.kind);
    ctx.ui.matchChanged();
}

function beginMatch(mg) {
    const m = mg.match;
    const ctx = mg.ctx;
    const max = m.kind === "race" ? 4 : 2;
    const random = rng(Date.now() & 0xffffff);
    const names = CPU_NAMES.slice().sort(() => random() - 0.5);
    while (m.entrants.length < max)
        m.entrants.push(cpuEntrant(random, m.tier.level, names.pop()));
    m.seed = Math.floor(random() * 1e9);
    startSim(m);
    if (ctx.online())
        ctx.send({
            k: "m-start",
            id: m.id,
            kind: m.kind,
            seed: m.seed,
            tier: TIERS[m.kind].indexOf(m.tier),
            entrants: m.entrants,
        });
    enterCountdown(mg);
}

function startSim(m) {
    const ents = m.entrants.map(asStats);
    m.sim =
        m.kind === "race"
            ? createRace(ents, m.seed)
            : createBout(ents[0], ents[1], m.seed);
}

function enterCountdown(mg) {
    const m = mg.match;
    m.phase = "countdown";
    // The race opens with a fly-over of the course; the dojo with a swoop.
    m.countTotal = m.kind === "race" ? 7.7 : 5;
    m.countT = m.countTotal;
    m.slow = 0;
    m.slowDone = false;
    m.beeped = 4;
    m.lightsT = 0;
    buildViews(mg);
    if (m.kind === "race") {
        setLights(mg.course, -1);
        for (const f of mg.course.fruits)
            f.meshes.forEach((x) => (x.visible = true));
    }
    mg.ctx.ui.matchChanged();
}

function buildViews(mg) {
    const m = mg.match;
    for (const v of m.views) disposeBloomling(v.view);
    m.views = m.entrants.map((e) => {
        const view = createBloomling(e.L);
        mg.ctx.scene.add(view.root);
        return {
            view,
            x: 0,
            y: 0,
            z: 0,
            h: 0,
            act: "idle",
            speed: 0,
            s: 0,
            hp: 100,
            splashed: false,
        };
    });
    placeViews(mg, 0);
}

export function leaveMatch(mg) {
    const m = mg.match;
    if (!m) return;
    if (m.host && m.phase === "lobby" && mg.ctx.online())
        mg.ctx.send({ k: "m-cancel", id: m.id });
    for (const v of m.views) disposeBloomling(v.view);
    if (m.myBloomling) m.myBloomling.away = false;
    mg.match = null;
    mg.ctx.leaveArena(m.kind);
    mg.ctx.ui.matchChanged();
}

function finish(mg, result) {
    const m = mg.match;
    if (m.phase === "results") return;
    m.phase = "results";
    m.result = result;
    const ctx = mg.ctx;
    const mine =
        m.mine >= 0
            ? m.mine
            : m.entrants.findIndex((e) => e.o === ctx.selfId() && e.o);
    const b = m.myBloomling;
    let won = false;
    if (m.kind === "race") {
        const place = result.places[mine];
        won = place === 1;
        if (b) {
            const c = b.data;
            for (const [k, xp] of [
                ["run", 18],
                ["swim", 12],
                ["fly", 12],
                ["power", 12],
                ["stamina", 18],
            ])
                addXp(c, k, xp + (won ? 15 : 0));
            c.happy = Math.min(100, c.happy + (won ? 25 : 10));
            if (won) c.wins.race++;
        }
    } else {
        won = result.winner === mine;
        if (b) {
            const c = b.data;
            addXp(c, "power", won ? 40 : 20);
            addXp(c, "stamina", won ? 25 : 15);
            c.happy = Math.min(100, c.happy + (won ? 25 : 5));
            if (won) c.wins.bout++;
        }
    }
    if (mine >= 0) {
        play(ctx.audio, won ? "fanfare" : "cheer");
        const v = m.views[mine];
        if (v && won)
            burst(
                ctx.fx,
                new THREE.Vector3(v.x, v.y + 0.8, v.z),
                [0xffd23f, 0xff5f9e, 0x7fe3ff, 0xffffff],
                70,
                5
            );
    }
    if (m.host && ctx.online()) ctx.send({ k: "m-end", id: m.id, r: result });
    ctx.ui.matchChanged();
}

// ------------------------------------------------------------- network

export function matchEvent(mg, ev, from) {
    const ctx = mg.ctx;
    const m = mg.match;
    if (ev.k === "m-open") {
        if (!TIERS[ev.kind]) return;
        mg.offers.set(ev.id, {
            from,
            kind: ev.kind,
            tier: Number(ev.tier) || 0,
            until: performance.now() + (ev.until || LOBBY_SECS) * 1000,
            host: ev.e?.n,
        });
        ctx.ui.offer(ev.id, from, ev.kind);
        return;
    }
    if (ev.k === "m-cancel") {
        mg.offers.delete(ev.id);
        ctx.ui.offerGone(ev.id);
        if (m && m.id === ev.id && !m.host) {
            ctx.toast("The host cancelled the match.");
            leaveMatch(mg);
        }
        return;
    }
    if (!m || ev.id !== m.id) {
        if (ev.k === "m-start") {
            mg.offers.delete(ev.id);
            ctx.ui.offerGone(ev.id);
        }
        return;
    }
    if (ev.k === "m-join" && m.host && m.phase === "lobby") {
        const e = readEntrant(ev.e);
        const max = m.kind === "race" ? 4 : 2;
        if (
            e &&
            !e.cpu &&
            e.o === from &&
            m.entrants.length < max &&
            !m.entrants.some((x) => x.c === e.c)
        ) {
            m.entrants.push(e);
            ctx.toast(
                `${e.n} joined the ${m.kind === "race" ? "race" : "bout"}!`
            );
            if (m.entrants.length >= max) m.lobbyT = Math.min(m.lobbyT, 1.5);
            ctx.ui.matchChanged();
        }
    } else if (ev.k === "m-start" && !m.host && from === m.hostId) {
        m.entrants = (Array.isArray(ev.entrants) ? ev.entrants : [])
            .map(readEntrant)
            .filter(Boolean)
            .slice(0, m.kind === "race" ? 4 : 2);
        if (m.entrants.length < 2) return leaveMatch(mg);
        m.mine = m.myEntrant
            ? m.entrants.findIndex((e) => e.c === m.myEntrant.c)
            : -1;
        if (m.mine < 0 && m.myBloomling) {
            // Didn't make it in: watch instead.
            m.myBloomling.away = false;
            m.myBloomling = null;
        }
        m.seed = Number(ev.seed) || 1;
        startSim(m);
        enterCountdown(mg);
    } else if (ev.k === "m-cheer" && m.host && m.phase === "live") {
        applyCheer(mg, Number(ev.i));
    } else if (ev.k === "m-end" && !m.host && from === m.hostId && ev.r) {
        finish(mg, ev.r);
    }
}

/** Host snapshot, merged into the outgoing garden packet. */
export function matchPacket(mg) {
    const m = mg.match;
    if (!m || !m.host || m.phase !== "live") return null;
    const r2 = (v) => Math.round(v * 100) / 100;
    if (m.kind === "race")
        return {
            id: m.id,
            t: r2(m.sim.t),
            r: m.sim.racers.map((r) => [
                r2(r.s),
                ACTS.indexOf(r.act),
                r2(r.v),
                Math.round(r.stam * 100),
            ]),
        };
    return {
        id: m.id,
        t: r2(m.sim.t),
        f: m.sim.f.map((f) => [
            r2(f.x),
            r2(f.z),
            r2(f.face),
            ACTS.indexOf(f.act),
            Math.round(f.hp),
            r2(f.vx),
            r2(f.vz),
            f.super ? 1 : 0,
        ]),
    };
}

export function matchSnapshot(mg, data, from) {
    const m = mg.match;
    if (!m || m.host || from !== m.hostId || data?.id !== m.id || !m.sim)
        return;
    m.lastSnap = performance.now();
    if (m.phase === "countdown") m.phase = "live";
    const sim = m.sim;
    sim.t = Number(data.t) || sim.t;
    if (m.kind === "race" && Array.isArray(data.r)) {
        data.r.forEach((row, i) => {
            const r = sim.racers[i];
            if (!r || !Array.isArray(row)) return;
            r.target = Number(row[0]) || 0;
            r.act = ACTS[row[1]] || "run";
            r.v = Number(row[2]) || 0;
            r.stam = (Number(row[3]) || 0) / 100;
        });
    } else if (Array.isArray(data.f)) {
        data.f.forEach((row, i) => {
            const f = sim.f[i];
            if (!f || !Array.isArray(row)) return;
            f.tx = Number(row[0]) || 0;
            f.tz = Number(row[1]) || 0;
            f.face = Number(row[2]) || 0;
            const act = ACTS[row[3]] || "idle";
            if (act === "recoil" && f.act !== "recoil")
                play(mg.ctx.audio, "bump", { super: row[7] });
            f.act = act;
            f.hp = Number(row[4]) || 0;
            f.vx = Number(row[5]) || 0;
            f.vz = Number(row[6]) || 0;
        });
    }
}

// ------------------------------------------------------------- cheering

function applyCheer(mg, i) {
    const m = mg.match;
    if (m.kind === "race") return cheerRacer(m.sim, i) ? "good" : null;
    return cheerFighter(m.sim, i);
}

/** You cheer for your bloomling (or the leader, if you're watching). */
export function cheer(mg) {
    const m = mg.match;
    if (!m || m.phase !== "live" || mg.cheerCd > 0) return null;
    const i = m.mine >= 0 ? m.mine : 0;
    mg.cheerCd = m.kind === "race" ? 2.2 : 1.2;
    let q = "good";
    if (m.host) q = applyCheer(mg, i);
    else {
        if (m.kind === "bout") q = cheerQualityLocal(m, i);
        mg.ctx.send({ k: "m-cheer", id: m.id, i });
    }
    const v = m.views[i];
    if (v) {
        const at = new THREE.Vector3(v.x, v.y + 0.9, v.z);
        if (q === "perfect") sparkles(mg.ctx.fx, at, 0xffd23f, 26, 0.5);
        else hearts(mg.ctx.fx, at, 4);
    }
    play(mg.ctx.audio, "cheer");
    return q;
}

function cheerQualityLocal(m, i) {
    const g = gauge(m.sim, i);
    const d = Math.abs(g - 0.5);
    return d < 0.06 ? "perfect" : d < 0.16 ? "good" : "miss";
}

// ------------------------------------------------------------- frame

function placeViews(mg, dt) {
    const m = mg.match;
    const sim = m.sim;
    if (!sim) return;
    m.views.forEach((v, i) => {
        if (m.kind === "race") {
            const r = sim.racers[i];
            if (!m.host && r.target !== undefined) {
                // Extrapolate with the host's speed, then ease onto its value.
                r.s += r.v * dt;
                r.s += (r.target - r.s) * Math.min(1, dt * 3);
                if (r.target >= COURSE_LENGTH)
                    r.s = Math.max(r.s, r.target - 0.01);
            }
            const p = coursePoint(Math.min(COURSE_LENGTH, r.s), i);
            const seg = segmentAt(r.s).seg.kind;
            mg.course.fruits.forEach((f) => {
                const mesh = f.meshes[i];
                if (mesh.visible && r.s >= f.s) {
                    mesh.visible = false;
                    sparkles(mg.ctx.fx, mesh.position, 0xfff1a8, 10, 0.3);
                    if (i === m.mine)
                        play(mg.ctx.audio, "pickup", { pitch: 1.5 });
                }
            });
            if (seg === "swim" && !v.splashed) {
                v.splashed = true;
                splash(mg.ctx.fx, { x: p.x, y: p.y + 0.2, z: p.z }, 14);
                play(mg.ctx.audio, "splash");
            }
            v.x = p.x;
            v.y = p.y;
            v.z = p.z;
            v.h = p.h;
            v.act = r.done
                ? r.place === 1
                    ? "win"
                    : "cheer"
                : r.act === "swim"
                ? "swim"
                : r.act === "climb"
                ? "climb"
                : r.act === "glide"
                ? "glide"
                : r.act === "run"
                ? "run"
                : r.act;
            v.speed = r.v;
            if (m.phase === "countdown" || m.phase === "lobby") {
                v.act = "idle";
                v.speed = 0;
            }
            if (
                r.boost > 0 ||
                (!m.host &&
                    r.v > 0 &&
                    Math.random() < dt * 2 &&
                    r.act !== "tired")
            ) {
                if (Math.random() < dt * 20)
                    dust(mg.ctx.fx, { x: v.x, y: v.y, z: v.z }, 1);
            }
        } else {
            const f = sim.f[i];
            if (!m.host && f.tx !== undefined) {
                f.x += f.vx * dt;
                f.z += f.vz * dt;
                f.x += (f.tx - f.x) * Math.min(1, dt * 6);
                f.z += (f.tz - f.z) * Math.min(1, dt * 6);
            }
            v.x = RING.x + f.x;
            v.z = RING.z + f.z;
            v.y = RING.y + (f.act === "out" ? -0.9 : 0);
            v.h = f.face;
            v.act = f.act === "circle" ? "walk" : f.act;
            v.speed = Math.hypot(f.vx, f.vz);
            v.hp = f.hp;
        }
    });
}

export function updateMinigames(mg, dt) {
    mg.cheerCd = Math.max(0, mg.cheerCd - dt);
    const now = performance.now();
    for (const [id, o] of mg.offers)
        if (now > o.until + 4000) {
            mg.offers.delete(id);
            mg.ctx.ui.offerGone(id);
        }
    const m = mg.match;
    if (!m) return;
    const ctx = mg.ctx;
    if (m.phase === "lobby") {
        m.lobbyT -= dt;
        if (m.host && m.lobbyT <= 0) beginMatch(mg);
        if (!m.host && m.lobbyT < 80 && now - m.lastSnap > 20000)
            leaveMatch(mg);
        return;
    }
    if (m.phase === "countdown") {
        m.countT -= dt;
        const n = Math.ceil(m.countT);
        if (n < m.beeped && n >= 0) {
            m.beeped = n;
            if (m.kind === "race") setLights(mg.course, n);
            play(ctx.audio, "beep", { go: n === 0 });
            ctx.ui.countdown(n === 0 ? "GO!" : String(n));
        }
        if (m.countT <= 0 && m.host) m.phase = "live";
        if (m.countT <= -1.5 && !m.host) m.phase = "live";
    }
    if (m.kind === "race") {
        animateCourse(mg.course, dt, now / 1000);
        if (m.phase === "live" && (m.lightsT += dt) > 2.5)
            setLights(mg.course, -1);
    }
    if (m.phase === "live") {
        if (m.host) {
            // Photo finish: time slows as the leader hits the line.
            let scale = 1;
            if (m.kind === "race") {
                const lead = Math.max(...m.sim.racers.map((r) => r.s));
                if (!m.slowDone && lead > COURSE_LENGTH - 1.2) {
                    m.slowDone = true;
                    m.slow = 1.4;
                }
                if (m.slow > 0) {
                    m.slow -= dt;
                    scale = 0.3;
                }
            }
            m.acc += Math.min(dt, 0.1) * scale;
            while (m.acc >= STEP) {
                m.acc -= STEP;
                if (m.kind === "race") stepRace(m.sim, STEP);
                else {
                    stepBout(m.sim, STEP);
                    for (const hit of m.sim.hits) {
                        const v = m.views[1 - hit.by];
                        if (!v) continue;
                        const at = new THREE.Vector3(v.x, v.y + 0.5, v.z);
                        if (hit.dodge) sparkles(ctx.fx, at, 0xffffff, 8);
                        else {
                            burst(
                                ctx.fx,
                                at,
                                hit.super
                                    ? [0xffd23f, 0xff5f7e, 0xffffff]
                                    : [0xffffff, 0xfff1a8],
                                hit.super ? 30 : 14,
                                hit.super ? 5 : 3
                            );
                            play(ctx.audio, "bump", { super: hit.super });
                            ctx.shake(hit.super ? 0.4 : 0.15);
                        }
                    }
                    // CPU corners cheer for their fighters.
                    m.entrants.forEach((e, i) => {
                        if (
                            e.cpu &&
                            m.sim.f[i].cheerCd <= 0 &&
                            Math.random() < STEP * 0.6
                        )
                            cheerFighter(m.sim, i);
                    });
                }
                if (m.kind === "race")
                    m.entrants.forEach((e, i) => {
                        if (e.cpu && Math.random() < STEP * 0.25)
                            cheerRacer(m.sim, i);
                    });
                if (m.sim.over) break;
            }
            if (m.sim.over && m.phase === "live") {
                const result =
                    m.kind === "race"
                        ? {
                              places: m.sim.racers.map((r) => r.place),
                              times: m.sim.racers.map(
                                  (r) => Math.round(r.time * 100) / 100
                              ),
                          }
                        : { winner: m.sim.winner, reason: m.sim.reason };
                finish(mg, result);
            }
        } else if (now - m.lastSnap > 4000) {
            ctx.toast("Lost the host. Back to the garden.");
            leaveMatch(mg);
            return;
        }
    }
    placeViews(mg, dt);
    m.views.forEach((v, i) => {
        const e = m.entrants[i];
        v.view.root.position.set(v.x, v.y, v.z);
        v.view.root.rotation.y = v.h;
        poseBloomling(
            v.view,
            {
                act: v.act,
                speed: v.speed,
                mood:
                    v.act === "win"
                        ? "heart"
                        : v.act === "tired"
                        ? "swirl"
                        : v.act === "look"
                        ? "question"
                        : "ball",
            },
            dt
        );
        const mood =
            v.act === "win" || v.act === "cheer"
                ? "heart"
                : v.act === "tired" || v.act === "dizzy" || v.act === "out"
                ? "swirl"
                : v.act === "look"
                ? "question"
                : v.act === "trip"
                ? "alert"
                : "ball";
        setOrb(v.view.orb, mood, orbColor(e.L.align));
        updateOrb(v.view, dt, ctx.scene);
    });
}

// ------------------------------------------------------------- HUD data

export function matchHud(mg) {
    const m = mg.match;
    if (!m) return null;
    const versus = m.entrants.length > 1 && m.entrants.every((e) => !e.cpu);
    const hud = {
        kind: m.kind,
        phase: m.phase,
        tier: versus && m.kind === "bout" ? "Player vs player" : m.tier.label,
        entrants: m.entrants,
        mine: m.mine,
        host: m.host,
        lobbyT: m.lobbyT,
        cheerCd: mg.cheerCd,
    };
    if (!m.sim) return hud;
    if (m.kind === "race") {
        hud.standings = raceStandings(m.sim).map((r) => ({
            lane: r.lane,
            s: r.s,
            done: r.done,
            place: r.place,
            stam: r.stam,
            act: r.act,
        }));
        hud.progress = m.sim.racers.map((r) =>
            Math.min(1, r.s / COURSE_LENGTH)
        );
        hud.t = m.sim.t;
    } else {
        hud.hp = m.sim.f.map((f) => f.hp);
        hud.gauge = gauge(m.sim, m.mine >= 0 ? m.mine : 0);
        hud.t = Math.max(0, BOUT_LIMIT - m.sim.t);
        hud.super = m.sim.f.map((f) => f.super);
    }
    hud.result = m.result;
    return hud;
}

/** Where the camera should look during a match. */
export function matchCamera(mg) {
    const m = mg.match;
    if (!m) return null;
    const now = performance.now() / 1000;
    return m.kind === "bout" ? boutShot(m, now) : raceShot(m, mg.course, now);
}

export { RING_RADIUS };
