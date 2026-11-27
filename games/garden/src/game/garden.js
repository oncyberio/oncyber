import * as THREE from "three/webgpu";
import {
    createBloomling,
    disposeBloomling,
    orbColor,
    poseBloomling,
    setLook,
    setOrb,
    updateOrb,
} from "./creature.js";
import { animateCritter, critterMesh } from "./critters.js";
import {
    blobShadow,
    burst,
    dust,
    hearts,
    sparkles,
    splash,
    tears,
} from "./fx.js";
import { play } from "./sound.js";
import {
    CRITTERS,
    FRUITS,
    HATCH_AFTER,
    MAX_BLOOMLINGS,
    STAT_LABEL,
    evolve,
    feed,
    give,
    lookOf,
    newEgg,
    pet,
    readyToGrow,
    restingMood,
    sanitize,
    tick,
    toss,
    alignmentOf,
} from "./sim.js";
import {
    HUT,
    NEST,
    POND,
    SPAWN,
    WATER,
    heightAt,
    inPond,
    ISLAND_RADIUS,
} from "./terrain.js";
import { fruitGeometry, isNight, shakeTree } from "./world.js";
import { outline, toon } from "./toon.js";

// The garden's life: your bloomlings' brains and bodies, fruit, critters and
// eggs, and everything you can do to them. Other players' bloomlings are
// drawn by peers.js from what their owners broadcast.

const GRAVITY = -14;
// Action codes for the wire (index = code).
export const ACTS = [
    "idle",
    "walk",
    "run",
    "sit",
    "sleep",
    "eat",
    "swim",
    "practice-fly",
    "held",
    "thrown",
    "cry",
    "happy",
    "pet",
    "dance",
    "look",
    "practice-power",
    "cocoon",
    "trip",
    "follow",
    "practice-run",
    "climb",
    "glide",
    "tired",
    "cheer",
    "windup",
    "dash",
    "recoil",
    "dizzy",
    "win",
    "out",
    "dodge",
];
export const ORBS = [
    "ball",
    "heart",
    "question",
    "alert",
    "swirl",
    "zzz",
    "none",
];

const rand = (a, b) => a + Math.random() * (b - a);

function groundY(x, z) {
    const h = heightAt(x, z);
    return h < WATER - 0.05 ? WATER : h;
}

export function createGarden(ctx) {
    const g = {
        ctx,
        bloomlings: [],
        items: [],
        held: null,
        nestTimer: 2,
        saveTimer: 5,
        critterTimer: 0,
        throwLog: [],
        events: [], // outgoing network events
        fast: ctx.fast || 1,
    };
    load(g);
    if (!g.bloomlings.length) {
        // First visit: an egg waiting right in front of you.
        const b = addBloomling(
            g,
            newEgg(Math.random, { x: SPAWN.x, z: SPAWN.z - 3 })
        );
        b.x = SPAWN.x + 0.4;
        b.z = SPAWN.z - 2.6;
        g.firstVisit = true;
    }
    for (const kind of Object.keys(CRITTERS)) spawnCritter(g, kind);
    return g;
}

// ------------------------------------------------------------- bloomlings

export function addBloomling(g, data) {
    const view = createBloomling(lookOf(data));
    g.ctx.scene.add(view.root);
    const b = {
        data,
        view,
        shadow: blobShadow(g.ctx.fx, 0.7),
        x: data.home?.x ?? 0,
        z: data.home?.z ?? 0,
        y: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        heading: Math.random() * Math.PI * 2,
        act: "idle",
        actT: 0,
        speed: 0,
        air: false,
        mood: null,
        moodT: 0,
        state: "idle",
        timer: rand(1, 3),
        goal: null,
        lookKey: "",
        voiceT: rand(3, 9),
        petT: 0,
        cocoonT: 0,
        crackT: 0,
    };
    b.y = groundY(b.x, b.z);
    g.bloomlings.push(b);
    refreshLook(b);
    return b;
}

function refreshLook(b) {
    const look = lookOf(b.data);
    const key = JSON.stringify(look);
    if (key === b.lookKey) return false;
    b.lookKey = key;
    setLook(b.view, look);
    return true;
}

function setMood(b, kind, secs = 2.5) {
    b.mood = kind;
    b.moodT = secs;
}

function setState(b, state, timer = 3, goal = null) {
    b.state = state;
    b.timer = timer;
    b.goal = goal;
}

export function bloomlingAt(g, id) {
    return g.bloomlings.find((b) => b.data.id === id);
}

function talk(g, b, opts = {}) {
    const d = Math.hypot(b.x - g.ctx.player.x, b.z - g.ctx.player.z);
    if (d < 14)
        play(g.ctx.audio, "coo", {
            adult: b.data.stage === "adult",
            gain: 1 - d / 16,
            ...opts,
        });
}

function headPos(b) {
    return new THREE.Vector3(b.x, b.y + 0.55 * b.view.scale, b.z);
}

