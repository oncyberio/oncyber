import * as THREE from "three/webgpu";
import { blobTexture } from "./text.js";
import {
    abs,
    atan,
    clamp,
    cos,
    exp,
    float,
    Fn,
    If,
    instancedArray,
    instanceIndex,
    length,
    max,
    min,
    pow,
    select,
    smoothstep,
    uniform,
    uv,
    vec2,
} from "three/tsl";

// Juice: GPU particles (sparkles, hearts, splashes, pollen, fireflies) and
// blob shadows.

const MAX_PARTICLES = 3072;
export const SHAPE = { dot: 0, star: 1, sparkle: 2, heart: 3 };

/**
 * State lives in storage buffers advanced by a compute pass each frame; an
 * emit writes one ring slot and only the slots written this frame upload.
 * Rendering is one instanced sprite draw reading the same buffers.
 */
function particleSystem() {
    // pos.xyz + life, vel.xyz + size, rgb + alpha, gravity/drag/grow/shape,
    // max life + floor height.
    const pos = instancedArray(MAX_PARTICLES, "vec4");
    const vel = instancedArray(MAX_PARTICLES, "vec4");
    const col = instancedArray(MAX_PARTICLES, "vec4");
    const par = instancedArray(MAX_PARTICLES, "vec4");
    const meta = instancedArray(MAX_PARTICLES, "vec2");
    const uDt = uniform(0);

    const step = Fn(() => {
        const p = pos.element(instanceIndex);
        const v = vel.element(instanceIndex);
        const q = par.element(instanceIndex);
        const m = meta.element(instanceIndex);
        If(p.w.greaterThan(0), () => {
            const k = exp(q.y.negate().mul(uDt));
            v.x.assign(v.x.mul(k));
            v.z.assign(v.z.mul(k));
            v.y.assign(v.y.mul(k).add(q.x.mul(uDt)));
            p.x.addAssign(v.x.mul(uDt));
            p.y.addAssign(v.y.mul(uDt));
            p.z.addAssign(v.z.mul(uDt));
            If(p.y.lessThan(m.y), () => {
                p.y.assign(m.y);
                v.y.assign(abs(v.y).mul(0.3));
            });
            p.w.subAssign(uDt);
        });
    })().compute(MAX_PARTICLES);

    const mat = new THREE.SpriteNodeMaterial({
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        fog: false,
    });
    const P = pos.toAttribute();
    const V = vel.toAttribute();
    const Cc = col.toAttribute();
    const Q = par.toAttribute();
    const M = meta.toAttribute();
    const life = P.w;
    const t = clamp(life.div(max(M.x, 1e-4)), 0, 1);
    mat.positionNode = P.xyz;
    mat.scaleNode = V.w
        .mul(float(1).add(Q.z.mul(float(1).sub(t))))
        .mul(select(life.greaterThan(0), float(1), float(0)));
    const c = uv().mul(2).sub(1);
    const r = length(c);
    const dot = float(1).sub(smoothstep(0.6, 1.0, r));
    const k = pow(abs(cos(atan(c.y, c.x).mul(2.5))), 2)
        .mul(0.45)
        .add(0.55);
    const star = float(1).sub(smoothstep(k.mul(0.85), k, r));
    const sparkle = float(1).sub(
        smoothstep(0.55, 1.0, min(abs(c.x), abs(c.y)).mul(4).add(r.mul(0.9)))
    );
    // Heart: (x²+y²-1)³ - x²y³ < 0.
    const hp = vec2(c.x.mul(1.25), c.y.mul(1.3).add(0.28));
    const hq = hp.x.mul(hp.x).add(hp.y.mul(hp.y)).sub(1);
    const hf = hq
        .mul(hq)
        .mul(hq)
        .sub(hp.x.mul(hp.x).mul(hp.y).mul(hp.y).mul(hp.y));
    const heart = float(1).sub(smoothstep(-0.04, 0.04, hf));
    const shape = select(
        Q.w.greaterThan(2.5),
        heart,
        select(
            Q.w.greaterThan(1.5),
            sparkle,
            select(Q.w.greaterThan(0.5), star, dot)
        )
    );
    mat.colorNode = Cc.rgb;
    mat.opacityNode = Cc.a.mul(min(1, t.mul(3))).mul(shape);
    mat.alphaTest = 0.01;
    const sprite = new THREE.Sprite(mat);
    sprite.count = MAX_PARTICLES;
    sprite.frustumCulled = false;
    sprite.renderOrder = 5;
    return {
        sprite,
        step,
        buffers: [pos, vel, col, par, meta].map((n) => n.value),
        uDt,
        cursor: 0,
        dirtyFrom: -1,
        dirtyCount: 0,
    };
}

