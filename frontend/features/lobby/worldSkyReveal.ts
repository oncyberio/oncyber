import { MeshBasicNodeMaterial, NodeMaterial } from "three/webgpu";
import {
    abs,
    asin,
    atan,
    attribute,
    clamp as clampNode,
    cubeTexture,
    exp,
    float as tslFloat,
    fract,
    max,
    modelViewProjection,
    normalize,
    output,
    pmremTexture,
    pow,
    texture,
    uniform,
    vec2,
    vec3,
    vec4,
} from "three/tsl";
import { sampleWorldCell } from "./worldTileMotion";
import { createWorldTileBackMaterial } from "./worldTileBack";
import { cloneWorldRevealMaterial } from "./worldRevealMaterial";

type SkyMode = "reveal" | "dissolve";
export interface WorldSkyRevealOptions {
    scene: any;
    sources?: readonly any[];
    getCamera: () => any;
    mode?: SkyMode;
    /** Subdivisions per cube face, bounded to 4–24; defaults to 24 (3,456 tiles). */
    segments?: number;
}
const SKY_RADIUS = 100;
const SKY_FINISH = 0.92;
const IMAGE_DIM_FINISH = 0.3;
const IMAGE_REVEAL_START = 0.6;
const IMAGE_REVEAL_FINISH = 0.92;
const clamp = (value: number) =>
    Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const TAU = 6.28318530718;
const PI = 3.14159265359;
/** Equirect lookup of the sharp panorama along a world direction, in the
 * background sphere's local frame (it is mirrored with scale.z = -1). */
const worldSkyUv = (direction: any, directionToLocal: any) => {
    const d = normalize(directionToLocal.mul(direction));
    return vec2(
        fract(atan(d.z, d.x.negate()).div(TAU).add(1)),
        asin(clampNode(d.y, -1, 1)).div(PI).add(0.5)
    );
};
/** The square rim on moving sky panels; added before tone mapping. */
const skyGlow = (color: any) => {
    const tileUv = attribute("skyTileUv", "vec2");
    const edge = max(abs(tileUv.x.mul(2).sub(1)), abs(tileUv.y.mul(2).sub(1)));
    const rim = exp(pow(edge.sub(0.8).div(0.16), 2).negate()).mul(
        attribute("skyGlow", "float")
    );
    return vec4(color.rgb.add(vec3(0.1, 0.17, 0.23).mul(rim)), color.a);
};
const dimmed = (color: any, brightness: any) =>
    vec4(color.rgb.mul(brightness), color.a);
/** Authored image shells keep their own material (map, fog, hooks): clone it
 * as a node material and dim its final colour before tone mapping. */
function dimmedImageMaterial(source: any, brightness: any) {
    let material: any;
    if (source.isNodeMaterial) material = cloneWorldRevealMaterial(source);
    else {
        // Same property transfer WebGPURenderer applies to classic materials.
        const copy = source.clone();
        material = new MeshBasicNodeMaterial();
        for (const key in copy)
            if (key !== "uuid" && key !== "type" && key !== "_listeners")
                material[key] = copy[key];
    }
    const color = material.outputNode ?? output;
    material.outputNode = dimmed(color, brightness);
    material.uniforms = { worldSkyBrightness: brightness };
    return material;
}
function visibleBackgroundSource(source: any) {
    for (let ancestor = source; ancestor; ancestor = ancestor.parent)
        if (ancestor.visible === false || ancestor.userData?.worldRevealExclude)
            return false;
    return true;
}
/** factory/background: BackgroundColorMaterial, BackgroundSharpMaterial and
 * BackgroundCubeMaterial node materials on the "backgroundMesh". */
function nativeKind(source: any) {
    const material = source?.material;
    if (
        !source?.isMesh ||
        !visibleBackgroundSource(source) ||
        material?.isNodeMaterial !== true
    )
        return undefined;
    if (
        material.name === "BackgroundColorMaterial" &&
        material.uniforms?.color?.value?.isColor
    )
        return "color";
    if (
        material.name === "BackgroundSharpMaterial" &&
        material.uniforms?.map?.value?.isTexture
    )
        return "sharp";
    if (
        material.name === "BackgroundCubeMaterial" &&
        material.uniforms?.envMap?.value?.isTexture
    )
        return "cube";
    return undefined;
}

/** Authored image shells may live in a GLB rather than Scene.background. Names
 * alone are not enough: automatic detection also requires an unlit texture and
 * a large enclosure around the viewer. Explicit authored tags support other UV
 * backdrops without mistaking ordinary walls, screens or artwork for the sky. */
