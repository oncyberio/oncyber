import * as THREE from "three/webgpu";
import {
    CARRY_OFFSET,
    createAvatar,
    disposeAvatar,
    driveAvatar,
    nameplate,
} from "./avatar.js";
import {
    createBloomling,
    disposeBloomling,
    orbColor,
    poseBloomling,
    setLook,
    setOrb,
    updateOrb,
} from "./creature.js";
import { critterMesh } from "./critters.js";
import { fruitGeometry } from "./world.js";
import { toon } from "./toon.js";
import { hearts, sparkles, burst } from "./fx.js";
import { ACTS, ORBS } from "./garden.js";
import { CRITTERS, FRUITS } from "./sim.js";

// Everyone else in the garden: their VRM avatars (from room poses) and their
// bloomlings (from the packets their owners broadcast), both drawn a little
// in the past so they can be interpolated smoothly.

const POSE_DELAY = 0.26;
const PET_DELAY = 0.5;
const COLORS = [
    "#ff5f7e",
    "#2f7bff",
    "#ffc23d",
    "#3fbf5a",
    "#a07bff",
    "#ff8a4a",
];

export function createPeers(ctx) {
    return { ctx, players: new Map(), loading: 0, queue: [] };
}

function colorFor(id) {
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return COLORS[h % COLORS.length];
}

function addPlayer(P, id) {
    const color = colorFor(id);
    const av = createAvatar(new THREE.Color(color).getHex());
    P.ctx.scene.add(av.root);
    const tag = nameplate("…", color);
    tag.position.y = 2.05;
    av.root.add(tag);
    const p = {
        id,
        av,
        tag,
        name: "",
        vrm: "",
        samples: [],
        x: 0,
        y: 0,
        z: 0,
        h: 0,
        speed: 0,
        anim: 0,
        holding: false,
        held: null,
        heldMesh: null,
        bloomlings: new Map(),
        looks: {},
        seen: performance.now(),
        color,
    };
    P.players.set(id, p);
    return p;
}

function removePlayer(P, p) {
    disposeAvatar(p.av);
    for (const b of p.bloomlings.values()) {
        disposeBloomling(b.view);
    }
    p.heldMesh?.parent?.remove(p.heldMesh);
    P.players.delete(p.id);
}

async function loadAvatar(P, p, url) {
    if (!url || P.loading > 1) {
        if (url) P.queue.push(() => loadAvatar(P, p, url));
        return;
    }
    P.loading++;
    try {
        if (!P.players.has(p.id) || p.vrm !== url) return;
        await P.ctx.loadAvatar(p.av, url);
    } catch (err) {
        console.warn("[garden] peer avatar", err);
    } finally {
        P.loading--;
        P.queue.shift()?.();
    }
}

/** Room poses from the host (10 Hz). */
export function receivePeers(P, list) {
    const now = performance.now() / 1000;
    const alive = new Set();
    for (const raw of Array.isArray(list) ? list.slice(0, 32) : []) {
        if (typeof raw?.id !== "string") continue;
        alive.add(raw.id);
        const p = P.players.get(raw.id) || addPlayer(P, raw.id);
        p.seen = performance.now();
        const name = String(raw.name || "Visitor").slice(0, 24);
        if (name !== p.name) {
            p.name = name;
            p.av.root.remove(p.tag);
            p.tag = nameplate(name, p.color);
            p.tag.position.y = 2.05;
            p.av.root.add(p.tag);
        }
        const vrm = typeof raw.vrm === "string" ? raw.vrm : "";
        if (vrm && vrm !== p.vrm) {
            p.vrm = vrm;
            loadAvatar(P, p, vrm);
        }
        const last = p.samples[p.samples.length - 1];
        if (!last || raw.fresh || last.x !== raw.x || last.z !== raw.z) {
            p.samples.push({
                t: now,
                x: raw.x,
                y: raw.y,
                z: raw.z,
                h: raw.h,
                a: raw.a,
            });
            if (p.samples.length > 20) p.samples.shift();
        }
    }
    for (const p of [...P.players.values()])
        if (!alive.has(p.id)) removePlayer(P, p);
}

function addPeerBloomling(P, p, id, look) {
    const view = createBloomling(look);
    P.ctx.scene.add(view.root);
    const b = {
        id,
        owner: p.id,
        view,
        samples: [],
        x: 0,
        y: 0,
        z: 0,
        h: 0,
        act: "idle",
        orb: "ball",
        speed: 0,
        name: look.name,
        data: { stage: look.stage },
        look,
    };
    p.bloomlings.set(id, b);
    return b;
}

