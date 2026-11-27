import * as THREE from "three/webgpu";
import {
    abs,
    cameraPosition,
    clamp,
    cos,
    dot,
    float,
    floor,
    fract,
    hash,
    instanceIndex,
    max,
    mix,
    mx_noise_float,
    normalize,
    positionLocal,
    positionWorld,
    pow,
    reflect,
    sin,
    smoothstep,
    texture,
    time,
    uniform,
    uv,
    vec2,
    vec3,
} from "three/tsl";
import {
    CAVE,
    DOJO_ISLE,
    FALLS,
    HUT,
    NEST,
    POND,
    RACE_GATE,
    RACE_ISLE,
    UPPER_WATER,
    WATER,
    heightAt,
    inPond,
    noise2,
    slopeAt,
} from "./terrain.js";
import { outline, toon } from "./toon.js";
import { FRUITS } from "./sim.js";
import { textTexture } from "./text.js";

// The garden: terrain, water, falls, sky, trees, grass, props, day and night.

const C = (hex) => new THREE.Color(hex);

// ------------------------------------------------------------- terrain mesh

function terrainPatch(cx, cz, size, res) {
    const geo = new THREE.PlaneGeometry(size, size, res, res);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const sand = C(0xf4dc98);
    const wet = C(0xd8b36c);
    const grassA = C(0x45c24f);
    const grassB = C(0x9be35a);
    const rockA = C(0xd9a675);
    const rockB = C(0xb27e57);
    const bed = C(0x6fc7b3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + cx;
        const z = pos.getZ(i) + cz;
        const h = heightAt(x, z);
        pos.setXYZ(i, x, h, z);
        const s = slopeAt(x, z);
        const n = noise2(x * 0.18, z * 0.18) * 0.5 + 0.5;
        if (h < -0.4) c.copy(inPond(x, z) ? bed : wet);
        else if (h < 0.45 && !inPond(x, z))
            c.copy(sand).lerp(wet, h < 0.1 ? 0.4 : 0);
        else c.copy(grassA).lerp(grassB, n);
        if (s > 1.1 && h > 0.3) {
            // Layered cliff bands.
            const band = Math.floor(h / 1.15) % 2;
            c.copy(band ? rockA : rockB).lerp(C(0xe8bd8a), n * 0.25);
        }
        colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
        geo,
        toon(0xffffff, { vertexColors: true, soft: true })
    );
    mesh.receiveShadow = true;
    return mesh;
}

// Ground heights baked for the water shader (depth tint and shore foam).
const DEPTH_BOUNDS = { x0: -220, z0: -80, w: 440, h: 160 };
function depthTexture() {
    const W = 640;
    const H = 232;
    const data = new Uint8Array(W * H * 4);
    for (let j = 0; j < H; j++)
        for (let i = 0; i < W; i++) {
            const x = DEPTH_BOUNDS.x0 + ((i + 0.5) / W) * DEPTH_BOUNDS.w;
            const z = DEPTH_BOUNDS.z0 + ((j + 0.5) / H) * DEPTH_BOUNDS.h;
            const h = heightAt(x, z);
            const v = Math.round(Math.min(1, Math.max(0, (h + 6) / 18)) * 255);
            data.set([v, v, v, 255], (j * W + i) * 4);
        }
    const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
}

// ------------------------------------------------------------- water

function waterMaterial(level, depthTex, sky) {
    const m = new THREE.MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
    });
    const wp = positionWorld;
    const t = time;
    // Analytic ripples plus a little noise make the normal.
    const ax = wp.x.mul(0.55).add(t.mul(1.1));
    const az = wp.z.mul(0.45).sub(t.mul(0.8));
    const bx = wp.x.mul(1.7).sub(wp.z.mul(0.9)).add(t.mul(2.1));
    const dx = cos(ax).mul(0.55).add(cos(bx).mul(0.35));
    const dz = cos(az).mul(-0.45).sub(cos(bx).mul(0.18));
    const nn = mx_noise_float(vec3(wp.x.mul(0.9), wp.z.mul(0.9), t.mul(0.6)));
    const N = normalize(vec3(dx.mul(0.09).add(nn.mul(0.06)), 1, dz.mul(0.09)));
    const V = normalize(cameraPosition.sub(wp));
    const ndv = max(dot(N, V), 0);
    const fres = pow(float(1).sub(ndv), 4).mul(0.85).add(0.05);
    const R = reflect(V.negate(), N);
    const rs = max(dot(R, sky.uSunDir), 0);
    const spec = pow(rs, 380).mul(7).add(pow(rs, 40).mul(0.35));
    const huv = vec2(
        wp.x.sub(DEPTH_BOUNDS.x0).div(DEPTH_BOUNDS.w),
        wp.z.sub(DEPTH_BOUNDS.z0).div(DEPTH_BOUNDS.h)
    );
    const ground = texture(depthTex, huv).r.mul(18).sub(6);
    const depth = float(level).sub(ground);
    const shallow = vec3(0.22, 0.86, 0.84);
    const deep = vec3(0.03, 0.3, 0.72);
    const base = mix(shallow, deep, smoothstep(0.05, 2.2, depth));
    // Lapping foam on the shore, two bands that breathe in and out.
    const lap = sin(depth.mul(9).sub(t.mul(1.8)).add(nn.mul(2)));
    const foamEdge = float(1).sub(
        smoothstep(0.0, 0.32, depth.add(nn.mul(0.08)))
    );
    const foamBand = smoothstep(0.75, 0.95, lap).mul(
        float(1).sub(smoothstep(0.2, 0.9, depth))
    );
    const foam = clamp(foamEdge.add(foamBand.mul(0.7)), 0, 1);
    // Sparkly caustic glints in the shallows.
    const glint = smoothstep(
        0.72,
        0.9,
        mx_noise_float(vec3(wp.x.mul(2.2), wp.z.mul(2.2), t.mul(1.3)))
    ).mul(float(1).sub(smoothstep(0.3, 2.5, depth)));
    let col = mix(base, sky.uHorizon, fres.mul(0.75));
    col = col.add(glint.mul(0.25));
    col = mix(col, vec3(1, 1, 1), foam.mul(0.9));
    col = col.add(sky.uSunColor.mul(spec).mul(sky.uSunVis));
    col = col.mul(sky.uLight);
    m.colorNode = col;
    m.opacityNode = clamp(
        smoothstep(0.0, 1.6, depth)
            .mul(0.35)
            .add(0.6)
            .add(foam)
            .add(fres.mul(0.3)),
        0,
        1
    );
    m.fog = true;
    return m;
}

