import * as THREE from "three";
import { NodeMaterial } from "three/webgpu";
import { texture, uniform } from "three/tsl";
import { createWorldReflectorReveal } from "./worldReflectorReveal";
import { createWorldCubeReveal } from "./worldCubeReveal";
import {
    clearWorldTransitionCache,
    rememberWorldTransition,
    takeWorldTransition,
} from "./worldTransitionCache";

/** factory/reflector/mesh.js: a node material whose `tDiffuse` is the TSL
 * reflector() node and whose `opacity` drives its opacityNode. */
function reflector(opacity = 0.4) {
    const material = new NodeMaterial();
    material.transparent = true;
    (material as any).defines = {};
    const uniforms = {
        opacity: uniform(opacity),
        tDiffuse: texture(new THREE.Texture()),
    };
    (material as any).uniforms = uniforms;
    material.opacityNode = uniforms.opacity;
    const source = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), material);
    Object.assign(source, { isReflector: true });
    source.onBeforeRender = jest.fn();
    return source as THREE.Mesh<THREE.PlaneGeometry, any>;
}

test("native reflection fades smoothly during the last 35% without a final-frame opacity jump", () => {
    const source = reflector();
    const effect = createWorldReflectorReveal({ sources: [source] });
    expect(effect.supportedSources).toEqual([source]);
    expect(effect.stats.sources).toBe(1);
    expect(source.visible).toBe(false);
    expect(source.material.uniforms.opacity.value).toBe(0);
    effect.setProgress(0.65);
    expect(effect.stats.opacity).toBe(0);
    expect(source.visible).toBe(false);
    effect.setProgress(0.825);
    expect(effect.stats.opacity).toBeCloseTo(0.5);
    expect(source.visible).toBe(true);
    expect(source.material.uniforms.opacity.value).toBeCloseTo(0.2);
    effect.setProgress(0.999);
    expect(source.material.uniforms.opacity.value).toBeCloseTo(0.4, 4);
    effect.setProgress(1);
    expect(effect.stats.opacity).toBe(1);
    expect(source.material.uniforms.opacity.value).toBe(0.4);
    effect.dispose();
    expect(source.material.uniforms.opacity.value).toBe(0.4);
});

test("departure fades the reflection in the first 30% and holds it hidden", () => {
    const source = reflector(0.6);
    const effect = createWorldReflectorReveal({
        sources: [source],
        mode: "dissolve",
    });
    expect(source.visible).toBe(true);
    expect(source.material.uniforms.opacity.value).toBe(0.6);
    effect.setProgress(0.15);
    expect(effect.stats.opacity).toBeCloseTo(0.5);
    expect(source.material.uniforms.opacity.value).toBeCloseTo(0.3);
    for (const progress of [0.3, 0.75, 1]) {
        effect.setProgress(progress);
        expect(source.visible).toBe(false);
        expect(source.material.uniforms.opacity.value).toBe(0);
    }
    effect.dispose();
    expect(source.visible).toBe(true);
    expect(source.material.uniforms.opacity.value).toBe(0.6);
});

test.each(["reveal", "dissolve"] as const)(
    "%s preserves hidden sources, native hooks and original resource ownership",
    (mode) => {
        const source = reflector(0.23);
        source.visible = false;
        const material = source.material;
        const geometry = source.geometry;
        const uniforms = material.uniforms;
        const texture = uniforms.tDiffuse.value;
        const hook = source.onBeforeRender;
        const disposeMaterial = jest.spyOn(material, "dispose");
        const disposeGeometry = jest.spyOn(geometry, "dispose");
        const disposeTexture = jest.spyOn(texture, "dispose");
        const effect = createWorldReflectorReveal({
            sources: [source, source],
            mode,
        });
        expect(effect.stats.sources).toBe(1);
        for (const progress of [0, 0.2, 0.7, 0.85, 1]) {
            effect.setProgress(progress);
            expect(source.visible).toBe(false);
        }
        effect.dispose();
        effect.dispose();
        effect.setProgress(0.8);
        expect(source.visible).toBe(false);
        expect(source.material).toBe(material);
        expect(source.geometry).toBe(geometry);
        expect(material.uniforms).toBe(uniforms);
        expect(uniforms.tDiffuse.value).toBe(texture);
        expect(material.opacityNode).toBe(uniforms.opacity);
        expect(uniforms.opacity.value).toBe(0.23);
        expect(source.onBeforeRender).toBe(hook);
        expect(material.transparent).toBe(true);
        expect(material.depthWrite).toBe(true);
        expect(disposeMaterial).not.toHaveBeenCalled();
        expect(disposeGeometry).not.toHaveBeenCalled();
        expect(disposeTexture).not.toHaveBeenCalled();
    }
);