/** A garden packet from another player (relayed through the room). */
export function receivePacket(P, from, data, onKindness) {
    const p = P.players.get(from);
    if (!p || !data || typeof data !== "object") return;
    const now = performance.now() / 1000;
    if (data.L && typeof data.L === "object") {
        for (const [id, look] of Object.entries(data.L).slice(0, 6)) {
            if (!look || typeof look !== "object") continue;
            p.looks[id] = look;
            const b = p.bloomlings.get(id);
            if (b) {
                setLook(b.view, look);
                b.look = look;
                b.name = String(look.name || "").slice(0, 16);
                b.data.stage = look.stage;
            }
        }
    }
    if (Array.isArray(data.g)) {
        const seen = new Set();
        for (const s of data.g.slice(0, 6)) {
            if (!Array.isArray(s) || typeof s[0] !== "string") continue;
            const [id, x, y, z, h, act, orb, speed] = s;
            if (![x, y, z, h].every(Number.isFinite)) continue;
            seen.add(id);
            let b = p.bloomlings.get(id);
            if (!b) {
                const look = p.looks[id];
                if (!look) continue;
                b = addPeerBloomling(P, p, id, look);
            }
            b.samples.push({
                t: now,
                x,
                y,
                z,
                h,
                act: ACTS[act] || "idle",
                orb: ORBS[orb] || "ball",
                speed: Number(speed) || 0,
            });
            if (b.samples.length > 12) b.samples.shift();
        }
        for (const [id, b] of p.bloomlings)
            if (!seen.has(id)) {
                disposeBloomling(b.view);
                p.bloomlings.delete(id);
            }
    }
    if ("h" in data) setHeld(P, p, typeof data.h === "string" ? data.h : null);
    for (const ev of Array.isArray(data.ev) ? data.ev.slice(0, 12) : []) {
        if (!ev || typeof ev !== "object") continue;
        const b = p.bloomlings.get(ev.c);
        const at = b ? new THREE.Vector3(b.x, b.y + 0.7, b.z) : null;
        if (ev.k === "pet" && at) hearts(P.ctx.fx, at, 3);
        else if ((ev.k === "feed" || ev.k === "gift") && at)
            sparkles(P.ctx.fx, at, 0xfff1a8, 10);
        else if (ev.k === "hatch" && at)
            burst(P.ctx.fx, at, [0xffffff, 0xffd23f], 30, 3);
        else if (ev.k === "evolve" && at)
            burst(P.ctx.fx, at, [0xffffff, 0xffd23f, 0x7fe3ff], 50, 4);
        else if (
            (ev.k === "pet-other" || ev.k === "gift-other") &&
            ev.to === P.ctx.selfId()
        )
            onKindness(ev, p.name || "Someone");
    }
}

function setHeld(P, p, held) {
    if (held === p.held) return;
    p.held = held;
    p.heldMesh?.parent?.remove(p.heldMesh);
    p.heldMesh = null;
    if (!held) return;
    const [type, kind] = held.split(":");
    if (type === "fruit" && FRUITS[kind])
        p.heldMesh = new THREE.Mesh(
            fruitGeometry(kind),
            toon(FRUITS[kind].color)
        );
    else if (type === "critter" && CRITTERS[kind])
        p.heldMesh = critterMesh(kind).group;
    if (p.heldMesh) {
        p.heldMesh.position.copy(CARRY_OFFSET);
        p.av.root.add(p.heldMesh);
    }
}

function sampleAt(samples, t) {
    if (!samples.length) return null;
    if (t <= samples[0].t) return samples[0];
    for (let i = samples.length - 1; i > 0; i--) {
        const a = samples[i - 1];
        const b = samples[i];
        if (t >= a.t) {
            if (t >= b.t) return b;
            const u = (t - a.t) / (b.t - a.t || 1);
            let dh = b.h - a.h;
            dh = Math.atan2(Math.sin(dh), Math.cos(dh));
            return {
                ...b,
                x: a.x + (b.x - a.x) * u,
                y: a.y + (b.y - a.y) * u,
                z: a.z + (b.z - a.z) * u,
                h: a.h + dh * u,
            };
        }
    }
    return samples[samples.length - 1];
}

export function updatePeers(P, dt) {
    const now = performance.now() / 1000;
    for (const p of P.players.values()) {
        const s = sampleAt(p.samples, now - POSE_DELAY);
        if (s) {
            const moved = Math.hypot(s.x - p.x, s.z - p.z);
            p.speed +=
                (Math.min(9, moved / Math.max(dt, 1e-3)) - p.speed) *
                Math.min(1, dt * 6);
            p.x = s.x;
            p.y = s.y;
            p.z = s.z;
            p.h = s.h;
            p.anim = s.a;
            p.av.root.position.set(p.x, p.y, p.z);
            p.av.root.rotation.y = p.h;
        }
        const a = p.anim & 7;
        driveAvatar(p.av, dt, {
            speed: p.speed,
            air: a === 3,
            act: a === 4 ? "wave" : "",
            holding: (p.anim & 8) !== 0,
        });
        for (const b of p.bloomlings.values()) {
            const bs = sampleAt(b.samples, now - PET_DELAY);
            if (bs) {
                b.x = bs.x;
                b.y = bs.y;
                b.z = bs.z;
                b.h = bs.h;
                b.act = bs.act;
                b.orb = bs.orb;
                b.speed = bs.speed;
            }
            b.view.root.position.set(b.x, b.y, b.z);
            b.view.root.rotation.y = b.h;
            poseBloomling(
                b.view,
                { act: b.act, speed: b.speed, mood: b.orb },
                dt
            );
            setOrb(
                b.view.orb,
                b.look.stage === "egg" || b.act === "cocoon" ? "none" : b.orb,
                orbColor(b.look.align)
            );
            updateOrb(b.view, dt, P.ctx.scene);
        }
    }
}

export function peerBloomlings(P) {
    const out = [];
    for (const p of P.players.values())
        for (const b of p.bloomlings.values()) out.push(b);
    return out;
}

export function peerCount(P) {
    return P.players.size;
}
