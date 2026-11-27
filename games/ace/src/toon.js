import * as THREE from "three";

// Shared toon look: a three-band ramp, and an inverted-hull outline shell.

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

const toonCache = new Map();
export function toon(color, opts = {}) {
    const key = `${color}|${opts.emissive || 0}|${
        opts.map ? opts.map.uuid : ""
    }|${opts.transparent ? 1 : 0}`;
    if (!opts.unique && toonCache.has(key)) return toonCache.get(key);
    const m = new THREE.MeshToonMaterial({
        color,
        gradientMap: toonRamp(),
        emissive: opts.emissive || 0x000000,
        map: opts.map || null,
        transparent: !!opts.transparent,
    });
    if (!opts.unique) toonCache.set(key, m);
    return m;
}

const outlineCache = new Map();
export function outlineMaterial(width = 0.018, color = 0x1d1a2e) {
    const key = `${width}|${color}`;
    if (outlineCache.has(key)) return outlineCache.get(key);
    const m = new THREE.ShaderMaterial({
        uniforms: {
            width: { value: width },
            color: { value: new THREE.Color(color) },
        },
        vertexShader: /* glsl */ `
      uniform float width;
      void main() {
        vec3 n = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // Constant-ish screen thickness: grow with distance a little.
        float w = width * clamp(-mv.z * 0.12, 0.6, 2.2);
        mv.xyz += n * w;
        gl_Position = projectionMatrix * mv;
      }`,
        fragmentShader: /* glsl */ `
      uniform vec3 color;
      void main() { gl_FragColor = vec4(color, 1.0); }`,
        side: THREE.BackSide,
    });
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