test("cancelling an active fade restores the exact authored opacity and visibility", () => {
    const source = reflector(0.17);
    source.material.depthWrite = false;
    const effect = createWorldReflectorReveal({ sources: [source] });
    effect.setProgress(0.8);
    expect(source.material.uniforms.opacity.value).toBeLessThan(0.17);
    effect.dispose();
    expect(source.material.uniforms.opacity.value).toBe(0.17);
    expect(source.material.depthWrite).toBe(false);
    expect(source.visible).toBe(true);
});

test("only native reflectors with the supported opacity path are claimed", () => {
    const ordinary = reflector();
    Object.assign(ordinary, { isReflector: false });
    const city = reflector();
    city.material.defines.CYBER_CITY = "";
    const opaque = reflector();
    opaque.material.transparent = false;
    const invalid = reflector();
    invalid.material.uniforms.opacity.value = NaN;
    // WebGPURenderer cannot draw the legacy GLSL reflector.
    const legacy = reflector();
    legacy.material = new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
            opacity: { value: 0.4 },
            tDiffuse: { value: new THREE.Texture() },
            textureMatrix: { value: new THREE.Matrix4() },
        },
    });
    const noTexture = reflector();
    noTexture.material.uniforms.tDiffuse.value = null;
    const multiple = reflector();
    (multiple as THREE.Mesh).material = [multiple.material];
    const sources = [
        ordinary,
        city,
        opaque,
        invalid,
        legacy,
        noTexture,
        multiple,
    ];
    const effect = createWorldReflectorReveal({ sources });
    expect(effect.supportedSources).toEqual([]);
    expect(effect.stats.sources).toBe(0);
    effect.setProgress(0.8);
    effect.dispose();
    expect(sources.every((source) => source.visible)).toBe(true);
    expect(city.material.uniforms.opacity.value).toBe(0.4);
});

test("reflection can render beside assembling floor tiles without being hidden by their render hook", () => {
    const scene = new THREE.Scene();
    const room = new THREE.Group();
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 4),
        new THREE.MeshBasicMaterial()
    );
    const reflection = reflector();
    room.add(floor, reflection);
    scene.add(room);
    const reflectors = createWorldReflectorReveal({ sources: [reflection] });
    const supported = new Set(reflectors.supportedSources);
    const tiles = createWorldCubeReveal(THREE, [room], {
        scene,
        anchor: { x: 0, y: 0, z: 0 },
        exclude: (source) => supported.has(source),
    });
    expect(tiles.stats.cells).toBeGreaterThan(0);
    expect(tiles.stats.skipped).toBe(0);
    tiles.setProgress(0.825);
    reflectors.setProgress(0.825);
    scene.onBeforeRender(null, scene, null, null, null, null);
    expect(floor.visible).toBe(false);
    expect(reflection.visible).toBe(true);
    expect(reflection.material.uniforms.opacity.value).toBeCloseTo(0.2);
    tiles.setProgress(1);
    reflectors.setProgress(1);
    tiles.dispose();
    reflectors.dispose();
    expect(floor.visible).toBe(true);
    expect(reflection.visible).toBe(true);
    expect(reflection.material.uniforms.opacity.value).toBe(0.4);
});