export function createFx(scene, renderer) {
    const particles = particleSystem();
    scene.add(particles.sprite);
    const shadowTex = blobTexture(64);
    const shadowMat = new THREE.MeshBasicNodeMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
    });
    return { renderer, scene, particles, time: 0, shadowMat, ambient: 0 };
}

export function blobShadow(fx, size = 0.5) {
    const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2),
        fx.shadowMat
    );
    m.renderOrder = 1;
    fx.scene.add(m);
    return m;
}

const color = new THREE.Color();
export function emit(fx, p) {
    const ps = fx.particles;
    const slot = ps.cursor;
    ps.cursor = (ps.cursor + 1) % MAX_PARTICLES;
    if (ps.dirtyFrom < 0) ps.dirtyFrom = slot;
    ps.dirtyCount = Math.min(MAX_PARTICLES, ps.dirtyCount + 1);
    const [pos, vel, col, par, meta] = ps.buffers;
    const life = p.life || 0.6;
    color.setHex(p.color ?? 0xffffff);
    const i = slot * 4;
    pos.array.set([p.x, p.y, p.z, life], i);
    vel.array.set([p.vx || 0, p.vy || 0, p.vz || 0, p.size || 0.2], i);
    col.array.set(
        [
            color.r * (p.glow || 1),
            color.g * (p.glow || 1),
            color.b * (p.glow || 1),
            p.alpha ?? 1,
        ],
        i
    );
    par.array.set(
        [p.gravity ?? 0, p.drag ?? 2, p.grow ?? -0.5, p.shape || 0],
        i
    );
    meta.array.set([life, p.floor ?? -50], slot * 2);
}

function flushEmits(ps) {
    if (ps.dirtyFrom < 0) return;
    const from = ps.dirtyFrom;
    const count = ps.dirtyCount;
    const head = Math.min(count, MAX_PARTICLES - from);
    for (const a of ps.buffers) {
        const k = a.itemSize;
        a.clearUpdateRanges();
        a.addUpdateRange(from * k, head * k);
        if (count > head) a.addUpdateRange(0, (count - head) * k);
        a.needsUpdate = true;
    }
    ps.dirtyFrom = -1;
    ps.dirtyCount = 0;
}

const R = (a = 1) => (Math.random() - 0.5) * 2 * a;

export function hearts(fx, at, n = 5) {
    for (let i = 0; i < n; i++)
        emit(fx, {
            x: at.x + R(0.15),
            y: at.y + R(0.1),
            z: at.z + R(0.15),
            vx: R(0.5),
            vy: 1 + Math.random() * 0.8,
            vz: R(0.5),
            size: 0.16 + Math.random() * 0.1,
            life: 1.2 + Math.random() * 0.5,
            color: Math.random() < 0.7 ? 0xff5f9e : 0xff9ac4,
            glow: 1.6,
            gravity: -0.4,
            drag: 1.5,
            grow: 0.3,
            shape: SHAPE.heart,
        });
}

export function sparkles(fx, at, tint = 0xfff1a8, n = 12, spread = 0.4) {
    for (let i = 0; i < n; i++)
        emit(fx, {
            x: at.x + R(spread),
            y: at.y + R(spread),
            z: at.z + R(spread),
            vx: R(1.2),
            vy: Math.random() * 1.6,
            vz: R(1.2),
            size: 0.12 + Math.random() * 0.12,
            life: 0.6 + Math.random() * 0.6,
            color: tint,
            glow: 2.2,
            gravity: -0.5,
            drag: 2.5,
            grow: -0.6,
            shape: Math.random() < 0.5 ? SHAPE.sparkle : SHAPE.star,
        });
}