// The falls: a ribbon arcing off the lip of the upper channel and down in
// front of the cliff into the plunge pool, with scrolling toon streaks, a
// foam skirt where it lands and a white lip at the top.
const LIP_Z = -21.05;
const FOOT_Z = -20.15;
function fallsZ(v) {
    // v: 0 at the lip .. 1 at the pool. Water shoots out, then drops.
    return LIP_Z + (FOOT_Z - LIP_Z) * Math.sqrt(v);
}

function waterfall(sky) {
    const g = new THREE.Group();
    const top = FALLS.top + 0.02;
    const bottom = WATER - 0.2;
    const W = FALLS.width;
    const cols = 12;
    const rows = 40;
    const pos = [];
    const uvs = [];
    const idx = [];
    for (let j = 0; j <= rows; j++) {
        const v = j / rows;
        // A short lip that tips over the edge, then the drop.
        const y = top + (bottom - top) * v;
        const z = fallsZ(v);
        for (let i = 0; i <= cols; i++) {
            const u = i / cols;
            const x = FALLS.x + (u - 0.5) * W * (1 + v * 0.18);
            pos.push(x, y, z + Math.sin(u * Math.PI) * 0.12);
            uvs.push(u, 1 - v);
            if (i < cols && j < rows) {
                const k = j * (cols + 1) + i;
                idx.push(k, k + cols + 1, k + 1, k + 1, k + cols + 1, k + cols + 2);
            }
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    const u = uv();
    // Streaks: stretched noise scrolling down, plus crisp lines per column.
    const flow = mx_noise_float(
        vec3(u.x.mul(7), u.y.mul(1.6).add(time.mul(1.9)), 0.5)
    );
    // Long thin highlight streaks racing down.
    const lines = smoothstep(
        0.55,
        0.8,
        mx_noise_float(vec3(u.x.mul(22), u.y.mul(0.9).add(time.mul(2.6)), 4.0))
    );
    const white = clamp(smoothstep(0.3, 0.6, flow).mul(0.8).add(lines), 0, 1);
    // Whiter where it tips over the lip and where it hits the pool.
    const ends = smoothstep(0.88, 1.0, u.y).add(smoothstep(0.2, 0.0, u.y));
    const col = mix(
        vec3(0.22, 0.64, 1.0),
        vec3(1.0, 1.0, 1.0),
        clamp(white.add(ends), 0, 1)
    ).mul(sky.uLight.mul(0.75).add(0.3));
    m.colorNode = col;
    const edge = smoothstep(0, 0.08, u.x).mul(
        smoothstep(0, 0.08, float(1).sub(u.x))
    );
    m.opacityNode = edge.mul(mix(float(0.82), float(1), white));
    const sheet = new THREE.Mesh(geo, m);
    sheet.renderOrder = 3;
    g.add(sheet);

    // Foam skirt on the pool: a ring of churning white around the impact.
    const foamMat = new THREE.MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
    });
    const fu = uv().sub(0.5).mul(2);
    const r = fu.length();
    const churn = mx_noise_float(
        vec3(fu.x.mul(3), fu.y.mul(3), time.mul(1.4))
    );
    const ring = smoothstep(1.0, 0.55, r.add(churn.mul(0.25)));
    foamMat.colorNode = vec3(1, 1, 1).mul(sky.uLight.mul(0.7).add(0.35));
    foamMat.opacityNode = ring.mul(smoothstep(0.15, 0.55, churn.add(0.45)));
    const foam = new THREE.Mesh(
        new THREE.PlaneGeometry(W * 1.9, 3.2).rotateX(-Math.PI / 2),
        foamMat
    );
    foam.position.set(FALLS.x, WATER + 0.03, FOOT_Z + 0.9);
    foam.renderOrder = 4;
    g.add(foam);

    // Lip: a little foam bar where the channel spills over.
    const lip = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.12, W * 0.92, 4, 10).rotateZ(Math.PI / 2),
        toon(0xffffff, { emissive: 0x6a7a8a })
    );
    lip.position.set(FALLS.x, top - 0.02, LIP_Z - 0.05);
    g.add(lip);
    g.userData.foot = { x: FALLS.x, z: FOOT_Z };
    return g;
}