function embeddedImageBackground(THREE: any, source: any, camera: any) {
    const material = source?.material;
    if (
        !source?.isMesh ||
        source.isSkinnedMesh ||
        source.isInstancedMesh ||
        !(material?.isMeshBasicMaterial || material?.isMeshBasicNodeMaterial) ||
        !material.map?.isTexture ||
        !source.geometry?.attributes?.position ||
        Object.keys(source.geometry.morphAttributes ?? {}).length
    )
        return false;
    if (!visibleBackgroundSource(source)) return false;
    if (source.userData?.worldTravelBackground === true) return true;
    const semanticName = (value: string) =>
        /^(sky|skybox|skydome|panorama|background|space)([._ -]?[0-9]+)?$/i.test(
            value ?? ""
        );
    if (!semanticName(source.name) && !semanticName(material.name))
        return false;
    if (!camera) return false;
    source.updateWorldMatrix?.(true, false);
    source.geometry.computeBoundingBox();
    const bounds = source.geometry.boundingBox
        .clone()
        .applyMatrix4(source.matrixWorld);
    const size = bounds.getSize(new THREE.Vector3());
    const point = new THREE.Vector3();
    if (camera.getWorldPosition) camera.getWorldPosition(point);
    else point.copy(camera.position);
    const dimensions = [size.x, size.y, size.z];
    return (
        dimensions.every((value) => Number.isFinite(value) && value >= 100) &&
        Math.max(...dimensions) / Math.min(...dimensions) <= 4 &&
        bounds.containsPoint(point)
    );
}

function buildSkyGeometry(THREE: any, segments: number) {
    const geometry = new THREE.BufferGeometry();
    const base: number[] = [],
        directions: number[] = [],
        tileUvs: number[] = [];
    const tiles: Array<{
        start: number;
        center: any;
        delay: number;
        seed: number;
        sample?: any;
    }> = [];
    const faces = [
        [
            [1, 0, 0],
            [0, 0, -1],
            [0, 1, 0],
        ],
        [
            [-1, 0, 0],
            [0, 0, 1],
            [0, 1, 0],
        ],
        [
            [0, 1, 0],
            [1, 0, 0],
            [0, 0, -1],
        ],
        [
            [0, -1, 0],
            [1, 0, 0],
            [0, 0, 1],
        ],
        [
            [0, 0, 1],
            [1, 0, 0],
            [0, 1, 0],
        ],
        [
            [0, 0, -1],
            [-1, 0, 0],
            [0, 1, 0],
        ],
    ];
    for (const [face, [normal, right, up]] of faces.entries())
        for (let y = 0; y < segments; y++)
            for (let x = 0; x < segments; x++) {
                const corners = [
                    [x, y],
                    [x + 1, y],
                    [x + 1, y + 1],
                    [x, y + 1],
                ].map(([column, row]) => {
                    const a = (column / segments) * 2 - 1,
                        b = (row / segments) * 2 - 1;
                    return new THREE.Vector3(
                        ...normal.map(
                            (n, axis) => n + right[axis] * a + up[axis] * b
                        )
                    ).normalize();
                });
                const center = new THREE.Vector3();
                corners.forEach((point) => center.add(point));
                center.multiplyScalar(SKY_RADIUS / 4);
                const seed = face * segments * segments + y * segments + x + 1;
                const altitude = (center.y / SKY_RADIUS + 1) / 2;
                const jitter =
                    ((Math.sin(seed * 127.1) * 43758.5453) % 1) * 0.012;
                tiles.push({
                    start: base.length / 3,
                    center,
                    delay: Math.max(
                        0,
                        Math.min(0.64, 0.12 + altitude * 0.5 + jitter)
                    ),
                    seed,
                });
                // Inward-facing fronts; no black backs or second solid shell.
                const uv = [
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 1],
                ];
                for (const index of [0, 2, 1, 0, 3, 2]) {
                    directions.push(...corners[index].toArray());
                    base.push(
                        ...corners[index]
                            .clone()
                            .multiplyScalar(SKY_RADIUS)
                            .toArray()
                    );
                    tileUvs.push(...uv[index]);
                }
            }
    const positions = new THREE.BufferAttribute(new Float32Array(base), 3);
    positions.setUsage(THREE.DynamicDrawUsage);
    const glow = new THREE.BufferAttribute(
        new Float32Array(base.length / 3),
        1
    );
    glow.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", positions);
    geometry.setAttribute(
        "skyDirection",
        new THREE.BufferAttribute(new Float32Array(directions), 3)
    );
    geometry.setAttribute(
        "skyTileUv",
        new THREE.BufferAttribute(new Float32Array(tileUvs), 2)
    );
    geometry.setAttribute(
        "uv",
        new THREE.BufferAttribute(new Float32Array(tileUvs), 2)
    );
    geometry.setAttribute("skyGlow", glow);
    return { geometry, base, directions, tileUvs, tiles, positions, glow };
}

