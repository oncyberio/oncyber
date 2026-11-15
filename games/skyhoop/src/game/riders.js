import * as THREE from "three/webgpu";
import { color, mix, positionLocal, smoothstep, step, uv, fract } from "three/tsl";
import { TEAM_COLORS, TEAM_DEEP } from "./arena.js";

// Riders, all fourteen in one set of instanced parts: broom handle,
// bristles, binding, torso, head, helmet, arms, thighs, shins, and the
// strikers' bats. A rider's whole-body matrix (position, heading, pitch,
// bank, stun spin) multiplies each part's local matrix every frame.

const ROLE_HELMET = {
    runner: null,
    keeper: new THREE.Color(0xf6f1e4),
    striker: new THREE.Color(0x2b2a33),
    finder: new THREE.Color(0xf2c24a),
};
const SKIN = [0xf1c7a5, 0xd9a27a, 0xb07a52, 0x7f5032].map((c) => new THREE.Color(c));

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3(1, 1, 1);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/** A local matrix for a capsule (length along Y) spanning a to b. */
function limb(a, b, radius) {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const mid = A.clone().add(B).multiplyScalar(0.5);
    const dir = B.clone().sub(A);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return { m: new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)), len, radius };
}
const at = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

// Limbs: each kind is one capsule shape shared by every rider (left, right).
const pair = (a, b, r) => {
    const mirror = (v) => [-v[0], v[1], v[2]];
    return { a: limb(a, b, r), b: limb(mirror(a), mirror(b), r), r };
};
const ARM = pair([0.2, 0.62, 0.22], [0.08, 0.07, 0.68], 0.055);
const THIGH = pair([0.12, 0.05, 0.02], [0.22, -0.2, 0.36], 0.075);
const SHIN = pair([0.22, -0.2, 0.36], [0.17, -0.58, 0.12], 0.058);
function limbGeo(kind) {
    const len = kind.a.len;
    return new THREE.CapsuleGeometry(kind.r, Math.max(0.01, len - kind.r * 2), 4, 10);
}

