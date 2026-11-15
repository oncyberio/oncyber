import * as THREE from "three/webgpu";
import {
    abs,
    clamp,
    color,
    float,
    fract,
    hash,
    instanceIndex,
    instancedBufferAttribute,
    length,
    mix,
    mx_fractal_noise_float,
    normalWorld,
    positionLocal,
    positionWorld,
    sin,
    smoothstep,
    step,
    uv,
    vec2,
    vec3,
} from "three/tsl";
import { HOOPS, HOOP_X, PITCH } from "./sim.js";

// The Skyhoop bowl: a mown oval in a ring of hills, twelve timber stands
// under striped canopies, white towers between them, six hoops on gilded
// poles, a forest and far mountains. Everything repeated is one instanced
// draw: tier steps, canopies, columns, towers, roofs, pennants, trees.

export const TEAM_COLORS = [new THREE.Color(0xff5a1f), new THREE.Color(0x13b8c4)];
export const TEAM_DEEP = [new THREE.Color(0xa8260c), new THREE.Color(0x0b5f8a)];
export const CREAM = new THREE.Color(0xf3e6cc);

/** The stands' inner edge, an oval just outside the pitch. */
export const STANDS = { a: PITCH.a + 7, b: PITCH.b + 7, rows: 22, rowDepth: 0.86, rowRise: 0.6, base: 5.5, segments: 12 };

const tmp = new THREE.Object3D();

/** Seeded random for layout. */
function rand(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ---------------------------------------------------------------- terrain

function valueNoise2(seed) {
    const r = rand(seed);
    const p = new Uint8Array(512);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 256; i++) p[i + 256] = p[i];
    const g = new Float32Array(256).map(() => r() * 2 - 1);
    const fade = (t) => t * t * (3 - 2 * t);
    return (x, y) => {
        const xi = Math.floor(x);
        const yi = Math.floor(y);
        const xf = x - xi;
        const yf = y - yi;
        const a = g[p[(xi & 255) + p[yi & 255]]];
        const b = g[p[((xi + 1) & 255) + p[yi & 255]]];
        const c = g[p[(xi & 255) + p[(yi + 1) & 255]]];
        const d = g[p[((xi + 1) & 255) + p[(yi + 1) & 255]]];
        const u = fade(xf);
        const v = fade(yf);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
}

/** Height of the land around the bowl; flat inside the stands. */
export function makeTerrain() {
    const n = valueNoise2(7);
    const fbm = (x, y) => {
        let s = 0;
        let a = 1;
        let f = 1;
        for (let i = 0; i < 5; i++) {
            s += n(x * f, y * f) * a;
            a *= 0.5;
            f *= 2.07;
        }
        return s;
    };
    return (x, z) => {
        const e = Math.hypot(x / (STANDS.a + 40), z / (STANDS.b + 40));
        if (e < 1) return 0;
        const r = Math.hypot(x, z);
        const ridge = 1 - Math.abs(fbm(x * 0.0012 + 3, z * 0.0012 - 5));
        const hills = Math.min(1, (e - 1) * 0.6) * (fbm(x * 0.008, z * 0.008) * 9 + 6);
        const far = THREE.MathUtils.smoothstep(r, 380, 900);
        return hills + far * (Math.pow(ridge, 3) * 210 + (fbm(x * 0.0016, z * 0.0016) * 0.5 + 0.5) * 120);
    };
}

function terrainMesh(heightAt) {
    const size = 3200;
    const seg = 220;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        // Concentrate vertices near the middle: radial remap.
        let x = pos.getX(i);
        let z = pos.getZ(i);
        const r = Math.hypot(x, z) / (size / 2);
        const k = r > 0 ? (Math.pow(r, 1.6) * (size / 2)) / (r * (size / 2)) : 1;
        x *= k;
        z *= k;
        pos.setXYZ(i, x, heightAt(x, z), z);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0 });
    const p = positionWorld.xz;
    // Pitch space: the oval, the mowing stripes and the painted lines.
    const e = length(p.div(vec2(PITCH.a, PITCH.b)));
    const grain = mx_fractal_noise_float(vec3(p.mul(0.06), 1.0), 4, 2.0, 0.5);
    const fine = mx_fractal_noise_float(vec3(p.mul(0.7), 3.0), 2, 2.0, 0.5);
    const stripe = step(0.5, fract(p.x.div(7).add(0.5)));
    const mow = stripe.mul(0.5);
    const lush = mix(color(0x2f6b1e), color(0x3d8526), mow);
    let ground = lush.mul(grain.mul(0.18).add(0.95)).mul(fine.mul(0.06).add(1));
    const lineW = 0.16;
    const boundary = smoothstep(lineW, 0, abs(e.sub(1)).mul(PITCH.b));
    const mid = smoothstep(lineW, 0, abs(p.x)).mul(step(e, 1));
    const circle = smoothstep(lineW, 0, abs(length(p).sub(9)));
    const keeperA = smoothstep(lineW, 0, abs(length(p.sub(vec2(HOOP_X, 0))).sub(17))).mul(step(p.x, HOOP_X));
    const keeperB = smoothstep(lineW, 0, abs(length(p.add(vec2(HOOP_X, 0))).sub(17))).mul(step(p.x.negate(), HOOP_X));
    const lines = clamp(boundary.add(mid).add(circle).add(keeperA.add(keeperB).mul(step(e, 1))), 0, 1);
    ground = mix(ground, color(0xd9d6c8), lines.mul(0.8));
    // Outside the oval: a darker apron, then the hills: grass, scrub, rock, snow.
    const apron = mix(color(0x2a4f1a), color(0x3a5c22), grain.mul(0.5).add(0.5));
    const outside = smoothstep(1.0, 1.04, e);
    ground = mix(ground, apron, outside);
    const y = positionWorld.y;
    const slope = float(1).sub(normalWorld.y);
    const hill = mix(color(0x4a6b2b), color(0x6c7a3c), grain.mul(0.5).add(0.5));
    const rock = mix(color(0x6d6a63), color(0x8c877c), fine.mul(0.5).add(0.5));
    let land = mix(hill, color(0x2f4a24), smoothstep(10, 60, y).mul(0.6));
    land = mix(land, rock, smoothstep(0.25, 0.5, slope).max(smoothstep(110, 170, y)));
    land = mix(land, color(0xf2f4f7), smoothstep(200, 240, y.add(grain.mul(25))).mul(smoothstep(0.65, 0.4, slope)));
    ground = mix(ground, land, smoothstep(1.0, 4.0, y));
    mat.colorNode = ground;
    mat.roughnessNode = float(0.95);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
}