// ------------------------------------------------------------- sky

function createSky() {
    const uSunDir = uniform(new THREE.Vector3(0.3, 0.8, 0.2).normalize());
    const uZenith = uniform(C(0x3a8cff));
    const uHorizon = uniform(C(0xbfe8ff));
    const uSunColor = uniform(C(0xfff2c8));
    const uSunVis = uniform(1);
    const uNight = uniform(0);
    const uLight = uniform(1);
    const m = new THREE.MeshBasicNodeMaterial({
        side: THREE.BackSide,
        depthWrite: false,
    });
    const dir = normalize(positionWorld.sub(cameraPosition));
    const y = dir.y;
    let col = mix(uHorizon, uZenith, smoothstep(-0.02, 0.55, y));
    const sd = max(dot(dir, uSunDir), 0);
    col = col.add(uSunColor.mul(pow(sd, 6).mul(0.25)).mul(uSunVis));
    col = col.add(
        uSunColor.mul(smoothstep(0.9988, 0.9994, sd).mul(2.6)).mul(uSunVis)
    );
    // Moon opposite the sun, stars at night.
    const md = max(dot(dir, uSunDir.negate()), 0);
    col = col.add(
        vec3(0.9, 0.95, 1.2)
            .mul(smoothstep(0.999, 0.9994, md))
            .mul(uNight)
            .mul(1.6)
    );
    col = col.add(vec3(0.5, 0.6, 1).mul(pow(md, 30).mul(0.15)).mul(uNight));
    const su = dir.xz.div(y.add(1.25)).mul(220);
    const cell = floor(su);
    const r = hash(cell.x.add(cell.y.mul(311.7)));
    const twinkle = sin(time.mul(2).add(r.mul(40)))
        .mul(0.3)
        .add(0.7);
    const star = smoothstep(0.9965, 1, r)
        .mul(smoothstep(0.0, 0.25, y))
        .mul(twinkle)
        .mul(1.8);
    col = col.add(vec3(star).mul(uNight));
    m.colorNode = col;
    m.fog = false;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), m);
    mesh.frustumCulled = false;
    mesh.renderOrder = -10;
    return {
        mesh,
        uSunDir,
        uZenith,
        uHorizon,
        uSunColor,
        uSunVis,
        uNight,
        uLight,
    };
}

function cloud(rand) {
    const g = new THREE.Group();
    const mat = toon(0xffffff, { emissive: 0x3a4a60 });
    const n = 4 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
        const r = 4 + rand() * 5;
        const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), mat);
        s.position.set((i - n / 2) * 5 + rand() * 3, rand() * 3, rand() * 4);
        s.scale.y = 0.7;
        g.add(s);
    }
    return g;
}

// ------------------------------------------------------------- props

function rng(seed) {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

function placed(obj, x, z, yOff = 0) {
    obj.position.set(x, heightAt(x, z) + yOff, z);
    return obj;
}

function ink(mesh, w = 0.03) {
    mesh.castShadow = true;
    outline(mesh, w);
    return mesh;
}

function palm(rand) {
    const g = new THREE.Group();
    const segs = 7;
    const lean = 0.25 + rand() * 0.35;
    const height = 4.2 + rand() * 1.8;
    const trunkMats = [toon(0xb5835a), toon(0x9a6a45)];
    let top = new THREE.Vector3();
    for (let i = 0; i < segs; i++) {
        const t = i / segs;
        const r = 0.24 - t * 0.09;
        const seg = new THREE.Mesh(
            new THREE.CylinderGeometry(r * 0.92, r, height / segs + 0.04, 8),
            trunkMats[i % 2]
        );
        const y = (t + 0.5 / segs) * height;
        const x = Math.pow(t, 1.6) * lean * height * 0.45;
        seg.position.set(x, y, 0);
        seg.rotation.z = -lean * 0.45 * t * 1.6;
        ink(seg, 0.025);
        g.add(seg);
        top.set(x, y + height / segs / 2, 0);
    }
    const leafMat = toon(0x39b54a, { unique: true });
    leafMat.side = THREE.DoubleSide;
    const leafMat2 = toon(0x6fd94b, { unique: true });
    leafMat2.side = THREE.DoubleSide;
    for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + rand() * 0.3;
        const len = 2.4 + rand() * 0.6;
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.quadraticCurveTo(len * 0.5, 0.42, len, 0);
        shape.quadraticCurveTo(len * 0.5, -0.42, 0, 0);
        const geo = new THREE.ShapeGeometry(shape, 6);
        // Droop along the length.
        const p = geo.attributes.position;
        for (let k = 0; k < p.count; k++) {
            const x = p.getX(k);
            p.setZ(k, -p.getY(k));
            p.setY(k, -Math.pow(x / len, 2) * 1.3 + Math.abs(p.getY(k)) * 0.25);
        }
        geo.computeVertexNormals();
        const leaf = new THREE.Mesh(geo, i % 2 ? leafMat : leafMat2);
        leaf.position.copy(top);
        leaf.rotation.y = a;
        leaf.rotation.z = 0.25;
        leaf.castShadow = true;
        g.add(leaf);
    }
    const nut = toon(0x6b4a2a);
    for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), nut);
        c.position
            .copy(top)
            .add(
                new THREE.Vector3(
                    Math.cos(i * 2.1) * 0.22,
                    -0.18,
                    Math.sin(i * 2.1) * 0.22
                )
            );
        ink(c, 0.02);
        g.add(c);
    }
    g.rotation.y = rand() * Math.PI * 2;
    g.userData.sway = rand() * 10;
    return g;
}

