import * as THREE from "three/webgpu";
import {
    cameraPosition,
    clamp,
    float,
    modelWorldMatrix,
    normalLocal,
    positionLocal,
    vec4,
} from "three/tsl";

// Shared toon look: a three-band ramp, and an inverted-hull outline shell.
// Node materials throughout, so the WebGPU renderer never has to convert.

let ramp = null;
export function toonRamp() {
    if (ramp) return ramp;
    const data = new Uint8Array([
        90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255,
    ]);
    ramp = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    ramp.minFilter = THREE.NearestFilter;
    ramp.magFilter = THREE.NearestFilter;
    ramp.generateMipmaps = false;
    ramp.needsUpdate = true;
    return ramp;
}

// Ground and big soft shapes: a smooth ramp (linear between four steps), so
// gentle terrain undulation doesn't break into hard blotches.
let soft = null;
export function softRamp() {
    if (soft) return soft;
    const data = new Uint8Array([
        150, 150, 160, 255, 190, 190, 196, 255, 232, 232, 236, 255, 255, 255,
        255, 255,
    ]);
    soft = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
    soft.minFilter = soft.magFilter = THREE.LinearFilter;
    soft.generateMipmaps = false;
    soft.needsUpdate = true;
    return soft;
}

const toonCache = new Map();
export function toon(color, opts = {}) {
    const key = `${color}|${opts.emissive || 0}|${
        opts.map ? opts.map.uuid : ""
    }|${opts.transparent ? 1 : 0}|${opts.vertexColors ? 1 : 0}|${
        opts.soft ? 1 : 0
    }`;
    if (!opts.unique && toonCache.has(key)) return toonCache.get(key);
    const m = new THREE.MeshToonNodeMaterial({
        color,
        gradientMap: opts.soft ? softRamp() : toonRamp(),
        emissive: opts.emissive || 0x000000,
        map: opts.map || null,
        transparent: !!opts.transparent,
        vertexColors: !!opts.vertexColors,
    });
    if (!opts.unique) toonCache.set(key, m);
    return m;
}

const outlineCache = new Map();
export function outlineMaterial(width = 0.018, color = 0x1d1a2e) {
    const key = `${width}|${color}`;
    if (outlineCache.has(key)) return outlineCache.get(key);
    const m = new THREE.MeshBasicNodeMaterial({
        color,
        side: THREE.BackSide,
    });
    // Push the shell out along the normal; thicker with distance from the
    // camera so the ink line keeps a similar on-screen weight.
    // Per vertex, so big props don't get fat lines up close.
    const at = modelWorldMatrix.mul(vec4(positionLocal, 1)).xyz;
    const grow = clamp(cameraPosition.distance(at).mul(0.09), 0.25, 2.0);
    m.positionNode = positionLocal.add(
        normalLocal.normalize().mul(float(width).mul(grow))
    );
    m.fog = true;
    outlineCache.set(key, m);
    return m;
}

/** Add an outline shell sharing the mesh's geometry. */
export function outline(mesh, width, color) {
    const shell = new THREE.Mesh(mesh.geometry, outlineMaterial(width, color));
    shell.name = "outline";
    shell.castShadow = false;
    shell.receiveShadow = false;
    mesh.add(shell);
    return shell;
}