function nearestFruit(g, b, range = 22) {
    let best = null;
    let bd = range;
    for (const it of g.items) {
        if (it.type !== "fruit" || it.held || it.air) continue;
        const d = Math.hypot(it.x - b.x, it.z - b.z);
        if (d < bd) {
            bd = d;
            best = it;
        }
    }
    return best;
}

function wanderGoal(b) {
    for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = rand(2, 7);
        const x = b.x + Math.cos(a) * r;
        const z = b.z + Math.sin(a) * r;
        const h = heightAt(x, z);
        if (Math.hypot(x, z) > ISLAND_RADIUS - 6) continue;
        if (h < 0.2 && !inPond(x, z)) continue;
        if (h > 3 && b.y < 3) continue;
        return { x, z };
    }
    return { x: b.x * 0.8, z: b.z * 0.8 };
}

function think(g, b) {
    const c = b.data;
    const p = g.ctx.player;
    const night = isNight(g.ctx.world);
    const pd = Math.hypot(p.x - b.x, p.z - b.z);
    if ((night && c.energy < 85) || c.energy < 12) {
        setState(b, "sleep", rand(8, 14));
        return;
    }
    if (c.full < 40) {
        const f = nearestFruit(g, b);
        if (f) {
            setMood(b, "alert", 1.2);
            setState(b, "seek", 12, f);
            return;
        }
        if (c.full < 15) {
            setState(b, "cry", rand(2.5, 4));
            return;
        }
    }
    if (inPond(b.x, b.z) && heightAt(b.x, b.z) < WATER - 0.2) {
        setState(b, "swim", rand(5, 9), wanderGoal(b));
        return;
    }
    const r = Math.random();
    if (pd < 9 && c.happy > 30 && r < 0.18) {
        setState(b, "follow", rand(5, 8));
        return;
    }
    if (r < 0.48) setState(b, "wander", rand(4, 7), wanderGoal(b));
    else if (r < 0.58) setState(b, "sit", rand(3, 6));
    else if (r < 0.66)
        setState(b, "pond", 14, {
            x: POND.x + (Math.random() - 0.5) * 6,
            z: POND.z + (Math.random() - 0.5) * 6,
        });
    else if (r < 0.74) setState(b, "practice-run", rand(4, 6));
    else if (r < 0.8) setState(b, "practice-fly", rand(3, 5));
    else if (r < 0.86) setState(b, "practice-power", rand(3, 5));
    else if (r < 0.9 && c.happy > 50) setState(b, "dance", rand(3, 5));
    else if (r < 0.95) {
        setState(b, "look", 2.2);
        setMood(b, "question", 2.2);
    } else setState(b, "idle", rand(2, 4));
}

const ACTIVITY = {
    "practice-run": "run",
    "practice-fly": "fly",
    "practice-power": "power",
    swim: "swim",
    follow: "run",
};

function steer(b, goal, speed, dt) {
    const dx = goal.x - b.x;
    const dz = goal.z - b.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.25) {
        b.speed = 0;
        return d;
    }
    const want = Math.atan2(dx, dz);
    let dh = want - b.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    b.heading += dh * Math.min(1, dt * 5);
    // Ease off near the goal rather than stopping dead.
    const s = speed * Math.max(0.25, Math.cos(dh)) * Math.min(1, d / 0.8 + 0.2);
    b.speed = s;
    b.x += Math.sin(b.heading) * s * dt;
    b.z += Math.cos(b.heading) * s * dt;
    return d;
}

function collide(g, b) {
    for (const c of g.ctx.world.colliders) {
        const dx = b.x - c.x;
        const dz = b.z - c.z;
        const d = Math.hypot(dx, dz);
        const r = c.r + 0.25;
        if (d < r && d > 1e-4) {
            b.x = c.x + (dx / d) * r;
            b.z = c.z + (dz / d) * r;
        }
    }
    // Keep to the island; the cliff is too steep to climb.
    const r = Math.hypot(b.x, b.z);
    if (r > ISLAND_RADIUS + 2) {
        b.x *= (ISLAND_RADIUS + 2) / r;
        b.z *= (ISLAND_RADIUS + 2) / r;
    }
}