/** Fruit tree: round toon canopy with fruit hanging in slots that regrow. */
function fruitTree(kind, rand) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.34, 2.4, 9),
        toon(0x9b6b44)
    );
    trunk.position.y = 1.2;
    ink(trunk, 0.03);
    g.add(trunk);
    const canopy = new THREE.Group();
    canopy.position.y = 2.9;
    const leafColor = {
        puffberry: 0x3fbf5a,
        sunpeach: 0x7ed957,
        moonplum: 0x2e9e78,
    }[kind];
    const mat = toon(leafColor);
    const blobs = [
        [0, 0.3, 0, 1.45],
        [0.9, -0.1, 0.3, 1.0],
        [-0.85, 0, -0.2, 1.05],
        [0.1, -0.2, 0.95, 0.95],
        [-0.2, 0.1, -0.9, 0.95],
    ];
    for (const [x, y, z, r] of blobs) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 3), mat);
        b.position.set(x, y, z);
        ink(b, 0.035);
        b.castShadow = true;
        canopy.add(b);
    }
    g.add(canopy);
    const fruitMat = toon(FRUITS[kind].color, {
        emissive: FRUITS[kind].color & 0x2a2a2a,
    });
    const slots = [];
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + rand();
        const p = new THREE.Vector3(
            Math.cos(a) * 1.35,
            -0.55 - rand() * 0.3,
            Math.sin(a) * 1.35
        );
        const f = new THREE.Mesh(fruitGeometry(kind), fruitMat);
        f.position.copy(p);
        ink(f, 0.02);
        canopy.add(f);
        slots.push({ mesh: f, grown: 1, at: p.clone() });
    }
    g.userData = { kind, slots, canopy, shake: 0 };
    return g;
}

const fruitGeos = {};
export function fruitGeometry(kind) {
    if (fruitGeos[kind]) return fruitGeos[kind];
    let geo;
    if (kind === "sunpeach") {
        geo = new THREE.SphereGeometry(0.2, 14, 10);
        geo.scale(1, 0.92, 1);
        const p = geo.attributes.position;
        // A soft crease down one side.
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i);
            const z = p.getZ(i);
            if (z > 0) p.setZ(i, z - Math.exp(-(x * x) / 0.003) * 0.03);
        }
    } else if (kind === "moonplum") {
        geo = new THREE.SphereGeometry(0.19, 14, 10);
        geo.scale(0.9, 1.15, 0.9);
    } else if (kind === "rainbow") {
        geo = new THREE.OctahedronGeometry(0.22, 1);
    } else {
        // Puffberry: a cluster-ish round berry with a dimple on top.
        geo = new THREE.SphereGeometry(0.19, 14, 10);
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const y = p.getY(i);
            if (y > 0.16) p.setY(i, y - (y - 0.16) * 1.6);
        }
    }
    geo.computeVertexNormals();
    fruitGeos[kind] = geo;
    return geo;
}

function rock(rand, s = 1) {
    // A rounded toon boulder: a smooth sphere pushed into a lumpy pebble
    // shape, mossy on top.
    const r = 0.55 * s;
    const geo = new THREE.SphereGeometry(r, 22, 16);
    const p = geo.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const seed = rand() * 100;
    const stone = C(rand() < 0.5 ? 0xb9b1c9 : 0xc8bfae);
    const dark = stone.clone().multiplyScalar(0.82);
    const moss = C(0x7cc552);
    const c = new THREE.Color();
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).normalize();
        const bump =
            1 +
            noise2(v.x * 1.6 + seed, v.z * 1.6 + v.y) * 0.16 +
            noise2(v.y * 3 + seed, v.x * 3) * 0.05;
        p.setXYZ(i, v.x * r * bump * 1.15, v.y * r * bump * 0.72, v.z * r * bump);
        c.copy(dark).lerp(stone, Math.min(1, Math.max(0, v.y * 0.8 + 0.6)));
        if (v.y > 0.55) c.lerp(moss, Math.min(1, (v.y - 0.55) * 2.6));
        colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true, soft: true }));
    ink(m, 0.022);
    m.receiveShadow = true;
    return m;
}

function hut() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(
        new THREE.CylinderGeometry(2.4, 2.6, 2.4, 20),
        toon(0xfff1d6)
    );
    wall.position.y = 1.2;
    ink(wall, 0.04);
    g.add(wall);
    const roof = new THREE.Mesh(
        new THREE.ConeGeometry(3.3, 2.2, 20),
        toon(0xff7a59)
    );
    roof.position.y = 3.4;
    ink(roof, 0.045);
    g.add(roof);
    const band = new THREE.Mesh(
        new THREE.CylinderGeometry(2.62, 2.62, 0.3, 20),
        toon(0xffc94a)
    );
    band.position.y = 2.25;
    g.add(band);
    const door = new THREE.Mesh(
        new THREE.CircleGeometry(0.75, 20, 0, Math.PI),
        toon(0x5a3a2a)
    );
    door.position.set(0, 0.02, 2.47);
    door.scale.y = 2.0;
    g.add(door);
    const win = new THREE.Mesh(
        new THREE.CircleGeometry(0.4, 16),
        toon(0xffe9a8, { emissive: 0x000000, unique: true })
    );
    win.position.set(1.45, 1.55, 1.95);
    win.lookAt(win.position.clone().multiplyScalar(2).setY(1.55));
    g.add(win);
    g.userData.window = win;
    const knob = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 10, 8),
        toon(0xffc94a)
    );
    knob.position.y = 4.55;
    g.add(knob);
    return g;
}

