import * as THREE from "three/webgpu";
import {
    Fn,
    abs,
    atan,
    attribute,
    clamp,
    color,
    cos,
    float,
    fract,
    instancedBufferAttribute,
    max,
    mix,
    select,
    sin,
    smoothstep,
    transformNormalToView,
    uniform,
    vec3,
} from "three/tsl";
import { STANDS, TEAM_COLORS, rowHeight, standLayout } from "./arena.js";

// The crowd: one draw call for every spectator in the bowl. Each one is a
// little standing figure (body, head, two arms) placed by a per-instance
// pose; the vertex shader makes them sway, jump, throw their arms up and
// ride a stadium wave. Each team's end cheers on its own uniform.

const SKIN = [0xf1c7a5, 0xd9a27a, 0xa86f48, 0x7a4a2c, 0x5a3520].map((c) => new THREE.Color(c));

function personGeometry() {
    const parts = [];
    const add = (geo, part) => {
        const g = geo.toNonIndexed();
        g.setAttribute("part", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(part), 1));
        parts.push(g);
    };
    const body = new THREE.CylinderGeometry(0.17, 0.2, 1.3, 6, 1);
    body.translate(0, 0.65, 0);
    add(body, 0);
    const head = new THREE.IcosahedronGeometry(0.135, 0);
    head.translate(0, 1.5, 0);
    add(head, 1);
    for (const s of [-1, 1]) {
        const arm = new THREE.BoxGeometry(0.09, 0.56, 0.09);
        arm.translate(s * 0.24, 1.3 - 0.28, 0);
        add(arm, 2);
    }
    const count = parts.reduce((n, g) => n + g.attributes.position.count, 0);
    const out = new THREE.BufferGeometry();
    for (const [name, size] of [
        ["position", 3],
        ["normal", 3],
        ["part", 1],
    ]) {
        const arr = new Float32Array(count * size);
        let o = 0;
        for (const g of parts) {
            arr.set(g.attributes[name].array, o);
            o += g.attributes[name].array.length;
        }
        out.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    return out;
}