// ---------------------------------------------------------------- helpers

function instanced(geo, mat, count, { cast = true, receive = true } = {}) {
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    mesh.frustumCulled = false;
    return mesh;
}

function place(mesh, i, x, y, z, yaw = 0, sx = 1, sy = 1, sz = 1, pitch = 0, roll = 0) {
    tmp.position.set(x, y, z);
    tmp.rotation.set(pitch, yaw, roll, "YXZ");
    tmp.scale.set(sx, sy, sz);
    tmp.updateMatrix();
    mesh.setMatrixAt(i, tmp.matrix);
}

/** A per-instance colour attribute read with instancedBufferAttribute(). */
function colorAttr(count) {
    return new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
}

/** Point on the stands oval at parameter t, pushed out by d. */
export function ovalPoint(t, d = 0, a = STANDS.a, b = STANDS.b) {
    const c = Math.cos(t);
    const s = Math.sin(t);
    const nx = c / a;
    const nz = s / b;
    const nl = Math.hypot(nx, nz);
    return { x: a * c + (nx / nl) * d, z: b * s + (nz / nl) * d, nx: nx / nl, nz: nz / nl };
}

/** Samples along an arc of the oval, every `step` metres at depth d. */
function arcSamples(t0, t1, d, stepLen) {
    const out = [];
    let acc = stepLen / 2;
    let prev = ovalPoint(t0, d);
    const N = 400;
    for (let i = 1; i <= N; i++) {
        const t = t0 + ((t1 - t0) * i) / N;
        const p = ovalPoint(t, d);
        const l = Math.hypot(p.x - prev.x, p.z - prev.z);
        acc += l;
        while (acc >= stepLen) {
            acc -= stepLen;
            out.push({ ...p, t });
        }
        prev = p;
    }
    return out;
}