export function burst(fx, at, colors, n = 30, speed = 3) {
    for (let i = 0; i < n; i++)
        emit(fx, {
            x: at.x,
            y: at.y,
            z: at.z,
            vx: R(speed),
            vy: Math.random() * speed * 1.2,
            vz: R(speed),
            size: 0.14 + Math.random() * 0.12,
            life: 0.9 + Math.random() * 0.6,
            color: colors[i % colors.length],
            glow: 1.8,
            gravity: -5,
            drag: 1.2,
            grow: -0.3,
            shape: i % 3 === 0 ? SHAPE.star : SHAPE.dot,
            floor: at.floor ?? -50,
        });
}

export function splash(fx, at, n = 18) {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 0.8 + Math.random() * 1.6;
        emit(fx, {
            x: at.x,
            y: at.y + 0.05,
            z: at.z,
            vx: Math.cos(a) * s,
            vy: 2 + Math.random() * 2.5,
            vz: Math.sin(a) * s,
            size: 0.09 + Math.random() * 0.08,
            life: 0.7,
            color: 0xe8fbff,
            glow: 1.2,
            gravity: -9,
            drag: 0.6,
            grow: -0.4,
            shape: SHAPE.dot,
            floor: at.y - 0.1,
        });
    }
}

export function dust(fx, at, n = 6) {
    for (let i = 0; i < n; i++)
        emit(fx, {
            x: at.x + R(0.2),
            y: at.y + 0.05,
            z: at.z + R(0.2),
            vx: R(0.6),
            vy: 0.4 + Math.random() * 0.5,
            vz: R(0.6),
            size: 0.18 + Math.random() * 0.12,
            life: 0.6,
            color: 0xf3ead2,
            alpha: 0.7,
            gravity: 0,
            drag: 3,
            grow: 1.2,
            shape: SHAPE.dot,
        });
}

export function tears(fx, at) {
    for (const s of [-1, 1])
        emit(fx, {
            x: at.x + s * 0.1,
            y: at.y,
            z: at.z,
            vx: s * 1.2,
            vy: 1.2,
            vz: 0,
            size: 0.07,
            life: 0.6,
            color: 0x7fd6ff,
            glow: 1.3,
            gravity: -7,
            drag: 0.4,
            grow: 0,
            shape: SHAPE.dot,
            floor: at.floor ?? -50,
        });
}

/** Mist where the falls meet the pond, pollen by day and fireflies at night. */
export function ambient(fx, dt, { falls, night, focus }) {
    fx.ambient += dt;
    while (fx.ambient > 0.03) {
        fx.ambient -= 0.03;
        emit(fx, {
            x: falls.x + R(1.6),
            y: 0.15,
            z: falls.z + 0.6 + Math.random() * 0.8,
            vx: R(0.4),
            vy: 0.6 + Math.random() * 0.9,
            vz: 0.4 + Math.random() * 0.6,
            size: 0.35 + Math.random() * 0.35,
            life: 1.3,
            color: 0xffffff,
            alpha: 0.45,
            gravity: 0.1,
            drag: 1.2,
            grow: 1.5,
            shape: SHAPE.dot,
        });
        if (Math.random() < 0.35) {
            const a = Math.random() * Math.PI * 2;
            const d = 3 + Math.random() * 20;
            emit(fx, {
                x: focus.x + Math.cos(a) * d,
                y: focus.y + 0.4 + Math.random() * 2.2,
                z: focus.z + Math.sin(a) * d,
                vx: R(0.25),
                vy: R(0.12),
                vz: R(0.25),
                size: night ? 0.09 : 0.06,
                life: 3 + Math.random() * 2,
                color: night ? 0xd8ff6a : 0xfff7d6,
                glow: night ? 3 : 1.2,
                alpha: night ? 1 : 0.7,
                gravity: 0,
                drag: 0.2,
                grow: 0,
                shape: night ? SHAPE.dot : SHAPE.sparkle,
            });
        }
    }
}

export function updateFx(fx, dt) {
    fx.time += dt;
    const ps = fx.particles;
    flushEmits(ps);
    if (dt > 0) {
        ps.uDt.value = dt;
        fx.renderer.compute(ps.step);
    }
}