function updateBloomling(g, b, dt) {
    const c = b.data;
    const fx = g.ctx.fx;
    b.actT += dt;
    b.moodT -= dt;
    b.timer -= dt;
    // The animation follows a smoothed speed so it doesn't flicker between
    // walking and standing.
    b.anim =
        (b.anim || 0) +
        ((b.lastSpeed || 0) - (b.anim || 0)) * Math.min(1, dt * 8);
    b.speed = 0;
    let act = "idle";

    if (c.stage === "egg") {
        const near = Math.hypot(g.ctx.player.x - b.x, g.ctx.player.z - b.z) < 3;
        // Warm hands hatch eggs faster.
        const warm = g.held?.b === b || b.petT > 0 ? 3 : near ? 1.5 : 1;
        tick(c, dt * warm * g.fast);
        b.petT = Math.max(0, b.petT - dt);
        if (c.hatch >= HATCH_AFTER) hatch(g, b);
    } else if (b.state === "cocoon") {
        b.cocoonT += dt;
        act = "cocoon";
        if (Math.random() < dt * 8) sparkles(fx, headPos(b), 0xffffff, 2, 0.5);
        if (b.cocoonT > 6) {
            const evo = evolve(c);
            refreshLook(b);
            setState(b, "happy", 3);
            setMood(b, "heart", 4);
            burst(
                fx,
                headPos(b),
                [0xffffff, orbColor(evo.align), 0xffd23f],
                60,
                4
            );
            play(g.ctx.audio, "fanfare");
            g.ctx.toast(
                `${c.name} grew up into a ${
                    evo.align === "sunny"
                        ? "Sunny"
                        : evo.align === "shade"
                        ? "Shade"
                        : "Breeze"
                } bloomling!`,
                "big"
            );
            g.events.push({ k: "evolve", c: c.id });
            save(g);
        }
    } else {
        tick(c, dt * g.fast, {
            asleep: b.state === "sleep",
            activity: ACTIVITY[b.state] || (b.act === "swim" ? "swim" : null),
        });
        if (readyToGrow(c, g.ctx.growAt) && !b.air && g.held?.b !== b) {
            setState(b, "cocoon", 99);
            b.cocoonT = 0;
            play(g.ctx.audio, "evolve");
            g.ctx.toast(`${c.name} is wrapping up in a cocoon…`);
        }
    }

    if (g.held?.b === b) {
        act = "held";
        b.air = false;
    } else if (b.air) {
        // Ballistic after a throw or a hop.
        b.vy += GRAVITY * dt;
        b.x += b.vx * dt;
        b.z += b.vz * dt;
        b.y += b.vy * dt;
        act = c.stage === "egg" ? "idle" : "thrown";
        collide(g, b);
        const floor = groundY(b.x, b.z);
        if (b.y <= floor) {
            b.y = floor;
            const water = heightAt(b.x, b.z) < WATER - 0.2;
            if (water) {
                splash(fx, { x: b.x, y: WATER, z: b.z });
                play(g.ctx.audio, "splash");
                b.air = false;
                setState(b, "swim", rand(4, 7), wanderGoal(b));
                if (c.stage !== "egg") setMood(b, "alert", 1.5);
            } else if (b.vy < -4) {
                b.vy *= -0.35;
                b.vx *= 0.5;
                b.vz *= 0.5;
                b.view.squash = 0.35;
                dust(fx, { x: b.x, y: b.y, z: b.z });
                play(g.ctx.audio, "bounce");
            } else {
                b.air = false;
                b.view.squash = 0.25;
                if (c.stage !== "egg") {
                    const liked = c.happy > 0;
                    setState(b, liked ? "happy" : "trip", liked ? 1.6 : 1.2);
                    setMood(b, liked ? "heart" : "swirl", 1.8);
                    talk(g, b, { sad: !liked });
                }
            }
        }
    } else if (c.stage !== "egg" && b.state !== "cocoon") {
        if (b.timer <= 0) think(g, b);
        const run = 1.1 + c.stats.run.lv * 0.02;
        const inWater = heightAt(b.x, b.z) < WATER - 0.2;
        switch (b.state) {
            case "wander":
            case "pond":
                if (steer(b, b.goal, inWater ? 0.8 : 0.9, dt) < 0.4)
                    b.timer = Math.min(b.timer, 0.6);
                act = inWater ? "swim" : b.anim > 0.15 ? "walk" : "idle";
                break;
            case "follow": {
                const p = g.ctx.player;
                const d = Math.hypot(p.x - b.x, p.z - b.z);
                if (d > 1.6) steer(b, p, Math.min(run * 1.6, d * 0.9), dt);
                act = inWater
                    ? "swim"
                    : b.anim > 1.4
                    ? "run"
                    : b.anim > 0.15
                    ? "walk"
                    : "idle";
                if (d <= 1.6)
                    b.heading +=
                        Math.atan2(
                            Math.sin(
                                Math.atan2(p.x - b.x, p.z - b.z) - b.heading
                            ),
                            Math.cos(
                                Math.atan2(p.x - b.x, p.z - b.z) - b.heading
                            )
                        ) * Math.min(1, dt * 5);
                break;
            }
            case "seek": {
                const f = b.goal;
                if (!f || !g.items.includes(f) || f.held) {
                    b.timer = 0;
                    break;
                }
                const d = steer(b, f, run * 1.3, dt);
                act = inWater ? "swim" : "run";
                if (d < 0.6) {
                    removeItem(g, f);
                    setState(b, "eat", 2.4, { kind: f.kind });
                    play(g.ctx.audio, "munch");
                }
                break;
            }
            case "eat":
                act = "eat";
                if (b.timer <= 0.05 && b.goal) {
                    const r = feed(c, b.goal.kind);
                    b.goal = null;
                    afterGift(g, b, r, FRUITS[b.goal?.kind]?.label);
                    setState(b, "happy", 1.4);
                }
                break;
            case "swim":
                if (!inWater) {
                    setState(b, "idle", 0.5);
                    break;
                }
                if (steer(b, b.goal, 0.6 + c.stats.swim.lv * 0.012, dt) < 0.5)
                    b.goal = wanderGoal(b);
                act = "swim";
                if (b.timer < 0) {
                    // Paddle to shore.
                    const a = Math.atan2(b.z - POND.z, b.x - POND.x);
                    b.goal = {
                        x: POND.x + Math.cos(a) * (POND.r + 1),
                        z: POND.z + Math.sin(a) * (POND.r + 1),
                    };
                    b.timer = 2;
                }
                break;
            case "practice-run": {
                const a = b.actT * 1.6;
                steer(
                    b,
                    { x: b.x + Math.cos(a) * 2, z: b.z + Math.sin(a) * 2 },
                    run * 1.4,
                    dt
                );
                act = "run";
                break;
            }
            case "sleep":
                act = "sleep";
                if (b.timer < 0 && (!isNight(g.ctx.world) || c.energy > 95))
                    setState(b, "idle", 1);
                else if (b.timer < 0) b.timer = 5;
                break;
            case "cry":
                act = "cry";
                if (Math.random() < dt * 2.5)
                    tears(fx, { ...headPos(b), floor: b.y });
                if (Math.random() < dt * 0.8) talk(g, b, { sad: true });
                break;
            case "pet":
                act = "pet";
                if (b.timer < 0) setState(b, "happy", 1.2);
                break;
            default:
                act = b.state;
        }
        if (b.state !== b.prevState) {
            b.actT = 0;
            b.prevState = b.state;
        }
        collide(g, b);
        const floorY = inWater ? WATER - 0.12 : groundY(b.x, b.z);
        b.y += (floorY - b.y) * Math.min(1, dt * 12);
        if (b.state === "practice-fly")
            b.y +=
                Math.abs(Math.sin(b.actT * 3)) * (0.2 + c.stats.fly.lv * 0.01);
        b.voiceT -= dt;
        if (b.voiceT < 0) {
            b.voiceT = rand(6, 14);
            if (b.state !== "sleep") talk(g, b, { sad: c.happy < -20 });
        }
    }
    b.act = act;
    b.lastSpeed = b.speed;

    // Mood orb.
    let mood = b.moodT > 0 ? b.mood : restingMood(c);
    if (b.state === "sleep") mood = "zzz";
    if (b.state === "cry") mood = "swirl";
    const align = c.stage === "adult" ? c.evolution.align : alignmentOf(c);
    setOrb(
        b.view.orb,
        c.stage === "egg" || b.state === "cocoon" ? "none" : mood,
        orbColor(align)
    );
    b.orb = mood;
}