function nest() {
    const g = new THREE.Group();
    const straw = new THREE.Mesh(
        new THREE.TorusGeometry(0.75, 0.24, 8, 20),
        toon(0xe2b65c)
    );
    straw.rotation.x = Math.PI / 2;
    straw.position.y = 0.18;
    ink(straw, 0.025);
    g.add(straw);
    const bed = new THREE.Mesh(
        new THREE.CircleGeometry(0.7, 16),
        toon(0xc99a45)
    );
    bed.rotation.x = -Math.PI / 2;
    bed.position.y = 0.06;
    g.add(bed);
    return g;
}

function flag(color) {
    const geo = new THREE.PlaneGeometry(0.9, 0.55, 6, 1);
    geo.translate(0.45, 0, 0);
    const m = toon(color, { unique: true });
    m.side = THREE.DoubleSide;
    // Flutter in the vertex stage.
    const p = positionLocal;
    m.positionNode = vec3(
        p.x,
        p.y,
        p.z.add(
            sin(p.x.mul(5).sub(time.mul(6)))
                .mul(p.x)
                .mul(0.12)
        )
    );
    return new THREE.Mesh(geo, m);
}

function gateArch(label, colorA, colorB) {
    const g = new THREE.Group();
    const postMat = toon(0xffffff);
    for (const s of [-1, 1]) {
        const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.26, 4, 12),
            postMat
        );
        post.position.set(s * 2.2, 2, 0);
        ink(post);
        g.add(post);
        const cap = new THREE.Mesh(
            new THREE.SphereGeometry(0.34, 12, 10),
            toon(colorA)
        );
        cap.position.set(s * 2.2, 4.15, 0);
        ink(cap);
        g.add(cap);
        const f = flag(s < 0 ? colorA : colorB);
        f.position.set(s * 2.2, 3.7, 0);
        f.rotation.y = s < 0 ? Math.PI : 0;
        g.add(f);
    }
    const beam = new THREE.Mesh(
        new THREE.BoxGeometry(5.2, 0.8, 0.3),
        toon(colorB)
    );
    beam.position.y = 3.45;
    ink(beam, 0.035);
    g.add(beam);
    const sign = labelPlane(label, 5, 0.8, "#ffffff", "#1d1a2e");
    sign.position.set(0, 3.45, 0.17);
    g.add(sign);
    const back = sign.clone();
    back.rotation.y = Math.PI;
    back.position.z = -0.17;
    g.add(back);
    return g;
}

export function labelPlane(text, w, h, fg = "#fff", bg = null) {
    const tex = textTexture(text, { w: 512, h: Math.max(32, Math.round((512 * h) / w)), fg, bg });
    const m = new THREE.MeshBasicNodeMaterial({ map: tex, transparent: !bg });
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
}

function caveMouth() {
    const g = new THREE.Group();
    const arch = new THREE.Mesh(
        new THREE.TorusGeometry(1.9, 0.45, 10, 24, Math.PI),
        toon(0x8d6a52)
    );
    arch.position.y = 0.2;
    ink(arch, 0.04);
    g.add(arch);
    const dark = new THREE.Mesh(
        new THREE.CircleGeometry(1.9, 24, 0, Math.PI),
        new THREE.MeshBasicNodeMaterial({ color: 0x120c1a })
    );
    dark.position.set(0, 0.2, -0.3);
    g.add(dark);
    const lanternMat = toon(0xffd36b, { emissive: 0xffa53a, unique: true });
    const lanterns = [];
    for (const s of [-1, 1]) {
        const l = new THREE.Mesh(
            new THREE.SphereGeometry(0.22, 12, 10),
            lanternMat
        );
        l.position.set(s * 2.6, 1.2, 0.3);
        ink(l, 0.02);
        g.add(l);
        lanterns.push(l);
        const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6),
            toon(0x5a3a2a)
        );
        pole.position.set(s * 2.6, 0.5, 0.3);
        g.add(pole);
    }
    const sign = labelPlane("BUMP DOJO", 2.8, 0.6, "#ffffff", "#7a3bd6");
    sign.position.set(0, 2.9, 0.3);
    g.add(sign);
    g.userData.lanternMat = lanternMat;
    return g;
}

// ------------------------------------------------------------- grass & flowers

