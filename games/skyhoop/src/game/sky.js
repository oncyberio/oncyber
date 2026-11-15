import * as THREE from "three/webgpu";
import {
    cameraPosition,
    clamp,
    color,
    dot,
    exp,
    float,
    max,
    mix,
    mx_fractal_noise_float,
    normalize,
    positionWorld,
    pow,
    smoothstep,
    uniform,
    vec2,
    vec3,
} from "three/tsl";

// A late-afternoon sky in one shader: a deep zenith over a warm, hazy
// horizon, a hot sun disk (bright enough to bloom), and two layers of
// drifting cumulus lit from the sun's side. It also bakes the scene's
// reflection environment, so the metal hoops and wet-looking brooms pick up
// the same sky.

export const SUN_DIR = new THREE.Vector3(-0.55, 0.34, 0.76).normalize();
export const SUN_COLOR = new THREE.Color(1.0, 0.86, 0.68);
export const HORIZON = new THREE.Color(0.86, 0.85, 0.82);

export function skyMaterial(time = uniform(0)) {
    const mat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
    const dir = normalize(positionWorld.sub(cameraPosition));
    const sun = vec3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z);
    const h = dir.y;
    const mu = max(dot(dir, sun), 0);
    const zenith = color(0x2a64c8);
    const mid = color(0x6fa3e0);
    const horizon = color(HORIZON);
    const warm = color(0xffb27a);
    let sky = mix(horizon, mid, smoothstep(0.0, 0.18, h));
    sky = mix(sky, zenith, smoothstep(0.15, 0.85, h));
    // Warm scattering toward the sun, strongest at the horizon.
    sky = mix(sky, warm, pow(mu, float(6)).mul(0.55).mul(exp(h.abs().mul(-3.5))));
    // Below the horizon: a pale haze so the far hills melt into it.
    sky = mix(sky, color(0xa9b7b9), smoothstep(0.0, -0.08, h));
    // Clouds on a plane above the arena.
    const ray = clamp(h, 0.02, 1);
    const uv = dir.xz.div(ray.add(0.12)).mul(0.55);
    const drift = vec2(time.mul(0.004), time.mul(0.0016));
    const n1 = mx_fractal_noise_float(vec3(uv.add(drift), 0.0), 5, 2.03, 0.5);
    const n2 = mx_fractal_noise_float(vec3(uv.mul(2.3).sub(drift.mul(1.7)), 4.0), 3, 2.1, 0.55);
    const density = smoothstep(0.08, 0.55, n1.add(n2.mul(0.35)));
    const fade = smoothstep(0.01, 0.16, h).mul(smoothstep(1.0, 0.45, h).mul(0.4).add(0.6));
    const cover = density.mul(fade).mul(0.92);
    const lit = mix(color(0x8f9bb5), color(0xfff3e6), clamp(n1.mul(-1.4).add(0.9), 0, 1));
    const rim = pow(mu, float(10)).mul(1.6);
    const cloud = lit.add(color(0xffc890).mul(rim));
    sky = mix(sky, cloud, cover);
    // The sun: a hot disk plus a soft halo. HDR so the bloom catches it.
    const disk = smoothstep(0.99955, 0.9998, mu).mul(float(1).sub(cover.mul(0.9)));
    const halo = pow(mu, float(380)).mul(3).add(pow(mu, float(42)).mul(0.35));
    sky = sky.add(color(SUN_COLOR).mul(disk.mul(42).add(halo)));
    mat.colorNode = sky;
    return mat;
}

export function createSky(time) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(2400, 48, 24), skyMaterial(time));
    mesh.frustumCulled = false;
    mesh.renderOrder = -10;
    return mesh;
}

/** Bake the sky into a PMREM for image-based light; null if the backend can't. */
export async function bakeEnvironment(renderer) {
    try {
        const envScene = new THREE.Scene();
        const mesh = createSky(uniform(0));
        mesh.scale.setScalar(0.03);
        envScene.add(mesh);
        // A dark ground hemisphere so reflections aren't lit from below.
        const ground = new THREE.Mesh(
            new THREE.SphereGeometry(60, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
            new THREE.MeshBasicNodeMaterial({ color: 0x3c4a2a, side: THREE.BackSide })
        );
        ground.position.y = -1;
        envScene.add(ground);
        const pmrem = new THREE.PMREMGenerator(renderer);
        const target = await pmrem.fromSceneAsync(envScene, 0.02, 0.1, 200);
        pmrem.dispose();
        return target.texture;
    } catch (err) {
        console.warn("[skyhoop] environment bake failed", err?.message || err);
        return null;
    }
}