// ---------------------------------------------------------------- stands

/** Seat spots for the crowd: { x, y, z, yaw, team, row }. Shared with crowd.js. */
export function standLayout() {
    const segs = [];
    const S = STANDS;
    const span = ((Math.PI * 2) / S.segments) * 0.8;
    for (let k = 0; k < S.segments; k++) {
        const tc = (k / S.segments) * Math.PI * 2 + Math.PI / S.segments;
        // Halves of the bowl lean to the team whose hoops they sit behind.
        const team = Math.cos(tc) > 0.25 ? 1 : Math.cos(tc) < -0.25 ? 0 : k % 2;
        segs.push({ t0: tc - span / 2, t1: tc + span / 2, tc, team, k });
    }
    return segs;
}

export function rowHeight(i) {
    return STANDS.base + i * STANDS.rowRise;
}

function buildStands(group) {
    const segs = standLayout();
    const S = STANDS;
    const slices = [];
    for (const seg of segs)
        for (let i = 0; i < S.rows; i++)
            for (const p of arcSamples(seg.t0, seg.t1, i * S.rowDepth, 2.4)) slices.push({ ...p, i, seg });
    // Tier steps: one box per row slice, stepped up the bank.
    const woodMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.82, metalness: 0 });
    const h = hash(instanceIndex);
    const plank = fract(positionWorld.y.mul(3.4)).sub(0.5).abs().mul(2);
    woodMat.colorNode = mix(color(0x6b4428), color(0x9a6a3e), h.mul(0.6).add(plank.mul(0.25)));
    const tierGeo = new THREE.BoxGeometry(2.5, 1, S.rowDepth + 0.04);
    tierGeo.translate(0, -0.5, 0);
    const tiers = instanced(tierGeo, woodMat, slices.length);
    slices.forEach((s, j) => {
        const yaw = Math.atan2(s.nx, s.nz);
        const y = rowHeight(s.i);
        place(tiers, j, s.x + s.nx * S.rowDepth * 0.5, y, s.z + s.nz * S.rowDepth * 0.5, yaw, 1, S.rowRise + (s.i === 0 ? S.base : 0.6), 1);
    });
    group.add(tiers);

    // Front fascia: painted boards under the first row, in team colours.
    const front = arcList(segs, -0.05, 2.4);
    const fasciaCol = colorAttr(front.length);
    const fasciaMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.7 });
    const fc = instancedBufferAttribute(fasciaCol);
    const band = step(0.5, fract(uv().y.mul(3)));
    fasciaMat.colorNode = mix(fc, color(CREAM), band.mul(0.85));
    const fascia = instanced(new THREE.BoxGeometry(2.45, S.base, 0.2), fasciaMat, front.length);
    front.forEach((s, j) => {
        place(fascia, j, s.x, S.base / 2, s.z, Math.atan2(s.nx, s.nz));
        const c = TEAM_COLORS[s.seg.team];
        fasciaCol.setXYZ(j, c.r, c.g, c.b);
    });
    group.add(fascia);

    // Back wall and canopy.
    const backD = S.rows * S.rowDepth;
    const back = arcList(segs, backD + 0.2, 2.4);
    const wall = instanced(new THREE.BoxGeometry(2.45, 1, 0.4), woodMat, back.length);
    const top = rowHeight(S.rows) + 6;
    back.forEach((s, j) => place(wall, j, s.x, top / 2, s.z, Math.atan2(s.nx, s.nz), 1, top, 1));
    group.add(wall);

    const canopyList = arcList(segs, backD * 0.55, 2.45);
    const canopyCol = colorAttr(canopyList.length);
    const canopyMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.85, side: THREE.DoubleSide });
    const cc = instancedBufferAttribute(canopyCol);
    // Stripes across each panel, and a scalloped valance edge at the front.
    const stripes = step(0.5, fract(uv().x.mul(2)));
    canopyMat.colorNode = mix(color(CREAM), cc, stripes);
    const canopyGeo = new THREE.BoxGeometry(2.48, 0.12, backD + 4);
    const canopy = instanced(canopyGeo, canopyMat, canopyList.length);
    canopyList.forEach((s, j) => {
        const y = top - 1.5;
        place(canopy, j, s.x, y, s.z, Math.atan2(s.nx, s.nz), 1, 1, 1, -0.16);
        const c = s.seg.team === 0 ? TEAM_COLORS[0] : TEAM_COLORS[1];
        canopyCol.setXYZ(j, c.r, c.g, c.b);
    });
    group.add(canopy);

    // Columns: front posts holding the canopy, every other slice.
    const posts = arcList(segs, -0.3, 7.2);
    const postMat = new THREE.MeshStandardNodeMaterial({ color: 0xe9e0cc, roughness: 0.55, metalness: 0.1 });
    const postGeo = new THREE.CylinderGeometry(0.16, 0.2, 1, 10);
    postGeo.translate(0, 0.5, 0);
    const postMesh = instanced(postGeo, postMat, posts.length);
    posts.forEach((s, j) => place(postMesh, j, s.x, 0, s.z, 0, 1, top - 1.2 - backD * 0.08, 1));
    group.add(postMesh);

    // Pennants on the canopy ridge.
    const flags = arcList(segs, backD + 0.2, 6);
    addFlags(group, flags.map((s) => ({ x: s.x, y: top + 1.4, z: s.z, team: s.seg.team, h: 3 })));
    return { segs, top };
}