function hatch(g, b) {
    const c = b.data;
    c.stage = "child";
    c.happy = 40;
    refreshLook(b);
    setState(b, "happy", 2.5);
    setMood(b, "heart", 3.5);
    if (g.held?.b === b) dropHeld(g, false);
    const at = headPos(b);
    burst(g.ctx.fx, at, [0xffffff, c.look.color, 0xffd23f], 40, 3);
    sparkles(g.ctx.fx, at, 0xfff1a8, 20);
    play(g.ctx.audio, "crack");
    setTimeout(() => talk(g, b), 500);
    g.ctx.toast(`An egg hatched! Say hi to ${c.name}.`, "big");
    g.nestTimer = Math.max(g.nestTimer, 150);
    g.events.push({ k: "hatch", c: c.id });
    save(g);
}

function afterGift(g, b, result, label) {
    if (!result) return;
    const at = headPos(b);
    hearts(g.ctx.fx, at, 4);
    play(g.ctx.audio, "heart");
    setMood(b, "heart", 2.5);
    refreshLook(b);
    for (const stat of result.ups) {
        sparkles(g.ctx.fx, at, 0xfff1a8, 18);
        play(g.ctx.audio, "levelup");
        g.ctx.toast(
            `${b.data.name}'s ${STAT_LABEL[stat]} went up! Lv ${b.data.stats[stat].lv}`
        );
    }
    if (result.part)
        g.ctx.toast(
            `${b.data.name} is growing ${
                result.part === "arms" ? "bigger paws" : result.part
            }!`
        );
    void label;
    save(g);
}

// ------------------------------------------------------------- items

