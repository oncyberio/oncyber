import * as THREE from "three/webgpu";
import { color, float, instancedBufferAttribute, length, max, pow, smoothstep, uv } from "three/tsl";

// Particles: two pools of camera-facing sprites drawn as one instanced
// mesh each. "glow" adds light (broom trails, Comet embers, Wisp
// sparkles, goal fireworks); "puff" is blended (Bolt smoke, confetti,
// straw, dust). Simulated on the CPU in flat typed arrays.

function pool(capacity, additive) {
    const pos = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    const col = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    const size = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    for (const a of [pos, col, size]) a.setUsage(THREE.DynamicDrawUsage);
    const mat = new THREE.SpriteNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    mat.positionNode = instancedBufferAttribute(pos);
    mat.scaleNode = instancedBufferAttribute(size);
    const c = instancedBufferAttribute(col);
    const d = length(uv().sub(0.5)).mul(2);
    const soft = additive ? pow(max(float(1).sub(d), 0), float(1.6)) : smoothstep(1.0, 0.55, d);
    mat.colorNode = c.rgb.mul(additive ? soft.mul(c.a) : float(1));
    mat.opacityNode = additive ? float(1) : soft.mul(c.a);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.count = capacity;
    mesh.frustumCulled = false;
    mesh.renderOrder = additive ? 6 : 4;
    const P = {
        mesh,
        capacity,
        next: 0,
        p: pos.array,
        c: col.array,
        s: size.array,
        v: new Float32Array(capacity * 3),
        life: new Float32Array(capacity),
        max: new Float32Array(capacity),
        s0: new Float32Array(capacity),
        s1: new Float32Array(capacity),
        a0: new Float32Array(capacity),
        drag: new Float32Array(capacity),
        grav: new Float32Array(capacity),
        attrs: [pos, col, size],
    };
    return P;
}

function spawn(P, x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, drag = 1, grav = 0) {
    const i = P.next;
    P.next = (P.next + 1) % P.capacity;
    P.p[i * 3] = x;
    P.p[i * 3 + 1] = y;
    P.p[i * 3 + 2] = z;
    P.v[i * 3] = vx;
    P.v[i * 3 + 1] = vy;
    P.v[i * 3 + 2] = vz;
    P.life[i] = life;
    P.max[i] = life;
    P.s0[i] = s0;
    P.s1[i] = s1;
    P.c[i * 4] = r;
    P.c[i * 4 + 1] = g;
    P.c[i * 4 + 2] = b;
    P.a0[i] = a;
    P.drag[i] = drag;
    P.grav[i] = grav;
}

function step(P, dt) {
    for (let i = 0; i < P.capacity; i++) {
        if (P.life[i] <= 0) {
            P.s[i] = 0;
            continue;
        }
        P.life[i] -= dt;
        const k = Math.max(0, P.life[i] / P.max[i]);
        const dr = Math.exp(-P.drag[i] * dt);
        P.v[i * 3] *= dr;
        P.v[i * 3 + 1] = P.v[i * 3 + 1] * dr - P.grav[i] * dt;
        P.v[i * 3 + 2] *= dr;
        P.p[i * 3] += P.v[i * 3] * dt;
        P.p[i * 3 + 1] += P.v[i * 3 + 1] * dt;
        P.p[i * 3 + 2] += P.v[i * 3 + 2] * dt;
        P.s[i] = P.life[i] > 0 ? P.s1[i] + (P.s0[i] - P.s1[i]) * k : 0;
        // Fade in fast, out slow.
        P.c[i * 4 + 3] = P.a0[i] * Math.min(1, (1 - k) * 12) * k;
    }
    for (const a of P.attrs) a.needsUpdate = true;
}

const R = Math.random;
const TEAM = [
    [1.0, 0.42, 0.14],
    [0.12, 0.85, 0.95],
];