function arcList(segs, d, stepLen) {
    const out = [];
    for (const seg of segs) for (const p of arcSamples(seg.t0, seg.t1, d, stepLen)) out.push({ ...p, seg });
    return out;
}

// ---------------------------------------------------------------- towers

function buildTowers(group, flagSpots, topStands) {
    const S = STANDS;
    const spots = [];
    for (let k = 0; k < S.segments; k++) {
        const t = (k / S.segments) * Math.PI * 2;
        const p = ovalPoint(t, S.rows * S.rowDepth * 0.5);
        spots.push({ ...p, k, h: topStands + 10 + (k % 3 === 0 ? 8 : 0) });
    }
    const n = spots.length;
    const stone = new THREE.MeshStandardNodeMaterial({ roughness: 0.78 });
    const courses = fract(positionWorld.y.mul(0.9));
    const grain = mx_fractal_noise_float(vec3(positionWorld.mul(0.35)), 3, 2, 0.5);
    stone.colorNode = mix(color(0xd9d0bd), color(0xf1ead9), grain.mul(0.5).add(0.5))
        .mul(smoothstep(0.0, 0.06, courses).mul(0.12).add(0.88))
        .mul(mix(float(0.7), float(1), smoothstep(0, 4, positionWorld.y)));
    const bodyGeo = new THREE.CylinderGeometry(3.2, 3.7, 1, 18);
    bodyGeo.translate(0, 0.5, 0);
    const body = instanced(bodyGeo, stone, n);
    // Crenellated cap ring and a tall conical roof.
    const capGeo = new THREE.CylinderGeometry(3.9, 3.9, 1.4, 18);
    const cap = instanced(capGeo, stone, n);
    const roofCol = colorAttr(n);
    const roofMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.5, metalness: 0.05 });
    const shingles = step(0.5, fract(positionWorld.y.mul(1.6).add(sin(positionWorld.x.add(positionWorld.z).mul(2)).mul(0.1))));
    roofMat.colorNode = instancedBufferAttribute(roofCol).mul(shingles.mul(0.18).add(0.82));
    const roofGeo = new THREE.ConeGeometry(4.3, 9, 18);
    roofGeo.translate(0, 4.5, 0);
    const roof = instanced(roofGeo, roofMat, n);
    // Window slits glowing warm.
    const winMat = new THREE.MeshStandardNodeMaterial({ color: 0x1a120b, emissive: 0xffa040, emissiveIntensity: 1.4 });
    const winGeo = new THREE.BoxGeometry(0.5, 1.6, 0.3);
    const wins = instanced(winGeo, winMat, n * 6, { cast: false });
    spots.forEach((s, j) => {
        place(body, j, s.x, 0, s.z, 0, 1, s.h, 1);
        place(cap, j, s.x, s.h + 0.7, s.z);
        place(roof, j, s.x, s.h + 1.4, s.z);
        const c = TEAM_DEEP[j % 2];
        roofCol.setXYZ(j, c.r, c.g, c.b);
        for (let w = 0; w < 6; w++) {
            const a = (w / 6) * Math.PI * 2 + j;
            const y = s.h * (0.35 + (w % 3) * 0.2);
            place(wins, j * 6 + w, s.x + Math.sin(a) * 3.45, y, s.z + Math.cos(a) * 3.45, a);
        }
        flagSpots.push({ x: s.x, y: s.h + 10.4, z: s.z, team: j % 2, h: 5 });
    });
    group.add(body, cap, roof, wins);
}