function addItem(g, type, kind, x, y, z) {
    let mesh;
    let critter = null;
    if (type === "fruit") {
        mesh = new THREE.Mesh(
            fruitGeometry(kind),
            toon(FRUITS[kind].color, {
                emissive:
                    kind === "rainbow"
                        ? 0x8a6aff
                        : FRUITS[kind].color & 0x2a2a2a,
            })
        );
        mesh.castShadow = true;
        outline(mesh, 0.02);
    } else {
        critter = critterMesh(kind);
        mesh = critter.group;
    }
    g.ctx.scene.add(mesh);
    const it = {
        type,
        kind,
        mesh,
        critter,
        x,
        y,
        z,
        vx: 0,
        vy: 0,
        vz: 0,
        air: y > groundY(x, z) + 0.05,
        held: false,
        age: 0,
        heading: Math.random() * 6,
        timer: rand(1, 3),
        goal: null,
        shadow: blobShadow(g.ctx.fx, 0.4),
    };
    g.items.push(it);
    return it;
}

function removeItem(g, it) {
    const i = g.items.indexOf(it);
    if (i >= 0) g.items.splice(i, 1);
    it.mesh.parent?.remove(it.mesh);
    it.shadow.parent?.remove(it.shadow);
    if (g.held?.item === it) g.held = null;
    if (it.type === "critter") g.critterTimer = Math.max(g.critterTimer, 0);
}

function spawnCritter(g, kind) {
    for (let i = 0; i < 30; i++) {
        let x, z;
        if (kind === "fishlet") {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * (POND.r - 3);
            x = POND.x + Math.cos(a) * r;
            z = POND.z + Math.sin(a) * r;
        } else {
            const a = Math.random() * Math.PI * 2;
            const r = rand(8, 30);
            x = Math.cos(a) * r;
            z = Math.sin(a) * r;
            if (heightAt(x, z) < 0.5 || heightAt(x, z) > 3) continue;
        }
        return addItem(g, "critter", kind, x, groundY(x, z), z);
    }
}

function updateItems(g, dt) {
    const p = g.ctx.player;
    for (const it of g.items.slice()) {
        it.age += dt;
        if (it.held) {
            if (it.critter) animateCritter(it.critter, dt, 0.5);
            it.shadow.visible = false;
            continue;
        }
        let moving = 0;
        if (it.air) {
            it.vy += GRAVITY * dt;
            it.x += it.vx * dt;
            it.y += it.vy * dt;
            it.z += it.vz * dt;
            const floor = groundY(it.x, it.z);
            if (it.y <= floor) {
                it.y = floor;
                if (
                    heightAt(it.x, it.z) < WATER - 0.2 &&
                    it.kind !== "fishlet"
                ) {
                    splash(g.ctx.fx, { x: it.x, y: WATER, z: it.z }, 8);
                }
                if (it.vy < -3) {
                    it.vy *= -0.3;
                    it.vx *= 0.6;
                    it.vz *= 0.6;
                    if (it.type === "fruit")
                        play(g.ctx.audio, "bounce", { pitch: 2 });
                } else {
                    it.air = false;
                    it.vx = it.vz = 0;
                    // Roll clear of trunks and rocks so bloomlings can reach it.
                    for (const c of g.ctx.world.colliders) {
                        const dx = it.x - c.x;
                        const dz = it.z - c.z;
                        const d = Math.hypot(dx, dz) || 1e-3;
                        const r = c.r + 0.55;
                        if (d < r) {
                            it.x = c.x + (dx / d) * r;
                            it.z = c.z + (dz / d) * r;
                            it.y = groundY(it.x, it.z);
                        }
                    }
                }
            }
        } else if (it.type === "critter") {
            it.timer -= dt;
            const pd = Math.hypot(p.x - it.x, p.z - it.z);
            if (it.timer < 0) {
                it.timer = rand(1.5, 4);
                const a = Math.random() * Math.PI * 2;
                const r = rand(1, 4);
                it.goal =
                    Math.random() < 0.5
                        ? null
                        : {
                              x: it.x + Math.cos(a) * r,
                              z: it.z + Math.sin(a) * r,
                          };
            }
            if (it.goal) {
                const dx = it.goal.x - it.x;
                const dz = it.goal.z - it.z;
                const d = Math.hypot(dx, dz);
                const ok =
                    it.kind === "fishlet"
                        ? inPond(it.goal.x, it.goal.z) &&
                          heightAt(it.goal.x, it.goal.z) < -0.4
                        : heightAt(it.goal.x, it.goal.z) > 0.4 &&
                          heightAt(it.goal.x, it.goal.z) < 3;
                if (!ok || d < 0.2) it.goal = null;
                else {
                    const sp =
                        it.kind === "shellby"
                            ? 0.3
                            : it.kind === "tweet"
                            ? 1.6
                            : 1.0;
                    it.heading = Math.atan2(dx, dz);
                    it.x += (dx / d) * sp * dt;
                    it.z += (dz / d) * sp * dt;
                    moving = sp;
                }
            }
            // Shy unless you're slow about it.
            if (pd < 1.6 && p.speed > 3 && it.kind !== "shellby")
                it.timer = Math.min(it.timer, 0.1);
            it.y =
                it.kind === "fishlet"
                    ? WATER - 0.08 + Math.sin(it.age * 2) * 0.02
                    : groundY(it.x, it.z);
            if (it.kind === "fishlet" && Math.random() < dt * 0.08) {
                it.vy = 3.2;
                it.air = true;
                splash(g.ctx.fx, { x: it.x, y: WATER, z: it.z }, 6);
            }
            animateCritter(it.critter, dt, moving);
        } else if (it.age > 240) {
            // Old fruit melts away.
            sparkles(
                g.ctx.fx,
                { x: it.x, y: it.y + 0.2, z: it.z },
                FRUITS[it.kind].color,
                6
            );
            removeItem(g, it);
            continue;
        }
        it.mesh.position.set(
            it.x,
            it.y + (it.type === "fruit" ? 0.17 : 0),
            it.z
        );
        it.mesh.rotation.y =
            it.type === "fruit"
                ? it.age * (it.kind === "rainbow" ? 2 : 0.3)
                : it.heading;
        it.shadow.visible = true;
        it.shadow.position.set(it.x, groundY(it.x, it.z) + 0.02, it.z);
    }
    // Keep one of each critter around.
    g.critterTimer -= dt;
    if (g.critterTimer < 0) {
        g.critterTimer = 8;
        for (const kind of Object.keys(CRITTERS))
            if (!g.items.some((i) => i.kind === kind)) {
                spawnCritter(g, kind);
                break;
            }
    }
}

