// Scenery: 24 different node materials (24 shader programs) over 4 shapes,
// plus an instanced forest. This is the part that is slow to build and compile.
import { color, mix, normalWorld, positionLocal, sin, float } from "three/tsl";

function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function buildProps(THREE, count, seed, kinds = 24) {
    const r = rng(seed);
    const geometries = [new THREE.BoxGeometry(1, 1, 1), new THREE.SphereGeometry(0.6, 24, 16), new THREE.ConeGeometry(0.6, 1.4, 20), new THREE.TorusGeometry(0.5, 0.2, 12, 32)];
    const materials = [];
    for (let i = 0; i < kinds; i++) {
        const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.3 + (i % 5) * 0.12, metalness: (i % 3) * 0.3 });
        const a = color(new THREE.Color().setHSL(i / kinds, 0.7, 0.5)), b = color(new THREE.Color().setHSL((i / kinds + 0.3) % 1, 0.6, 0.4));
        // Each material gets a structurally different graph, so each is its own program.
        let wave = sin(positionLocal.y.mul(float(3 + i))).mul(0.5).add(0.5);
        for (let k = 0; k < i % 6; k++) wave = wave.mul(sin(positionLocal.x.mul(float(1 + k))).mul(0.25).add(0.75));
        m.colorNode = i % 2 ? mix(a, b, wave) : mix(a, b, normalWorld.y.mul(float(0.5 + i * 0.01)).add(0.5).mul(wave));
        materials.push(m);
    }
    const items = [];
    for (let i = 0; i < count; i++) {
        const ang = r() * Math.PI * 2, rad = 6 + r() * 60;
        items.push({ g: i % 4, m: i % kinds, p: [Math.cos(ang) * rad, 0.6 + r(), Math.sin(ang) * rad], s: 0.6 + r() * 1.4, r: r() * 6.28 });
    }
    return { geometries, materials, items };
}

export function buildTrees(THREE, count, seed) {
    const r = rng(seed + 1);
    const geometry = new THREE.ConeGeometry(0.8, 3, 7);
    const material = new THREE.MeshStandardNodeMaterial({ color: 0x2f6b3a, roughness: 0.9 });
    const matrices = new Float32Array(count * 16);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
        const ang = r() * Math.PI * 2, rad = 20 + r() * 95;
        p.set(Math.cos(ang) * rad, 1.5, Math.sin(ang) * rad);
        s.setScalar(0.7 + r() * 1.2);
        m.compose(p, q, s).toArray(matrices, i * 16);
    }
    return { geometry, material, matrices };
}