function grassField(rand, count) {
    const blade = new THREE.BufferGeometry();
    const W = 0.055;
    const H = 0.3;
    const verts = [
        -W,
        0,
        0,
        W,
        0,
        0,
        -W * 0.7,
        H * 0.45,
        0,
        W * 0.7,
        H * 0.45,
        0,
        0,
        H,
        0,
    ];
    const uvs = [0, 0, 1, 0, 0, 0.45, 1, 0.45, 0.5, 1];
    blade.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    blade.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
    blade.computeVertexNormals();
    const m = new THREE.MeshToonNodeMaterial({ side: THREE.DoubleSide });
    const h = hash(instanceIndex.toFloat());
    const tip = float(uv().y);
    m.colorNode = mix(
        mix(vec3(0.1, 0.42, 0.14), vec3(0.2, 0.55, 0.16), h),
        mix(vec3(0.42, 0.8, 0.26), vec3(0.62, 0.88, 0.3), h),
        tip
    );
    const sway = sin(
        time.mul(1.6).add(h.mul(6.28)).add(positionWorld.x.mul(0.2))
    )
        .mul(0.09)
        .add(0.04);
    m.positionNode = positionLocal.add(
        vec3(sway.mul(tip.mul(tip)), 0, sway.mul(0.5).mul(tip.mul(tip)))
    );
    const mesh = new THREE.InstancedMesh(blade, m, count);
    const d = new THREE.Object3D();
    let n = 0;
    let tries = 0;
    while (n < count && tries++ < count * 20) {
        const x = (rand() - 0.5) * 84;
        const z = (rand() - 0.5) * 84;
        const y = heightAt(x, z);
        if (y < 0.5 || slopeAt(x, z) > 0.55 || inPond(x, z)) continue;
        if (Math.hypot(x - HUT.x, z - HUT.z) < 3) continue;
        d.position.set(x, y - 0.02, z);
        d.rotation.set(0, rand() * Math.PI, 0);
        const s = 0.7 + rand() * 0.6;
        d.scale.set(s, s * (0.8 + rand() * 0.5), s);
        d.updateMatrix();
        mesh.setMatrixAt(n++, d.matrix);
    }
    mesh.count = n;
    mesh.receiveShadow = true;
    return mesh;
}

function flowers(rand, count) {
    const shape = new THREE.Shape();
    for (let i = 0; i <= 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const b = a + Math.PI / 5;
        if (i === 0) shape.moveTo(Math.cos(a) * 0.16, Math.sin(a) * 0.16);
        else
            shape.quadraticCurveTo(
                Math.cos(a - Math.PI / 5) * 0.03,
                Math.sin(a - Math.PI / 5) * 0.03,
                Math.cos(a) * 0.16,
                Math.sin(a) * 0.16
            );
        void b;
    }
    const petals = new THREE.ShapeGeometry(shape, 4);
    petals.rotateX(-Math.PI / 2);
    petals.translate(0, 0.2, 0);
    const pm = new THREE.MeshToonNodeMaterial({ side: THREE.DoubleSide });
    // Over 1000 slots so three keeps the matrices in an attribute: a uniform
    // block that big breaks WebGL 2's 16 KB limit.
    const slots = Math.max(count, 1024);
    const mesh = new THREE.InstancedMesh(petals, pm, slots);
    const centers = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.05, 8, 6).translate(0, 0.21, 0),
        toon(0xffd23f),
        slots
    );
    const colors = [0xff6fa8, 0xffffff, 0xffd23f, 0xa07bff, 0xff8a4a];
    const d = new THREE.Object3D();
    let n = 0;
    let tries = 0;
    while (n < count && tries++ < count * 30) {
        const x = (rand() - 0.5) * 80;
        const z = (rand() - 0.5) * 80;
        const y = heightAt(x, z);
        if (y < 0.55 || slopeAt(x, z) > 0.5 || inPond(x, z)) continue;
        // Clumps.
        if (noise2(x * 0.2 + 9, z * 0.2) < 0.1) continue;
        d.position.set(x, y, z);
        d.rotation.y = rand() * 6;
        d.scale.setScalar(0.8 + rand() * 0.6);
        d.updateMatrix();
        mesh.setMatrixAt(n, d.matrix);
        centers.setMatrixAt(n, d.matrix);
        mesh.setColorAt(n, C(colors[Math.floor(rand() * colors.length)]));
        n++;
    }
    mesh.count = centers.count = n;
    const g = new THREE.Group();
    g.add(mesh, centers);
    return g;
}

// ------------------------------------------------------------- build