export function createCrowd(time) {
    const seats = [];
    let s = 12345;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (const seg of standLayout()) {
        for (let i = 0; i < STANDS.rows; i++) {
            const d = i * STANDS.rowDepth + STANDS.rowDepth * 0.45;
            // Seats along the row.
            const N = 600;
            let acc = 0;
            let prev = null;
            for (let k = 0; k <= N; k++) {
                const t = seg.t0 + ((seg.t1 - seg.t0) * k) / N;
                const c = Math.cos(t);
                const sn = Math.sin(t);
                const nx = c / STANDS.a;
                const nz = sn / STANDS.b;
                const nl = Math.hypot(nx, nz);
                const x = STANDS.a * c + (nx / nl) * d;
                const z = STANDS.b * sn + (nz / nl) * d;
                if (prev) acc += Math.hypot(x - prev.x, z - prev.z);
                prev = { x, z };
                if (acc < 0.62) continue;
                acc = 0;
                if (r() < 0.1) continue;
                // Face the middle of the pitch, more or less.
                const yaw = Math.atan2(-nx / nl, -nz / nl) + (r() - 0.5) * 0.5;
                // Fans wear their end's colour; some neutral.
                const team = r() < 0.82 ? seg.team : 1 - seg.team;
                const neutral = r() < 0.22;
                seats.push({ x: x + (r() - 0.5) * 0.12, y: rowHeight(i), z, yaw, team, neutral, seed: r() });
            }
        }
    }
    const n = seats.length;
    const pose = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    const tint = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    const meta = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2);
    const c = new THREE.Color();
    const neutrals = [0xf2efe6, 0x2c2f3a, 0xe6c86a, 0x6b4f9a, 0x3f7a4a].map((h) => new THREE.Color(h));
    seats.forEach((p, i) => {
        const sc = 0.9 + p.seed * 0.22;
        pose.setXYZW(i, p.x, p.y, p.z, p.yaw);
        c.copy(p.neutral ? neutrals[Math.floor(p.seed * 997) % neutrals.length] : TEAM_COLORS[p.team]);
        c.offsetHSL(0, -0.1 + p.seed * 0.2, -0.08 + ((p.seed * 13) % 1) * 0.16);
        tint.setXYZ(i, c.r, c.g, c.b);
        meta.setXY(i, p.seed + sc * 0, p.team);
    });

    const cheer = [uniform(0), uniform(0)];
    const waveAngle = uniform(0);
    const waveOn = uniform(0);
    const P = instancedBufferAttribute(pose);
    const M = instancedBufferAttribute(meta);
    const T = instancedBufferAttribute(tint);
    const seed = M.x;
    const team = M.y;
    const yaw = P.w;
    const angle = atan(P.z.div(STANDS.b), P.x.div(STANDS.a));
    const wave = smoothstep(0.82, 1.0, cos(angle.sub(waveAngle))).mul(waveOn);
    const loud = mix(cheer[0], cheer[1], team);
    const excite = max(loud.mul(seed.mul(0.6).add(0.55)), wave);
    const rotY = (v) => vec3(v.x.mul(cos(yaw)).add(v.z.mul(sin(yaw))), v.y, v.x.negate().mul(sin(yaw)).add(v.z.mul(cos(yaw))));

    const mat = new THREE.MeshLambertNodeMaterial();
    mat.positionNode = Fn(() => {
        const p = attribute("position", "vec3");
        const part = attribute("part", "float");
        const hop = abs(sin(time.mul(float(8.5).add(seed.mul(3))).add(seed.mul(40)))).mul(0.3).mul(excite);
        const sway = sin(time.mul(1.4).add(seed.mul(30))).mul(0.025);
        // Arms: from hanging to overhead, with a flail when cheering.
        const side = select(p.x.greaterThan(0), float(1), float(-1));
        const raise = clamp(excite.mul(1.5), 0, 1).mul(2.7).add(sin(time.mul(11).add(seed.mul(17))).mul(0.35).mul(excite));
        const phi = raise.mul(side);
        const dx = p.x.sub(side.mul(0.24));
        const dy = p.y.sub(1.3);
        const arm = vec3(side.mul(0.24).add(dx.mul(cos(phi))).sub(dy.mul(sin(phi))), float(1.3).add(dx.mul(sin(phi))).add(dy.mul(cos(phi))), p.z);
        const local = select(part.greaterThan(1.5), arm, p);
        const bob = vec3(sway.mul(local.y), hop.add(sway.mul(0.3)), 0);
        return rotY(local.add(bob)).add(P.xyz);
    })();
    mat.normalNode = transformNormalToView(rotY(attribute("normal", "vec3")));
    mat.colorNode = Fn(() => {
        const part = attribute("part", "float");
        const p = attribute("position", "vec3");
        const k = fract(seed.mul(7.13));
        const skin = mix(mix(color(SKIN[0]), color(SKIN[2]), smoothstep(0, 0.5, k)), color(SKIN[4]), smoothstep(0.5, 1, k));
        const pants = mix(color(0x2a2c35), color(0x4a3b2c), fract(seed.mul(3.7)));
        const body = select(p.y.lessThan(0.62), pants, T);
        return select(part.greaterThan(0.5).and(part.lessThan(1.5)), skin, select(part.greaterThan(1.5), mix(T, skin, step01(p.y, 0.8)), body));
    })();
    const mesh = new THREE.Mesh(personGeometry(), mat);
    mesh.count = n;
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    return {
        mesh,
        count: n,
        cheer,
        waveAngle,
        waveOn,
        /** Drive the noise: a team's roar fades; the wave rolls when it's quiet. */
        update(dt, state) {
            for (let i = 0; i < 2; i++) {
                const target = state.roar[i];
                cheer[i].value += (target - cheer[i].value) * Math.min(1, dt * (target > cheer[i].value ? 8 : 1.2));
            }
            waveOn.value += ((state.wave ? 1 : 0) - waveOn.value) * Math.min(1, dt * 0.8);
            waveAngle.value = (waveAngle.value + dt * 1.15) % (Math.PI * 2);
        },
    };
}

/** Hands are skin: the bottom of the arm. */
const step01 = (y, edge) => smoothstep(edge + 0.06, edge - 0.06, y);