// ---------------------------------------------------------------- flags

export const WIND = new THREE.Vector3(0.8, 0, 0.6).normalize();

function addFlags(group, spots) {
    group.userData.flagSpots = (group.userData.flagSpots || []).concat(spots);
}

function buildFlags(group, spots, time) {
    const n = spots.length;
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 1, 6);
    poleGeo.translate(0, 0.5, 0);
    const poleMat = new THREE.MeshStandardNodeMaterial({ color: 0xd9b45a, roughness: 0.3, metalness: 0.9 });
    const poles = instanced(poleGeo, poleMat, n, { cast: false });
    // Flags: a pennant strip along the wind, rippling.
    const flagGeo = new THREE.PlaneGeometry(1, 1, 12, 3);
    flagGeo.translate(0.5, -0.5, 0);
    const flagCol = colorAttr(n);
    const flagMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.8, side: THREE.DoubleSide });
    const u = uv().x;
    const fc = instancedBufferAttribute(flagCol);
    flagMat.colorNode = mix(fc, color(CREAM), step(0.72, u).mul(0.9));
    const side = vec3(-WIND.z, 0, WIND.x);
    const phase = hash(instanceIndex).mul(6.28);
    const wave = sin(u.mul(7).sub(time.mul(7)).add(phase)).mul(u).mul(0.55);
    flagMat.positionNode = positionLocal.add(side.mul(wave)).add(vec3(0, sin(u.mul(5).sub(time.mul(5)).add(phase)).mul(u).mul(0.12), 0));
    // Tapered pennant: shrink the far end.
    const flags = instanced(flagGeo, flagMat, n, { cast: false });
    const yaw = Math.atan2(-WIND.z, WIND.x);
    spots.forEach((s, j) => {
        place(poles, j, s.x, s.y - s.h, s.z, 0, 1, s.h + 0.4, 1);
        place(flags, j, s.x, s.y, s.z, yaw, s.h * 1.1, s.h * 0.42, 1);
        const c = TEAM_COLORS[s.team];
        flagCol.setXYZ(j, c.r, c.g, c.b);
    });
    group.add(poles, flags);
}

// ---------------------------------------------------------------- hoops

export function buildHoops(group) {
    const n = HOOPS.length * 2;
    const gold = new THREE.MeshStandardNodeMaterial({ color: 0xe8b84a, roughness: 0.22, metalness: 1 });
    const poleGeo = new THREE.CylinderGeometry(0.2, 0.32, 1, 16);
    poleGeo.translate(0, 0.5, 0);
    const poles = instanced(poleGeo, gold, n);
    const ringGeo = new THREE.TorusGeometry(1, 0.075, 16, 64);
    const rings = instanced(ringGeo, gold, n);
    const glowGeo = new THREE.TorusGeometry(1, 0.03, 8, 64);
    const glowCol = colorAttr(n);
    const glowMat = new THREE.MeshBasicNodeMaterial({ toneMapped: true });
    const glowLevel = new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1);
    glowMat.colorNode = instancedBufferAttribute(glowCol).mul(instancedBufferAttribute(glowLevel).mul(4).add(1.6));
    const glows = instanced(glowGeo, glowMat, n, { cast: false, receive: false });
    // Stone plinths.
    const plinthGeo = new THREE.CylinderGeometry(1.1, 1.4, 1.2, 12);
    const plinthMat = new THREE.MeshStandardNodeMaterial({ color: 0xcfc6b4, roughness: 0.8 });
    const plinths = instanced(plinthGeo, plinthMat, n);
    const centers = [];
    let i = 0;
    for (const side of [-1, 1]) {
        HOOPS.forEach((h) => {
            const x = side * HOOP_X;
            place(poles, i, x, 0, h.z, 0, 1, h.y - h.r, 1);
            place(rings, i, x, h.y, h.z, Math.PI / 2, h.r + 0.075, h.r + 0.075, 1);
            place(glows, i, x, h.y, h.z, Math.PI / 2, h.r - 0.05, h.r - 0.05, 1);
            place(plinths, i, x, 0.6, h.z);
            // Team 0 defends the x < 0 hoops.
            const c = TEAM_COLORS[side < 0 ? 0 : 1];
            glowCol.setXYZ(i, c.r, c.g, c.b);
            centers.push({ x, y: h.y, z: h.z, r: h.r, side });
            i++;
        });
    }
    group.add(poles, rings, glows, plinths);
    return {
        centers,
        /** 0..1 glow boost per hoop (0..5 for side -1, 3..5 is side +1). */
        setGlow(index, level) {
            glowLevel.setX(index, level);
            glowLevel.needsUpdate = true;
        },
    };
}