test("cached arrival tiles reuse for departure while a fresh reflector fade remains independent and cancellation restores current values", () => {
    clearWorldTransitionCache();
    const scene = new THREE.Scene();
    const room = new THREE.Group();
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 4),
        new THREE.MeshBasicMaterial()
    );
    const reflection = reflector(0.4);
    room.add(floor, reflection);
    scene.add(room);
    const arrival = createWorldReflectorReveal({ sources: [reflection] });
    const supported = new Set(arrival.supportedSources);
    const tiles = createWorldCubeReveal(THREE, [room], {
        scene,
        anchor: { x: 0, y: 0, z: 0 },
        exclude: (source) => supported.has(source),
    });
    const container = scene.getObjectByName("native-world-cube-reveal");
    const buffers = container.children.map((mesh: THREE.Mesh) => mesh.geometry);
    const clipTests = tiles.stats.clipTests;
    const details = {
        cellSize: 2,
        triangleBudget: 120000,
        refinement: undefined,
    };
    let departure: ReturnType<typeof createWorldReflectorReveal>;
    try {
        tiles.setProgress(1);
        arrival.setProgress(1);
        expect(rememberWorldTransition(room, tiles, details)).toBe(true);
        arrival.dispose();
        expect(container.parent).toBeNull();
        // The authored opacity may change during the visit. Departure captures
        // that current value, independently of the retained architecture buffers.
        reflection.material.uniforms.opacity.value = 0.62;
        departure = createWorldReflectorReveal({
            sources: [reflection],
            mode: "dissolve",
        });
        departure.setProgress(0.3);
        expect(reflection.visible).toBe(false);
        expect(reflection.material.uniforms.opacity.value).toBe(0);
        expect(tiles.canReuse()).toBe(true);
        expect(tiles.getAddedSources()).toEqual([]);
        const cached = takeWorldTransition(room);
        expect(cached?.effect).toBe(tiles);
        expect(
            cached.effect.restart({
                mode: "dissolve",
                anchor: { x: 0, y: 0, z: 0 },
            })
        ).toBe(true);
        expect(
            container.children.map((mesh: THREE.Mesh) => mesh.geometry)
        ).toEqual(buffers);
        expect(tiles.stats.clipTests).toBe(clipTests);
        tiles.setProgress(0.15);
        departure.setProgress(0.15);
        scene.onBeforeRender(null, scene, null, null, null, null);
        expect(floor.visible).toBe(false);
        expect(reflection.visible).toBe(true);
        expect(reflection.material.uniforms.opacity.value).toBeCloseTo(0.31);
        // The native cancellation path parks the architecture before restoring
        // the independently owned reflection state.
        expect(rememberWorldTransition(room, tiles, details)).toBe(true);
        departure.dispose();
        expect(floor.visible).toBe(true);
        expect(reflection.visible).toBe(true);
        expect(reflection.material.uniforms.opacity.value).toBe(0.62);
        expect(tiles.canReuse()).toBe(true);
    } finally {
        arrival.dispose();
        departure?.dispose();
        clearWorldTransitionCache();
        tiles.dispose();
    }
});

test("invalid progress is bounded and an empty scene needs no special handling", () => {
    const source = reflector();
    const effect = createWorldReflectorReveal({ sources: [source] });
    for (const progress of [-1, NaN, Infinity]) {
        effect.setProgress(progress);
        expect(effect.stats.opacity).toBe(0);
    }
    effect.setProgress(2);
    expect(effect.stats.opacity).toBe(1);
    effect.dispose();
    const empty = createWorldReflectorReveal({});
    empty.setProgress(0.8);
    empty.dispose();
    expect(empty.supportedSources).toEqual([]);
});

/** factory/water/waterobject.js: a custom node shader the tiles cannot cut,
 * whose opacityNode is its `alpha` uniform. */
function water(alpha = 0.9) {
    const material = new NodeMaterial();
    material.name = "WaterMaterial";
    material.transparent = true;
    const uniforms = { alpha: uniform(alpha) };
    (material as any).uniforms = uniforms;
    material.opacityNode = uniforms.alpha;
    return new THREE.Mesh(new THREE.PlaneGeometry(400, 400), material) as any;
}

test("native water fades with the reflections instead of popping in or vanishing", () => {
    const arriving = water();
    const reveal = createWorldReflectorReveal({ sources: [arriving] });
    expect(reveal.supportedSources).toEqual([arriving]);
    expect(arriving.visible).toBe(false);
    reveal.setProgress(0.825);
    expect(arriving.material.uniforms.alpha.value).toBeCloseTo(0.45);
    reveal.setProgress(1);
    expect(arriving.material.uniforms.alpha.value).toBeCloseTo(0.9);
    reveal.dispose();

    const leaving = water();
    const dissolve = createWorldReflectorReveal({
        sources: [leaving],
        mode: "dissolve",
    });
    // Still whole when the departure starts, gone within its first 30%.
    expect(leaving.visible).toBe(true);
    expect(leaving.material.uniforms.alpha.value).toBeCloseTo(0.9);
    dissolve.setProgress(0.15);
    expect(leaving.material.uniforms.alpha.value).toBeCloseTo(0.45);
    dissolve.setProgress(0.3);
    expect(leaving.visible).toBe(false);
    dissolve.dispose();
    expect(leaving.visible).toBe(true);
    expect(leaving.material.uniforms.alpha.value).toBeCloseTo(0.9);
});