// ------------------------------------------------------------- player actions

/** What the player would act on right now, for the prompt and E. */
export function findTarget(g, player, peers) {
    const fx = Math.sin(player.heading);
    const fz = Math.cos(player.heading);
    let best = null;
    let bs = Infinity;
    const consider = (kind, ref, x, z, reach = 1.8) => {
        const dx = x - player.x;
        const dz = z - player.z;
        const d = Math.hypot(dx, dz);
        if (d > reach) return;
        const facing = (dx * fx + dz * fz) / (d || 1);
        const score = d - facing * 0.8;
        if (score < bs) {
            bs = score;
            best = { kind, ref, d };
        }
    };
    for (const b of g.bloomlings)
        if (g.held?.b !== b && !b.air) consider("bloomling", b, b.x, b.z);
    for (const it of g.items)
        if (!it.held && !(it.air && it.type === "fruit"))
            consider(
                it.type,
                it,
                it.x,
                it.z,
                it.kind === "fishlet" ? 2.6 : 1.8
            );
    for (const pb of peers?.bloomlings() || [])
        consider("peer-bloomling", pb, pb.x, pb.z);
    for (const t of g.ctx.world.trees)
        consider("tree", t, t.userData.x, t.userData.z, 2.7);
    return best;
}

export function grab(g, target) {
    if (!target || g.held) return false;
    if (target.kind === "bloomling") {
        const b = target.ref;
        if (b.state === "cocoon") return false;
        g.held = { b };
        setState(b, "held", 999);
        const likes = b.data.happy > -10;
        b.likes = likes;
        setMood(b, likes ? "heart" : "alert", 1.5);
        talk(g, b);
    } else if (target.kind === "fruit" || target.kind === "critter") {
        target.ref.held = true;
        target.ref.air = false;
        g.held = { item: target.ref };
    } else return false;
    play(g.ctx.audio, "pickup");
    return true;
}

export function shake(g, tree) {
    const drops = shakeTree(tree);
    play(g.ctx.audio, "shake");
    for (const d of drops) {
        const it = addItem(g, "fruit", d.kind, d.x, d.y, d.z);
        it.vx = rand(-1, 1);
        it.vz = rand(-1, 1);
        it.vy = 1;
        it.air = true;
        setTimeout(
            () => play(g.ctx.audio, "fruitfall"),
            120 + Math.random() * 300
        );
    }
    // Hungry bloomlings notice.
    for (const b of g.bloomlings)
        if (
            b.data.stage !== "egg" &&
            b.data.full < 60 &&
            Math.hypot(b.x - tree.userData.x, b.z - tree.userData.z) < 20
        )
            setMood(b, "alert", 1.5);
    return drops.length;
}