// ---------------------------------------------------------------- trees

function buildForest(group, heightAt) {
    const r = rand(11);
    const spots = [];
    while (spots.length < 2600) {
        const t = r() * Math.PI * 2;
        const d = 70 + Math.pow(r(), 0.7) * 380;
        const x = Math.cos(t) * (STANDS.a + d);
        const z = Math.sin(t) * (STANDS.b + d);
        const y = heightAt(x, z);
        if (y > 120) continue;
        // Clumps: skip some on a coarse noise.
        if (Math.sin(x * 0.03) * Math.cos(z * 0.035) > 0.45 && r() < 0.8) continue;
        spots.push({ x, y, z, s: 0.7 + r() * 0.9, k: r() });
    }
    const n = spots.length;
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 3, 6);
    trunkGeo.translate(0, 1.5, 0);
    const trunkMat = new THREE.MeshStandardNodeMaterial({ color: 0x4a3322, roughness: 0.9 });
    const trunks = instanced(trunkGeo, trunkMat, n, { cast: false });
    // Layered conifer crown: three stacked cones merged.
    const crownGeo = mergeCones();
    const crownMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.9 });
    const hk = hash(instanceIndex.add(7));
    crownMat.colorNode = mix(color(0x1f4a24), color(0x3b6a2a), hk).mul(smoothstep(0, 14, positionLocal.y).mul(0.35).add(0.75));
    const crowns = instanced(crownGeo, crownMat, n, { cast: false });
    spots.forEach((s, j) => {
        place(trunks, j, s.x, s.y - 0.3, s.z, s.k * 6, s.s, s.s, s.s);
        place(crowns, j, s.x, s.y - 0.3, s.z, s.k * 6, s.s * (0.9 + s.k * 0.3), s.s, s.s * (0.9 + s.k * 0.3));
    });
    group.add(trunks, crowns);
}

function mergeCones() {
    const parts = [
        [3.6, 6, 3.5],
        [2.8, 5, 6.5],
        [1.9, 4, 9.2],
    ].map(([r, h, y]) => {
        const g = new THREE.ConeGeometry(r, h, 8, 1);
        g.translate(0, y, 0);
        return g.toNonIndexed();
    });
    const count = parts.reduce((s, g) => s + g.attributes.position.count, 0);
    const pos = new Float32Array(count * 3);
    const nor = new Float32Array(count * 3);
    let o = 0;
    for (const g of parts) {
        pos.set(g.attributes.position.array, o * 3);
        nor.set(g.attributes.normal.array, o * 3);
        o += g.attributes.position.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    return geo;
}

// ---------------------------------------------------------------- arena

export function createArena(time) {
    const group = new THREE.Group();
    const heightAt = makeTerrain();
    group.add(terrainMesh(heightAt));
    const stands = buildStands(group);
    const flagSpots = group.userData.flagSpots || [];
    buildTowers(group, flagSpots, stands.top);
    buildFlags(group, flagSpots, time);
    const hoops = buildHoops(group);
    buildForest(group, heightAt);
    return { group, hoops, heightAt, stands };
}