export function createRiders(count) {
    const group = new THREE.Group();
    const wood = new THREE.MeshStandardNodeMaterial({ roughness: 0.42, metalness: 0 });
    // Polished handle with a spiral grain.
    const grain = fract(positionLocal.y.mul(9).add(positionLocal.x.mul(30)));
    wood.colorNode = mix(color(0x5a3418), color(0x8a5428), smoothstep(0.2, 0.8, grain));
    const straw = new THREE.MeshStandardNodeMaterial({ roughness: 0.9 });
    const strands = fract(uv().x.mul(48));
    straw.colorNode = mix(color(0xb88a3a), color(0xe6c06a), strands).mul(smoothstep(0.0, 0.35, uv().y).mul(0.35).add(0.65));
    const brass = new THREE.MeshStandardNodeMaterial({ color: 0xd9a441, roughness: 0.25, metalness: 1 });
    const cloth = new THREE.MeshStandardNodeMaterial({ roughness: 0.62 });
    // A stripe across the jersey's chest.
    cloth.colorNode = mix(color(0xffffff), color(0xf0e6d0), step(0.62, uv().y).mul(step(uv().y, 0.72)));
    const pants = new THREE.MeshStandardNodeMaterial({ color: 0xe9e2d2, roughness: 0.7 });
    const boots = new THREE.MeshStandardNodeMaterial({ color: 0x3a2618, roughness: 0.55 });
    const skin = new THREE.MeshStandardNodeMaterial({ roughness: 0.55 });
    const helmet = new THREE.MeshStandardNodeMaterial({ roughness: 0.3, metalness: 0.2 });
    const goggles = new THREE.MeshStandardNodeMaterial({ color: 0x1b2a3a, roughness: 0.05, metalness: 0.6 });

    const handleGeo = new THREE.CylinderGeometry(0.042, 0.05, 2.4, 10);
    handleGeo.rotateX(Math.PI / 2);
    const bristleGeo = new THREE.CylinderGeometry(0.07, 0.27, 0.95, 18, 1, true);
    bristleGeo.rotateX(-Math.PI / 2);
    const bindGeo = new THREE.TorusGeometry(0.085, 0.028, 8, 18);
    const torsoGeo = new THREE.CapsuleGeometry(0.17, 0.36, 4, 12);
    const headGeo = new THREE.SphereGeometry(0.135, 16, 12);
    const helmGeo = new THREE.SphereGeometry(0.155, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const goggleGeo = new THREE.TorusGeometry(0.15, 0.03, 6, 20, Math.PI * 0.7);
    const bootGeo = new THREE.BoxGeometry(0.11, 0.1, 0.24);
    const batGeo = new THREE.CylinderGeometry(0.035, 0.07, 0.75, 10);
    batGeo.translate(0, 0.38, 0);

    const make = (geo, mat, n = count, cast = true) => {
        const m = new THREE.InstancedMesh(geo, mat, n);
        m.castShadow = cast;
        m.receiveShadow = true;
        m.frustumCulled = false;
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        group.add(m);
        return m;
    };
    const parts = {
        handle: make(handleGeo, wood),
        bristles: make(bristleGeo, straw),
        bind: make(bindGeo, brass),
        torso: make(torsoGeo, cloth),
        head: make(headGeo, skin),
        helmet: make(helmGeo, helmet),
        goggles: make(goggleGeo, goggles, count, false),
        arms: make(limbGeo(ARM), cloth, count * 2),
        thighs: make(limbGeo(THIGH), pants, count * 2),
        shins: make(limbGeo(SHIN), boots, count * 2),
        boots: make(bootGeo, boots, count * 2),
        bat: make(batGeo, wood, count),
    };
    // Local layout, in the rider's frame (seat at the origin, facing +Z).
    const L = {
        handle: at(0, 0, 0.32),
        bristles: at(0, 0, -1.25),
        bind: at(0, 0, -0.8),
        torso: at(0, 0.42, 0.06, 0.55),
        head: at(0, 0.83, 0.3),
        helmet: at(0, 0.86, 0.29, -0.2),
        goggles: at(0, 0.85, 0.33, 0, 0, Math.PI * 0.15),
        arms: [ARM.a, ARM.b].map((x) => x.m),
        thighs: [THIGH.a, THIGH.b].map((x) => x.m),
        shins: [SHIN.a, SHIN.b].map((x) => x.m),
        boots: [at(0.17, -0.62, 0.2), at(-0.17, -0.62, 0.2)],
    };
    const hidden = new Set();
    return {
        group,
        parts,
        /** Colour everyone once the teams are known. */
        paint(riders) {
            const c = new THREE.Color();
            riders.forEach((r, i) => {
                const team = TEAM_COLORS[r.team];
                parts.torso.setColorAt(i, team);
                parts.arms.setColorAt(i * 2, team);
                parts.arms.setColorAt(i * 2 + 1, team);
                parts.helmet.setColorAt(i, ROLE_HELMET[r.role] || TEAM_DEEP[r.team]);
                parts.head.setColorAt(i, SKIN[(i * 7) % SKIN.length]);
                c.copy(TEAM_DEEP[r.team]).lerp(new THREE.Color(0xf3ead8), 0.75);
                parts.thighs.setColorAt(i * 2, c);
                parts.thighs.setColorAt(i * 2 + 1, c);
            });
            for (const k of ["torso", "arms", "helmet", "head", "thighs"]) parts[k].instanceColor.needsUpdate = true;
        },
        /** Hide a rider's body (the player's VRM stands in); keep the broom. */
        hideBody(i, on) {
            if (on) hidden.add(i);
            else hidden.delete(i);
        },
        /** World matrix of rider i, computed by update(). */
        matrices: Array.from({ length: count }, () => new THREE.Matrix4()),
        update(riders, time) {
            riders.forEach((r, i) => {
                const W = this.matrices[i];
                riderMatrix(r, W);
                const body = !hidden.has(i);
                const set = (mesh, idx, local) => {
                    if (!local) return mesh.setMatrixAt(idx, ZERO);
                    tmpM.multiplyMatrices(W, local);
                    mesh.setMatrixAt(idx, tmpM);
                };
                set(parts.handle, i, L.handle);
                set(parts.bristles, i, L.bristles);
                set(parts.bind, i, L.bind);
                set(parts.torso, i, body && L.torso);
                set(parts.head, i, body && L.head);
                set(parts.helmet, i, body && L.helmet);
                set(parts.goggles, i, body && r.role === "finder" ? L.goggles : null);
                for (let s = 0; s < 2; s++) {
                    set(parts.arms, i * 2 + s, body && (r.role === "striker" && s === 0 ? armSwing(r, time) : L.arms[s]));
                    set(parts.thighs, i * 2 + s, body && L.thighs[s]);
                    set(parts.shins, i * 2 + s, body && L.shins[s]);
                    set(parts.boots, i * 2 + s, body && L.boots[s]);
                }
                set(parts.bat, i, r.role === "striker" ? batMatrix(r) : null);
            });
            for (const k in parts) parts[k].instanceMatrix.needsUpdate = true;
        },
    };
}

/** Rider frame: heading from fwd, pitch, bank and the stun spin. */
export function riderMatrix(r, out) {
    const f = r.fwd;
    const yaw = Math.atan2(f.x, f.z);
    const pitch = -Math.asin(Math.max(-1, Math.min(1, f.y)));
    const rollSpin = r.roll > 0 ? (1 - r.roll / 0.55) * Math.PI * 2 * r.rollDir : 0;
    tmpE.set(pitch * 0.85, yaw + r.spin, r.bank + rollSpin, "YXZ");
    tmpQ.setFromEuler(tmpE);
    // A gentle hover bob.
    tmpV.set(r.pos.x, r.pos.y + Math.sin(r.id * 1.7 + performanceNow() * 2.1) * 0.06, r.pos.z);
    return out.compose(tmpV, tmpQ, tmpS);
}

let clock = 0;
const performanceNow = () => clock;
export const setRiderClock = (t) => (clock = t);

function armSwing(r) {
    // The bat arm, raised to the side and swung across on a swat.
    const k = r.swing > 0 ? 1 - r.swing / 0.3 : 0;
    const a = -1.1 + k * 2.4;
    tmpE.set(a * 0.6, 0, -0.9 + k * 0.8);
    tmpQ.setFromEuler(tmpE);
    // Pivot at the shoulder: rotate the rest arm around it.
    const shoulder = new THREE.Vector3(0.2, 0.62, 0.22);
    const pivot = new THREE.Matrix4().makeTranslation(shoulder.x, shoulder.y, shoulder.z);
    const back = new THREE.Matrix4().makeTranslation(-shoulder.x, -shoulder.y, -shoulder.z);
    return pivot.multiply(new THREE.Matrix4().makeRotationFromQuaternion(tmpQ)).multiply(back).multiply(ARM.a.m);
}
function batMatrix(r) {
    const k = r.swing > 0 ? 1 - r.swing / 0.3 : 0;
    const swing = -1.2 + k * 3.2;
    return at(0.44, 0.58, 0.32, swing, 0.4, -0.9 + k * 1.4);
}