/** Give what you hold to one of your bloomlings, or drop it. */
export function useHeld(g, target, player) {
    const held = g.held;
    if (!held) return false;
    const item = held.item;
    if (
        item &&
        target?.kind === "bloomling" &&
        target.ref.data.stage !== "egg" &&
        target.ref.state !== "cocoon"
    ) {
        const b = target.ref;
        removeItem(g, item);
        if (item.type === "fruit") {
            setState(b, "eat", 2.2, { kind: item.kind });
            b.heading = Math.atan2(player.x - b.x, player.z - b.z);
            play(g.ctx.audio, "munch");
            g.events.push({ k: "feed", c: b.data.id, f: item.kind });
        } else {
            const r = give(b.data, item.kind);
            sparkles(g.ctx.fx, headPos(b), CRITTERS[item.kind].color, 24, 0.5);
            afterGift(g, b, r);
            setState(b, "happy", 2);
            g.ctx.toast(
                `${b.data.name} hugged the ${CRITTERS[item.kind].label}! ${
                    CRITTERS[item.kind].blurb
                }`
            );
            g.events.push({ k: "gift", c: b.data.id, f: item.kind });
            g.critterTimer = 20;
        }
        return true;
    }
    if (
        item &&
        target?.kind === "peer-bloomling" &&
        target.ref.data?.stage !== "egg"
    ) {
        removeItem(g, item);
        g.events.push({
            k: "gift-other",
            to: target.ref.owner,
            c: target.ref.id,
            item: item.type,
            f: item.kind,
        });
        hearts(
            g.ctx.fx,
            new THREE.Vector3(target.ref.x, target.ref.y + 0.8, target.ref.z),
            4
        );
        play(g.ctx.audio, "heart");
        g.ctx.toast(
            `You shared a ${
                item.type === "fruit"
                    ? FRUITS[item.kind].label
                    : CRITTERS[item.kind].label
            } with ${target.ref.name}.`
        );
        return true;
    }
    dropHeld(g, true);
    return true;
}

export function dropHeld(g, sound = true) {
    const held = g.held;
    if (!held) return;
    const p = g.ctx.player;
    const x = p.x + Math.sin(p.heading) * 0.7;
    const z = p.z + Math.cos(p.heading) * 0.7;
    if (held.b) {
        const b = held.b;
        b.x = x;
        b.z = z;
        b.y = p.y + 0.9;
        b.vx = b.vz = 0;
        b.vy = 0;
        b.air = true;
        setState(b, "idle", 1);
    } else {
        const it = held.item;
        it.held = false;
        it.x = x;
        it.z = z;
        it.y = p.y + 0.9;
        it.vx = it.vz = it.vy = 0;
        it.air = true;
    }
    g.held = null;
    if (sound) play(g.ctx.audio, "drop");
}

export function throwHeld(g) {
    const held = g.held;
    if (!held) return false;
    const p = g.ctx.player;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    const v = { x: fx * 5.5 + p.vx * 0.5, y: 4.2, z: fz * 5.5 + p.vz * 0.5 };
    const at = { x: p.x + fx * 0.5, y: p.y + 1.1, z: p.z + fz * 0.5 };
    if (held.b) {
        const b = held.b;
        Object.assign(b, {
            x: at.x,
            y: at.y,
            z: at.z,
            vx: v.x,
            vy: v.y,
            vz: v.z,
            air: true,
        });
        setState(b, "thrown", 99);
        if (b.data.stage !== "egg") {
            const now = performance.now();
            g.throwLog = g.throwLog.filter((t) => now - t < 12000);
            g.throwLog.push(now);
            const hard = g.throwLog.length >= 3;
            toss(b.data, hard);
            setMood(b, hard ? "swirl" : "alert", 1.2);
            g.events.push({ k: "toss", c: b.data.id });
        }
    } else {
        const it = held.item;
        it.held = false;
        Object.assign(it, {
            x: at.x,
            y: at.y,
            z: at.z,
            vx: v.x,
            vy: v.y,
            vz: v.z,
            air: true,
        });
    }
    g.held = null;
    play(g.ctx.audio, "throw");
    return true;
}

/** One pet stroke (called while F is held). */
export function petStroke(g, b) {
    const c = b.data;
    if (c.stage === "egg") {
        b.petT = 0.5;
        if (Math.random() < 0.3)
            sparkles(g.ctx.fx, headPos(b), 0xffffff, 2, 0.2);
        return;
    }
    if (b.state === "cocoon" || b.air) return;
    if (b.state !== "pet") {
        setState(b, "pet", 0.6);
        talk(g, b);
    }
    b.timer = 0.6;
    b.petT += 1;
    if (b.petT % 24 === 0) {
        pet(c);
        hearts(g.ctx.fx, headPos(b), 3);
        play(g.ctx.audio, "heart");
        setMood(b, "heart", 2);
        g.events.push({ k: "pet", c: c.id });
    }
}

export function whistle(g) {
    play(g.ctx.audio, "whistle");
    for (const b of g.bloomlings) {
        if (
            b.data.stage === "egg" ||
            b.state === "cocoon" ||
            b.air ||
            g.held?.b === b
        )
            continue;
        setMood(b, "alert", 1.5);
        setState(b, "follow", 9);
    }
}

/** Apply something another player did to one of your bloomlings. */
export function receiveKindness(g, ev, from) {
    const b = bloomlingAt(g, ev.c);
    if (!b || b.data.stage === "egg") return;
    if (ev.k === "pet-other") {
        pet(b.data);
        hearts(g.ctx.fx, headPos(b), 3);
        setMood(b, "heart", 2);
        setState(b, "pet", 0.8);
        if (Math.random() < 0.25)
            g.ctx.toast(`${from} is petting ${b.data.name}.`);
    } else if (ev.k === "gift-other") {
        if (ev.item === "fruit" && FRUITS[ev.f]) {
            setState(b, "eat", 2.2, { kind: ev.f });
            g.ctx.toast(`${from} fed ${b.data.name} a ${FRUITS[ev.f].label}.`);
        } else if (CRITTERS[ev.f]) {
            afterGift(g, b, give(b.data, ev.f));
            g.ctx.toast(
                `${from} gave ${b.data.name} a ${CRITTERS[ev.f].label}!`
            );
        }
    }
}