export function createWorld(scene) {
    const rand = rng(424242);
    const world = {
        scene,
        trees: [],
        palms: [],
        colliders: [],
        clouds: [],
        timeOfDay: 0.35,
    };

    const sky = createSky();
    world.sky = sky;
    scene.add(sky.mesh);

    const hemi = new THREE.HemisphereLight(0xcfeaff, 0x7fbf6a, 1.4);
    const sun = new THREE.DirectionalLight(0xfff1d0, 2.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -34;
    sun.shadow.camera.right = sun.shadow.camera.top = 34;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 160;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
    // Softer, lighter shadows that still read under the toon ramp.
    sun.shadow.intensity = 0.55;
    sun.shadow.radius = 3;
    scene.add(hemi, sun, sun.target);
    world.hemi = hemi;
    world.sun = sun;

    // Ground.
    scene.add(terrainPatch(0, -2, 112, 230));
    scene.add(terrainPatch(RACE_ISLE.x, RACE_ISLE.z, 76, 90));
    scene.add(terrainPatch(DOJO_ISLE.x, DOJO_ISLE.z, 60, 70));
    const seabed = new THREE.Mesh(
        new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2),
        toon(0x2a6fb0)
    );
    seabed.position.y = -4.6;
    scene.add(seabed);

    // Water.
    const depthTex = depthTexture();
    const sea = new THREE.Mesh(
        new THREE.PlaneGeometry(1600, 1600, 1, 1).rotateX(-Math.PI / 2),
        waterMaterial(WATER, depthTex, sky)
    );
    sea.position.y = WATER;
    sea.renderOrder = 2;
    scene.add(sea);
    const upper = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 12).rotateX(-Math.PI / 2),
        waterMaterial(UPPER_WATER, depthTex, sky)
    );
    upper.position.set(0, UPPER_WATER, -26.5);
    upper.renderOrder = 2;
    scene.add(upper);
    world.falls = waterfall(sky);
    scene.add(world.falls);

    // Distant islands for depth.
    for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.4;
        const d = 260 + rand() * 120;
        const isle = new THREE.Mesh(
            new THREE.SphereGeometry(
                20 + rand() * 25,
                16,
                10,
                0,
                Math.PI * 2,
                0,
                Math.PI / 2
            ),
            toon(i % 2 ? 0x58b86a : 0x6fc779)
        );
        isle.scale.y = 0.35 + rand() * 0.4;
        isle.position.set(Math.cos(a) * d, -2, Math.sin(a) * d);
        scene.add(isle);
    }

    // Clouds.
    for (let i = 0; i < 14; i++) {
        const c = cloud(rand);
        const a = rand() * Math.PI * 2;
        const d = 110 + rand() * 180;
        c.position.set(Math.cos(a) * d, 38 + rand() * 30, Math.sin(a) * d);
        c.userData = { a, d, speed: 0.004 + rand() * 0.006 };
        c.lookAt(0, c.position.y, 0);
        world.clouds.push(c);
        scene.add(c);
    }

    // Palms around the beach.
    for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2 + rand() * 0.3;
        if (a > 3.6 && a < 5.9) continue; // north side is the cliff
        const r = 31 + rand() * 4;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (Math.hypot(x - RACE_GATE.x, z - RACE_GATE.z) < 5) continue;
        const p = placed(palm(rand), x, z, -0.1);
        world.palms.push(p);
        world.colliders.push({ x, z, r: 0.45 });
        scene.add(p);
    }
    // A couple on the plateau and the islets.
    for (const [x, z] of [
        [-14, -31],
        [15, -29],
        [RACE_ISLE.x - 20, 22],
        [RACE_ISLE.x + 22, -20],
        [DOJO_ISLE.x - 12, 12],
        [DOJO_ISLE.x + 14, -9],
    ]) {
        const p = placed(palm(rand), x, z, -0.1);
        world.palms.push(p);
        scene.add(p);
    }

    // Fruit trees.
    for (const [kind, x, z] of [
        ["puffberry", 8, -1],
        ["sunpeach", -9, 3],
        ["moonplum", 15, 15],
        ["puffberry", -13, -7],
        ["sunpeach", 21, -6],
        ["moonplum", -4, 23],
    ]) {
        const t = placed(fruitTree(kind, rand), x, z, -0.05);
        t.userData.x = x;
        t.userData.z = z;
        world.trees.push(t);
        world.colliders.push({ x, z, r: 0.55 });
        scene.add(t);
    }

    // Rocks.
    for (let i = 0; i < 26; i++) {
        const a = rand() * Math.PI * 2;
        const r = 6 + rand() * 30;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const h = heightAt(x, z);
        if (
            h < -0.5 ||
            (inPond(x, z) && rand() < 0.5) ||
            Math.hypot(x, z - 11) < 6
        )
            continue;
        const s = 0.5 + rand() * 1.1;
        const m = placed(rock(rand, s), x, z, 0.05);
        m.rotation.y = rand() * 6;
        if (s > 0.9) world.colliders.push({ x, z, r: 0.5 * s });
        scene.add(m);
    }
    // Stepping stones across the pond's shallow edge.
    for (let i = 0; i < 5; i++) {
        const x = POND.x + 6.5 + i * 0.2;
        const z = POND.z - 4 + i * 1.6;
        const s = new THREE.Mesh(
            new THREE.CylinderGeometry(0.55, 0.65, 0.4, 10),
            toon(0xd8d2e0)
        );
        s.position.set(x, WATER + 0.05, z);
        ink(s, 0.02);
        scene.add(s);
    }

    // Hut and nest.
    const h = placed(hut(), HUT.x, HUT.z, -0.05);
    h.rotation.y = Math.atan2(-HUT.x, -HUT.z) * 0.6;
    world.hut = h;
    world.colliders.push({ x: HUT.x, z: HUT.z, r: 2.8 });
    scene.add(h);
    world.nest = placed(nest(), NEST.x, NEST.z, 0);
    scene.add(world.nest);

    // Race gate on the east beach, dojo in the cliff cave.
    const gate = placed(
        gateArch("BLOOM DASH", 0xff5f7e, 0x2f7bff),
        RACE_GATE.x,
        RACE_GATE.z,
        -0.05
    );
    gate.rotation.y = -Math.PI / 2 + 0.2;
    world.gate = gate;
    scene.add(gate);
    world.colliders.push({
        x: RACE_GATE.x + 0.4,
        z: RACE_GATE.z - 2.1,
        r: 0.35,
    });
    world.colliders.push({
        x: RACE_GATE.x - 0.4,
        z: RACE_GATE.z + 2.1,
        r: 0.35,
    });
    const cave = placed(caveMouth(), CAVE.x, CAVE.z + 0.6, 0);
    cave.position.y = Math.max(cave.position.y, 0.9);
    world.cave = cave;
    scene.add(cave);

    // Grass and flowers.
    scene.add(grassField(rand, 9000));
    scene.add(flowers(rand, 420));

    // Solid things the garden camera pulls in front of.
    world.cameraBlockers = [...world.trees, h, gate];
    // Lanterns and window glow switch on at night.
    world.nightMats = [cave.userData.lanternMat, h.userData.window.material];
    return world;
}