/** Every background stays continuous: skies fade behind the assembling room,
 * while the square motion belongs exclusively to solid scene geometry.
 * Departures dim backdrops early. Source textures are shared, never owned. */
export function createWorldSkyReveal(
    THREE: any,
    options: WorldSkyRevealOptions
) {
    const { scene } = options;
    const mode = options.mode ?? "reveal";
    const dimBackground = (kind: string) => kind !== "black";
    const colorKind = (color: any) =>
        mode === "dissolve" &&
        color?.r === 0 &&
        color?.g === 0 &&
        color?.b === 0
            ? "black"
            : "color";
    const originalBackground = scene.background;
    const supportedSources: any[] = [];
    const descriptors: Array<{ kind: string; material: any; source?: any }> =
        [];
    const seen = new Set<any>();
    for (const source of options.sources ?? []) {
        if (seen.has(source)) continue;
        seen.add(source);
        let kind =
            nativeKind(source) ??
            (embeddedImageBackground(THREE, source, options.getCamera())
                ? "image-mesh"
                : undefined);
        if (!kind) continue;
        if (kind === "color")
            kind = colorKind(source.material.uniforms.color.value);
        supportedSources.push(source);
        descriptors.push({ kind, material: source.material, source });
    }
    // Only explicit native backgrounds replace the scene backdrop. An authored
    // image mesh may be partial/transparent and still need its clear color/map
    // to fade alongside it instead of appearing abruptly at the final frame.
    const hasNativeBackground = descriptors.some(
        (descriptor) => descriptor.kind !== "image-mesh"
    );
    if (!hasNativeBackground && originalBackground?.isColor) {
        descriptors.push({
            kind: colorKind(originalBackground),
            material: { uniforms: { color: { value: originalBackground } } },
        });
    } else if (!hasNativeBackground && originalBackground?.isCubeTexture) {
        descriptors.push({
            kind: "cube",
            material: { uniforms: { envMap: { value: originalBackground } } },
        });
    }
    if (!descriptors.length)
        return {
            supported: false,
            supportedSources,
            stats: {
                tiles: 0,
                sources: 0,
                dimmedSources: 0,
                drawCalls: 0,
                backDrawCalls: 0,
            },
            setProgress: (_p: number) => {},
            dispose: () => {},
        };

    const segments = Number.isFinite(options.segments)
        ? Math.max(4, Math.min(24, Math.floor(options.segments)))
        : 24;
    const container = new THREE.Group();
    container.name = "world-sky-reveal";
    container.userData.worldRevealExclude = true;
    container.matrixAutoUpdate = false;
    const fixedContainer = new THREE.Group();
    fixedContainer.name = "world-image-background-dim";
    fixedContainer.userData.worldRevealExclude = true;
    fixedContainer.matrixAutoUpdate = false;
    const black = new THREE.Color(0);
    const sourceVisibility = supportedSources.map(
        (source) => [source, source.visible] as const
    );
    const materials: any[] = [];
    const hasTiledSources = descriptors.some(
        (descriptor) =>
            !dimBackground(descriptor.kind) && descriptor.kind !== "black"
    );
    const dimmedSources = descriptors.filter((descriptor) =>
        dimBackground(descriptor.kind)
    ).length;
    const tiled = buildSkyGeometry(THREE, hasTiledSources ? segments : 1);
    const { geometry, base, tiles, positions, glow } = tiled;
    // Backgrounds stay still and dim early on departure so only actual room
    // surfaces dismantle. The six-face sampling shell keeps full sky coverage.
    const stationary =
        dimmedSources && hasTiledSources ? buildSkyGeometry(THREE, 1) : tiled;
    const imageMeshes: any[] = [];
    const imageBrightness = uniform(1);
    scene.updateMatrixWorld(true);
    for (const descriptor of descriptors) {
        const source = descriptor.material;
        if (descriptor.kind === "black") continue;
        if (descriptor.kind === "image-mesh") {
            const original = descriptor.source;
            const material = dimmedImageMaterial(source, imageBrightness);
            const mesh = new THREE.Mesh(original.geometry, material);
            mesh.name = "world-sky-image:mesh";
            mesh.matrixAutoUpdate = false;
            mesh.matrix.copy(original.matrixWorld);
            mesh.layers.mask = original.layers.mask;
            mesh.renderOrder = original.renderOrder;
            mesh.frustumCulled = false;
            fixedContainer.add(mesh);
            imageMeshes.push(mesh);
            materials.push(material);
            continue;
        }
        // The sampling shell's world direction, not the moving tile position.
        const direction = attribute("skyDirection", "vec3");
        const uniforms: Record<string, any> = {};
        let color: any;
        if (descriptor.kind === "sharp") {
            descriptor.source.updateMatrixWorld?.(true);
            uniforms.map = texture(source.uniforms.map.value);
            uniforms.skyDirectionToLocal = uniform(
                new THREE.Matrix3()
                    .setFromMatrix4(descriptor.source.matrixWorld)
                    .invert()
            );
            // Raw equirect coordinates: no texture transform.
            color = uniforms.map
                .sample(worldSkyUv(direction, uniforms.skyDirectionToLocal))
                .setUpdateMatrix(false);
        } else if (descriptor.kind === "cube") {
            const envMap = source.uniforms.envMap.value;
            uniforms.envMap = envMap.isCubeTexture
                ? cubeTexture(envMap, direction)
                : pmremTexture(envMap, direction, tslFloat(0));
            color = vec4(uniforms.envMap.rgb, 1);
        } else {
            uniforms.color = uniform(source.uniforms.color.value.clone());
            color = vec4(uniforms.color, 1);
        }
        const stationaryImage = dimBackground(descriptor.kind);
        if (stationaryImage) uniforms.worldSkyBrightness = imageBrightness;
        const material: any = new NodeMaterial();
        material.name = `world-sky-${descriptor.kind}`;
        material.uniforms = uniforms;
        material.side = THREE.FrontSide;
        material.depthTest = true;
        material.depthWrite = false;
        material.transparent = source.transparent === true;
        material.fog = false;
        material.toneMapped = source.toneMapped !== false;
        // At the far plane, like the background it stands in for.
        material.vertexNode = modelViewProjection.setZ(modelViewProjection.w);
        material.colorNode = stationaryImage
            ? dimmed(color, imageBrightness)
            : skyGlow(color);
        if (descriptor.kind === "cube")
            Object.defineProperty(material, "envMap", {
                get: () => uniforms.envMap.value,
            });
        materials.push(material);
        const mesh = new THREE.Mesh(
            stationaryImage ? stationary.geometry : geometry,
            material
        );
        mesh.name = `world-sky-${stationaryImage ? "image" : "tiles"}:${
            descriptor.kind
        }`;
        if (stationaryImage) imageMeshes.push(mesh);
        mesh.frustumCulled = false;
        mesh.renderOrder = -100000000;
        mesh.onBeforeRender = (_renderer: any, _scene: any, camera: any) =>
            syncCamera(camera);
        container.add(mesh);
    }
    const back = hasTiledSources
        ? createWorldTileBackMaterial(THREE)
        : undefined;
    // Only moving panels need reverse faces. Image backgrounds remain intact
    // and never expose either baked scenery or a glowing tile rim on the back.
    if (back) {
        back.material.depthWrite = false;
        const backMesh = new THREE.Mesh(geometry, back.material);
        backMesh.name = "world-sky-tile-back";
        backMesh.frustumCulled = false;
        backMesh.renderOrder = -100000000;
        backMesh.castShadow = false;
        backMesh.receiveShadow = false;
        backMesh.onBeforeRender = (_renderer: any, _scene: any, camera: any) =>
            syncCamera(camera);
        container.add(backMesh);
    }
    scene.add(container);
    if (fixedContainer.children.length) scene.add(fixedContainer);
    const cameraPosition = new THREE.Vector3();
    const translation = new THREE.Matrix4(),
        inverseScene = new THREE.Matrix4();
    function syncCamera(camera = options.getCamera()) {
        if (!camera) return;
        if (camera.getWorldPosition) camera.getWorldPosition(cameraPosition);
        else cameraPosition.copy(camera.position);
        inverseScene.copy(scene.matrixWorld).invert();
        fixedContainer.matrix.copy(inverseScene);
        fixedContainer.updateMatrixWorld(true);
        translation.makeTranslation(
            cameraPosition.x,
            cameraPosition.y,
            cameraPosition.z
        );
        container.matrix.multiplyMatrices(inverseScene, translation);
        container.updateMatrixWorld(true);
    }
    const rotation = new THREE.Quaternion(),
        euler = new THREE.Euler(),
        transform = new THREE.Matrix4();
    const offset = new THREE.Vector3(),
        scale = new THREE.Vector3();
    const origin = { x: 0, y: -SKY_RADIUS, z: 0 };
    let disposed = false,
        previous = -1,
        intact = mode === "dissolve";
    function setProgress(value: number) {
        if (disposed) return;
        const p = clamp(value);
        intact = mode === "dissolve" ? p === 0 : p === 1;
        scene.background = intact ? originalBackground : black;
        for (const [source, visible] of sourceVisibility)
            source.visible = intact ? visible : false;
        const fadeProgress =
            mode === "dissolve"
                ? clamp(p / IMAGE_DIM_FINISH)
                : clamp(
                      (p - IMAGE_REVEAL_START) /
                          (IMAGE_REVEAL_FINISH - IMAGE_REVEAL_START)
                  );
        const fade = fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
        imageBrightness.value = Math.pow(
            mode === "dissolve" ? 1 - fade : fade,
            2.2
        );
        for (const mesh of imageMeshes)
            mesh.visible = imageBrightness.value > 0;
        fixedContainer.visible =
            mode === "dissolve"
                ? p > 0 && p < IMAGE_DIM_FINISH
                : p > IMAGE_REVEAL_START && p < 1;
        container.visible =
            mode === "dissolve"
                ? p > 0 && p < (hasTiledSources ? SKY_FINISH : IMAGE_DIM_FINISH)
                : p < 1;
        syncCamera();
        if (!hasTiledSources || p === previous) return;
        previous = p;
        for (const tile of tiles) {
            const sample = sampleWorldCell(
                p >= SKY_FINISH ? 1 : p,
                {
                    center: tile.center,
                    anchor: origin,
                    delay: tile.delay,
                    seed: tile.seed,
                    cellSize: (SKY_RADIUS * 2) / segments,
                    mode,
                },
                tile.sample
            );
            tile.sample = sample;
            euler.set(sample.rotation.x, sample.rotation.y, sample.rotation.z);
            rotation.setFromEuler(euler);
            offset.set(
                tile.center.x + sample.offset.x,
                tile.center.y + sample.offset.y,
                tile.center.z + sample.offset.z
            );
            scale.setScalar(sample.scale);
            transform.compose(offset, rotation, scale);
            const m = transform.elements;
            for (let i = tile.start; i < tile.start + 6; i++) {
                const j = i * 3,
                    x = base[j] - tile.center.x,
                    y = base[j + 1] - tile.center.y,
                    z = base[j + 2] - tile.center.z;
                positions.array[j] = m[0] * x + m[4] * y + m[8] * z + m[12];
                positions.array[j + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
                positions.array[j + 2] =
                    m[2] * x + m[6] * y + m[10] * z + m[14];
                glow.array[i] = sample.glow;
            }
        }
        positions.needsUpdate = true;
        glow.needsUpdate = true;
    }
    setProgress(0);
    // Native render passes can restore a background's visibility between the
    // animation tick and drawing. Keep the original hidden at draw time too,
    // including the final departure hold; only our fading shell owns the sky.
    const previousRender = scene.onBeforeRender;
    const beforeRender = function (this: any, ...args: any[]) {
        previousRender?.apply(this, args);
        if (disposed || intact) return;
        scene.background = black;
        for (const [source] of sourceVisibility) source.visible = false;
    };
    scene.onBeforeRender = beforeRender;
    return {
        supported: true,
        supportedSources,
        stats: {
            tiles: hasTiledSources ? tiles.length : 0,
            sources: descriptors.length,
            dimmedSources,
            drawCalls:
                container.children.length + fixedContainer.children.length,
            backDrawCalls: back ? 1 : 0,
        },
        setProgress,
        dispose() {
            if (disposed) return;
            disposed = true;
            if (scene.onBeforeRender === beforeRender)
                scene.onBeforeRender = previousRender;
            for (const [source, visible] of sourceVisibility)
                source.visible = visible;
            sourceVisibility.length = 0;
            scene.background = originalBackground;
            container.removeFromParent();
            container.clear();
            fixedContainer.removeFromParent();
            fixedContainer.clear();
            for (const buffers of new Set([tiled, stationary])) {
                buffers.geometry.dispose();
                for (const attribute of Object.values(
                    buffers.geometry.attributes
                ) as any[])
                    attribute.array = new Float32Array(0);
                buffers.tiles.length =
                    buffers.base.length =
                    buffers.directions.length =
                    buffers.tileUvs.length =
                        0;
            }
            materials.forEach((material) => material.dispose());
            back?.dispose();
            materials.length = imageMeshes.length = 0;
        },
    };
}