// ------------------------------------------------------------- frame

const carry = new THREE.Vector3();
export function updateGarden(g, dt, carryWorld) {
    // Nest: a new egg whenever there's room.
    g.nestTimer -= dt;
    if (g.nestTimer < 0) {
        g.nestTimer = 60;
        if (
            g.bloomlings.length < MAX_BLOOMLINGS &&
            !g.bloomlings.some((b) => b.data.stage === "egg")
        ) {
            const b = addBloomling(g, newEgg(Math.random, NEST));
            b.x = NEST.x;
            b.z = NEST.z;
            b.y = groundY(NEST.x, NEST.z) + 0.1;
            g.ctx.toast("A new egg appeared in the nest by the hut!");
        }
    }
    g.lookTimer = (g.lookTimer || 0) - dt;
    if (g.lookTimer < 0) {
        g.lookTimer = 1;
        for (const b of g.bloomlings) refreshLook(b);
    }
    for (const b of g.bloomlings) updateBloomling(g, b, dt);
    updateItems(g, dt);
    // Held thing rides in the arms.
    if (g.held) {
        carry.copy(carryWorld);
        if (g.held.b) {
            const b = g.held.b;
            b.x = carry.x;
            b.y = carry.y - 0.08;
            b.z = carry.z;
            b.heading = g.ctx.player.heading;
        } else {
            const it = g.held.item;
            it.x = carry.x;
            it.y = carry.y;
            it.z = carry.z;
            it.heading = g.ctx.player.heading;
            it.mesh.position.set(it.x, it.y, it.z);
            it.mesh.rotation.y = it.heading;
        }
    }
    for (const b of g.bloomlings) {
        b.view.root.position.set(b.x, b.y, b.z);
        b.view.root.rotation.y = b.heading;
        poseBloomling(
            b.view,
            {
                act: b.act,
                speed: b.anim || b.speed,
                mood: b.orb,
                hatch: b.data.stage === "egg" ? b.data.hatch / HATCH_AFTER : 0,
                cocoon: b.cocoonT / 6,
                likes: b.likes,
            },
            dt
        );
        updateOrb(b.view, dt, g.ctx.scene, !g.hideOrbs);
        b.shadow.position.set(b.x, groundY(b.x, b.z) + 0.02, b.z);
        b.shadow.visible = g.held?.b !== b;
        b.view.root.visible = !b.away;
    }
    g.saveTimer -= dt;
    if (g.saveTimer < 0) {
        g.saveTimer = 6;
        save(g);
    }
}

// ------------------------------------------------------------- network

const r2 = (v) => Math.round(v * 100) / 100;
/** Compact wire snapshot of your bloomlings. */
export function snapshot(g) {
    return g.bloomlings
        .filter((b) => !b.away)
        .map((b) => [
            b.data.id,
            r2(b.x),
            r2(b.y),
            r2(b.z),
            r2(b.heading),
            Math.max(0, ACTS.indexOf(b.act)),
            Math.max(0, ORBS.indexOf(b.orb || "ball")),
            r2(b.speed),
        ]);
}

export function looks(g) {
    const out = {};
    for (const b of g.bloomlings) out[b.data.id] = lookOf(b.data);
    return out;
}

// ------------------------------------------------------------- persistence

// Bloomlings live in this browser for now. Server persistence would slot in
// here: the same sanitized records keyed by the signed-in user (an API route
// on server/, or per-user attributes on the multiplayer room).
/** The persistent record of your bloomlings (JSON, a few KB). */
export function saveData(g) {
    for (const b of g.bloomlings) b.data.home = { x: r2(b.x), z: r2(b.z) };
    return { v: 1, saved: Date.now(), list: g.bloomlings.map((b) => b.data) };
}

export function save(g) {
    // The host persists it: browser storage on the web, app storage natively.
    g.ctx.storage?.(saveData(g));
}

function load(g) {
    const raw = g.ctx.saved;
    if (!raw || !Array.isArray(raw.list)) return;
    for (const item of raw.list.slice(0, MAX_BLOOMLINGS)) {
        const c = sanitize(item);
        if (c) addBloomling(g, c);
    }
}

export function release(g, b) {
    const i = g.bloomlings.indexOf(b);
    if (i < 0) return;
    if (g.held?.b === b) g.held = null;
    g.bloomlings.splice(i, 1);
    disposeBloomling(b.view);
    b.shadow.parent?.remove(b.shadow);
    save(g);
}

export { HUT };