export function createFx() {
    const glow = pool(9000, true);
    const puff = pool(3000, false);
    const group = new THREE.Group();
    group.add(glow.mesh, puff.mesh);
    const fx = {
        group,
        /** A rider's broom trail: a stream of team-coloured motes off the bristles. */
        trail(x, y, z, vx, vy, vz, team, boost, player) {
            const [r, g, b] = TEAM[team];
            const k = boost ? 2.2 : 1;
            spawn(glow, x + (R() - 0.5) * 0.25, y + (R() - 0.5) * 0.25, z + (R() - 0.5) * 0.25, vx * 0.1 + (R() - 0.5), vy * 0.1 + (R() - 0.5), vz * 0.1 + (R() - 0.5), 0.5 + R() * 0.4, (player ? 0.5 : 0.42) * k, 0.05, r * 1.6, g * 1.6, b * 1.6, 0.8, 2.5);
        },
        comet(x, y, z, heat) {
            if (heat < 0.15) return;
            spawn(glow, x + (R() - 0.5) * 0.4, y + (R() - 0.5) * 0.4, z + (R() - 0.5) * 0.4, (R() - 0.5) * 2, R() * 1.5, (R() - 0.5) * 2, 0.35 + R() * 0.4, 0.5 * heat + 0.2, 0.05, 2.4, 0.9, 0.3, heat, 1.5, -1);
            if (R() < heat * 0.5) spawn(puff, x, y, z, (R() - 0.5), R() * 1.2, (R() - 0.5), 1.1, 0.4, 1.6, 0.35, 0.32, 0.3, 0.25 * heat, 0.8, -0.4);
        },
        boltSmoke(x, y, z) {
            spawn(puff, x + (R() - 0.5) * 0.3, y, z + (R() - 0.5) * 0.3, (R() - 0.5) * 0.6, R() * 0.6, (R() - 0.5) * 0.6, 0.8, 0.35, 1.3, 0.18, 0.17, 0.18, 0.35, 1, -0.3);
        },
        wisp(x, y, z) {
            for (let i = 0; i < 2; i++)
                spawn(glow, x + (R() - 0.5) * 0.3, y + (R() - 0.5) * 0.3, z + (R() - 0.5) * 0.3, (R() - 0.5) * 2, (R() - 0.5) * 2, (R() - 0.5) * 2, 0.5 + R() * 0.5, 0.22, 0.02, 3, 2.4, 1.2, 1, 2, 1.2);
        },
        /** Sparks off a bat or a Bolt hit. */
        sparks(x, y, z, n = 40, hot = [3, 1.6, 0.6], speed = 14) {
            for (let i = 0; i < n; i++) {
                const a = R() * Math.PI * 2;
                const e = Math.acos(2 * R() - 1);
                const s = speed * (0.3 + R() * 0.7);
                spawn(glow, x, y, z, Math.sin(e) * Math.cos(a) * s, Math.cos(e) * s, Math.sin(e) * Math.sin(a) * s, 0.25 + R() * 0.35, 0.22, 0.03, hot[0], hot[1], hot[2], 1, 3.5, 9);
            }
        },
        smoke(x, y, z, n = 16) {
            for (let i = 0; i < n; i++) spawn(puff, x, y, z, (R() - 0.5) * 5, (R() - 0.5) * 5, (R() - 0.5) * 5, 1 + R(), 0.6, 2.6, 0.22, 0.2, 0.22, 0.5, 2, -0.5);
        },
        straw(x, y, z, n = 14) {
            for (let i = 0; i < n; i++) spawn(puff, x, y, z, (R() - 0.5) * 6, R() * 4, (R() - 0.5) * 6, 1.2 + R(), 0.12, 0.08, 0.85, 0.66, 0.3, 1, 1.2, 6);
        },
        /** A goal: a ring of team fire through the hoop, then fireworks overhead. */
        goal(x, y, z, team, side) {
            const [r, g, b] = TEAM[team];
            for (let i = 0; i < 160; i++) {
                const a = (i / 160) * Math.PI * 2;
                const s = 9 + R() * 6;
                spawn(glow, x, y + Math.cos(a) * 2.2, z + Math.sin(a) * 2.2, side * (4 + R() * 6), Math.cos(a) * s, Math.sin(a) * s, 0.8 + R() * 0.6, 0.5, 0.05, r * 3, g * 3, b * 3, 1, 1.8, 2);
            }
            for (let k = 0; k < 5; k++) fx.firework(x - side * (6 + R() * 30), y + 18 + R() * 18, z + (R() - 0.5) * 50, team, 0.25 * k);
            for (let i = 0; i < 260; i++) {
                const palette = [TEAM[team], [1, 1, 0.92], [1, 0.82, 0.3]][i % 3];
                spawn(puff, x - side * (R() * 25), y + 8 + R() * 14, z + (R() - 0.5) * 30, (R() - 0.5) * 6, R() * 3, (R() - 0.5) * 6, 3 + R() * 2.5, 0.22, 0.2, palette[0], palette[1], palette[2], 1, 1.4, 1.6);
            }
        },
        pendingWorks: [],
        firework(x, y, z, team, delay = 0) {
            fx.pendingWorks.push({ x, y, z, team, t: delay });
        },
        /** The Wisp caught: a burst of gold that hangs and falls. */
        catchBurst(x, y, z) {
            for (let i = 0; i < 400; i++) {
                const a = R() * Math.PI * 2;
                const e = Math.acos(2 * R() - 1);
                const s = 4 + R() * 18;
                spawn(glow, x, y, z, Math.sin(e) * Math.cos(a) * s, Math.cos(e) * s, Math.sin(e) * Math.sin(a) * s, 1.2 + R() * 1.4, 0.35, 0.04, 3.2, 2.4, 1.0, 1, 1.2, 2.5);
            }
        },
        update(dt) {
            for (let i = fx.pendingWorks.length - 1; i >= 0; i--) {
                const w = fx.pendingWorks[i];
                w.t -= dt;
                if (w.t > 0) continue;
                fx.pendingWorks.splice(i, 1);
                const [r, g, b] = R() < 0.6 ? TEAM[w.team] : [1, 0.85, 0.45];
                for (let k = 0; k < 140; k++) {
                    const a = R() * Math.PI * 2;
                    const e = Math.acos(2 * R() - 1);
                    const s = 10 + R() * 3;
                    spawn(glow, w.x, w.y, w.z, Math.sin(e) * Math.cos(a) * s, Math.cos(e) * s, Math.sin(e) * Math.sin(a) * s, 1.1 + R() * 0.6, 0.45, 0.06, r * 4, g * 4, b * 4, 1, 1.6, 4);
                }
            }
            step(glow, dt);
            step(puff, dt);
        },
    };
    return fx;
}

void color;