// ------------------------------------------------------------- update

const sunCol = new THREE.Color();
const tmp = new THREE.Color();
const KEYS = [
    // t, zenith, horizon, sun color, sun intensity, hemi intensity, light mult
    [0.0, 0x0b1440, 0x2a3a78, 0x8aa0ff, 0.35, 0.4, 0.42],
    [0.22, 0x0b1440, 0x2a3a78, 0x8aa0ff, 0.35, 0.4, 0.42],
    [0.27, 0x5a6fd8, 0xffa98a, 0xffb27a, 1.2, 0.7, 0.8],
    [0.34, 0x2f86ff, 0xa9e2ff, 0xfff2c8, 2.0, 0.85, 1],
    [0.66, 0x2f86ff, 0xb3e6ff, 0xfff2c8, 2.0, 0.85, 1],
    [0.74, 0x6a5fd0, 0xffa07a, 0xff9a5a, 1.3, 0.7, 0.85],
    [0.79, 0x0b1440, 0x2a3a78, 0x8aa0ff, 0.35, 0.4, 0.42],
    [1.0, 0x0b1440, 0x2a3a78, 0x8aa0ff, 0.35, 0.4, 0.42],
];

export function isNight(world) {
    return world.timeOfDay < 0.25 || world.timeOfDay > 0.77;
}

export function updateWorld(world, dt, focus) {
    const t = world.timeOfDay;
    let k = 0;
    while (k < KEYS.length - 2 && KEYS[k + 1][0] <= t) k++;
    const a = KEYS[k];
    const b = KEYS[k + 1];
    const u = Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0] || 1)));
    const sky = world.sky;
    sky.uZenith.value.set(a[1]).lerp(tmp.set(b[1]), u);
    sky.uHorizon.value.set(a[2]).lerp(tmp.set(b[2]), u);
    sunCol.set(a[3]).lerp(tmp.set(b[3]), u);
    sky.uSunColor.value.copy(sunCol);
    const light = a[6] + (b[6] - a[6]) * u;
    sky.uLight.value = light;
    // The sun arcs across the day; at night the "sun" light is the moon.
    const ang = (t - 0.25) * Math.PI * 2;
    const dir = new THREE.Vector3(
        Math.cos(ang) * 0.8,
        Math.sin(ang),
        0.45
    ).normalize();
    const night = isNight(world);
    sky.uNight.value = Math.max(0, Math.min(1, -dir.y * 4 + 0.2));
    sky.uSunVis.value = Math.max(0, Math.min(1, dir.y * 6 + 0.3));
    sky.uSunDir.value.copy(dir);
    const lightDir = dir.y > 0.05 ? dir : dir.clone().negate();
    world.sun.color.copy(sunCol);
    world.sun.intensity = a[4] + (b[4] - a[4]) * u;
    world.hemi.intensity = a[5] + (b[5] - a[5]) * u;
    world.hemi.color.copy(sky.uHorizon.value).lerp(tmp.set(0xffffff), 0.3);
    // Snap the shadow frustum to whole shadow texels so edges don't crawl.
    const texel = 68 / 2048;
    const fx = Math.round(focus.x / texel) * texel;
    const fz = Math.round(focus.z / texel) * texel;
    world.sun.position.set(
        fx + lightDir.x * 70,
        Math.max(12, lightDir.y * 70),
        fz + lightDir.z * 70
    );
    world.sun.target.position.set(fx, 0, fz);
    if (world.scene.fog) world.scene.fog.color.copy(sky.uHorizon.value);
    for (const m of world.nightMats) {
        if (!m.emissive) continue;
        m.emissive.setHex(night ? 0xffb347 : 0x000000);
    }

    const now = performance.now() / 1000;
    for (const c of world.clouds) {
        c.userData.a += c.userData.speed * dt;
        c.position.x = Math.cos(c.userData.a) * c.userData.d;
        c.position.z = Math.sin(c.userData.a) * c.userData.d;
    }
    for (const p of world.palms)
        p.rotation.z = Math.sin(now * 0.9 + p.userData.sway) * 0.02;
    for (const tree of world.trees) {
        const d = tree.userData;
        if (d.shake > 0) {
            d.shake = Math.max(0, d.shake - dt);
            d.canopy.rotation.z = Math.sin(d.shake * 40) * d.shake * 0.25;
            d.canopy.rotation.x = Math.cos(d.shake * 33) * d.shake * 0.15;
        }
        for (const s of d.slots) {
            if (s.grown < 1) {
                s.grown = Math.min(1, s.grown + dt / 40);
                s.mesh.scale.setScalar(Math.max(0.001, s.grown));
            }
        }
    }
}

/** Shake a tree: ripe fruit falls. Returns world positions + kinds. */
export function shakeTree(tree) {
    const d = tree.userData;
    d.shake = 0.8;
    const out = [];
    const v = new THREE.Vector3();
    for (const s of d.slots) {
        if (s.grown < 1) continue;
        s.grown = 0;
        s.mesh.scale.setScalar(0.001);
        s.mesh.getWorldPosition(v);
        // One in twelve is a rare prism fruit.
        out.push({
            kind: Math.random() < 0.08 ? "rainbow" : d.kind,
            x: v.x,
            y: v.y,
            z: v.z,
        });
    }
    return out;
}
