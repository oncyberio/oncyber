import * as THREE from "three";
import { NodeMaterial } from "three/webgpu";
import { cubeTexture, pmremTexture } from "three/tsl";
import { createWorldSkyReveal } from "./worldSkyReveal";
import NativeColorMaterial from "../../components/_3DExhibit-v2/three/factory/background/materials/color.js";
import NativeSharpMaterial from "../../components/_3DExhibit-v2/three/factory/background/materials/sharp.js";
// Engine materials expose `uniforms` as TSL nodes; the typings omit them.
type BackgroundMaterial = THREE.Material & { uniforms: any };
const ColorMaterial = function () {
    const material = new NativeColorMaterial() as BackgroundMaterial;
    material.uniforms.color.value.setRGB(0.2, 0.4, 0.6);
    return material;
} as unknown as new () => BackgroundMaterial;
const SharpMaterial = function (texture: THREE.Texture) {
    return new NativeSharpMaterial({ map: texture }) as BackgroundMaterial;
} as unknown as new (texture: THREE.Texture) => BackgroundMaterial;
/** factory/background/index.js BackgroundCubeMaterial: env sampled by TSL. */
function cubeMaterial(texture: THREE.Texture) {
    const material: any = new NodeMaterial();
    material.name = "BackgroundCubeMaterial";
    material.side = THREE.BackSide;
    material.uniforms = {
        envMap: (texture as any).isCubeTexture
            ? cubeTexture(texture)
            : pmremTexture(texture),
    };
    return material;
}
type SkyMesh = THREE.Mesh<THREE.BufferGeometry, any>;
/** Node ids and attribute names reachable from a node graph. */
function graph(node: any) {
    const ids = new Set<number>(),
        attributes = new Set<string>();
    node?.traverse((child: any) => {
        ids.add(child.id);
        if (typeof child._attributeName === "string")
            attributes.add(child._attributeName);
    });
    return { ids, attributes };
}
const hasGlow = (material: any) =>
    graph(material.colorNode).attributes.has("skyGlow");
const dimsWith = (node: any, brightness: any) =>
    graph(node).ids.has(brightness.id);
function fixture(material: THREE.Material = new ColorMaterial()) {
    const scene = new THREE.Scene();
    const originalBackground = new THREE.Color(0x012345);
    scene.background = originalBackground;
    const source = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), material);
    source.name = "backgroundMesh";
    scene.add(source);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(3, 2, 1);
    const effect = createWorldSkyReveal(THREE, {
        scene,
        sources: [source, source],
        getCamera: () => camera,
        segments: 4,
    });
    const container = scene.getObjectByName("world-sky-reveal");
    const mesh = container.children[0] as SkyMesh;
    return {
        scene,
        source,
        camera,
        effect,
        container,
        mesh,
        originalBackground,
    };
}

describe("continuous native sky", () => {
    test("fades the original color continuously without moving its sampling shell and restores originals", () => {
        const f = fixture();
        const originalColor = (
            f.source.material as ColorMaterial
        ).uniforms.color.value.clone();
        expect(f.effect.supportedSources).toEqual([f.source]);
        expect(f.effect.stats).toEqual({
            tiles: 0,
            sources: 1,
            dimmedSources: 1,
            drawCalls: 1,
            backDrawCalls: 0,
        });
        expect(f.source.visible).toBe(false);
        expect(f.scene.background).not.toBe(f.originalBackground);
        expect(f.container.userData.worldRevealExclude).toBe(true);
        expect(f.container.children).toEqual([f.mesh]);
        expect(hasGlow(f.mesh.material)).toBe(false);
        expect(
            dimsWith(
                f.mesh.material.colorNode,
                f.mesh.material.uniforms.worldSkyBrightness
            )
        ).toBe(true);
        const position = f.mesh.geometry.getAttribute(
            "position"
        ) as THREE.BufferAttribute;
        const vertices = Array.from(position.array);
        const direction = f.mesh.geometry.getAttribute("skyDirection");
        const directions = Array.from(direction.array);
        let brightness = 0;
        for (const progress of [0, 0.4, 0.6, 0.68, 0.76, 0.84, 0.92, 0.999]) {
            f.effect.setProgress(progress);
            const current = f.mesh.material.uniforms.worldSkyBrightness.value;
            expect(current).toBeGreaterThanOrEqual(brightness);
            expect(current).toBeLessThanOrEqual(1);
            brightness = current;
            expect(Array.from(position.array)).toEqual(vertices);
            expect(Array.from(direction.array)).toEqual(directions);
            expect(position.version).toBe(0);
            expect(f.mesh.material.uniforms.color.value).toEqual(originalColor);
            if (progress <= 0.6) expect(current).toBe(0);
            if (progress >= 0.92) expect(current).toBe(1);
        }
        expect(f.mesh.material).toMatchObject({
            side: THREE.FrontSide,
            depthTest: true,
            depthWrite: false,
        });
        f.effect.setProgress(1);
        expect(f.source.visible).toBe(true);
        expect(f.scene.background).toBe(f.originalBackground);
        f.effect.setProgress(0.4);
        expect(f.source.visible).toBe(false);
        f.effect.dispose();
        expect(f.scene.children).toEqual([f.source]);
        expect(f.source.visible).toBe(true);
        expect(f.scene.background).toBe(f.originalBackground);
        expect(
            (f.source.material as ColorMaterial).uniforms.color.value
        ).toEqual(originalColor);
    });

    test("keeps cube-map sampling and texture ownership intact", () => {
        const texture = new THREE.CubeTexture();
        const material = cubeMaterial(texture);
        const f = fixture(material);
        expect((f.mesh.material as any).envMap).toBe(texture);
        expect(f.mesh.material.uniforms.envMap.value).toBe(texture);
        expect(f.mesh.material.uniforms).not.toBe(material.uniforms);
        expect(f.mesh.material.uniforms.envMap).not.toBe(
            material.uniforms.envMap
        );
        expect(f.mesh.material.isNodeMaterial).toBe(true);
        expect(f.mesh.material.vertexNode).toBeTruthy();
        // Sampled along the stationary shell direction, not the source box.
        expect(
            graph(f.mesh.material.colorNode).attributes.has("skyDirection")
        ).toBe(true);
        const textureDispose = jest.spyOn(texture, "dispose"),
            originalDispose = jest.spyOn(material, "dispose");
        const ownedGeometry = jest.spyOn(f.mesh.geometry, "dispose"),
            ownedMaterial = jest.spyOn(f.mesh.material, "dispose");
        f.effect.dispose();
        f.effect.dispose();
        expect(ownedGeometry).toHaveBeenCalledTimes(1);
        expect(ownedMaterial).toHaveBeenCalledTimes(1);
        expect(textureDispose).not.toHaveBeenCalled();
        expect(originalDispose).not.toHaveBeenCalled();
    });

    test("preserves the native mirrored sharp panorama orientation without UV seams or texture copies", () => {
        const scene = new THREE.Scene(),
            camera = new THREE.PerspectiveCamera();
        const texture = new THREE.Texture(),
            material = new SharpMaterial(texture);
        const source = new THREE.Mesh(
            new THREE.SphereGeometry(2, 8, 8),
            material
        );
        source.scale.z = -1;
        source.name = "backgroundMesh";
        const onBeforeRender = source.onBeforeRender;
        scene.add(source);
        const effect = createWorldSkyReveal(THREE, {
            scene,
            sources: [source],
            getCamera: () => camera,
            segments: 4,
        });
        const mesh = scene.getObjectByName("world-sky-reveal")
            .children[0] as SkyMesh;
        expect(mesh.material.uniforms.map.value).toBe(texture);
        expect(mesh.material.uniforms.map).not.toBe(material.uniforms.map);
        const sampling = graph(mesh.material.colorNode);
        expect(sampling.attributes.has("skyDirection")).toBe(true);
        expect(sampling.attributes.has("uv")).toBe(false);
        expect(
            sampling.ids.has(mesh.material.uniforms.skyDirectionToLocal.id)
        ).toBe(true);
        const local = new THREE.Vector3(0, 0, 1).applyMatrix3(
            mesh.material.uniforms.skyDirectionToLocal.value
        );
        expect(local.toArray()).toEqual([0, 0, -1]);
        expect(source.onBeforeRender).toBe(onBeforeRender);
        expect(source.scale.z).toBe(-1);
        effect.dispose();
        expect(source.material).toBe(material);
    });

    test("tracks the render camera through a transformed scene without moving world geometry", () => {
        const f = fixture();
        f.scene.position.set(8, 3, -2);
        f.scene.rotation.y = 0.4;
        f.scene.scale.set(1.3, 1.1, 0.7);
        f.scene.updateMatrixWorld(true);
        f.camera.position.set(-5, 6, 12);
        f.effect.setProgress(0.5);
        const center = new THREE.Vector3().setFromMatrixPosition(
            f.container.matrixWorld
        );
        expect(center.distanceTo(f.camera.position)).toBeLessThan(1e-5);
        const renderCamera = new THREE.PerspectiveCamera();
        renderCamera.position.set(12, 4, 9);
        (f.mesh.onBeforeRender as any)(null, f.scene, renderCamera);
        center.setFromMatrixPosition(f.container.matrixWorld);
        expect(center.distanceTo(renderCamera.position)).toBeLessThan(1e-5);
        expect(f.source.position.toArray()).toEqual([0, 0, 0]);
        f.effect.dispose();
    });

    test("dims a color background to an early black hold and cancellation restores the exact source", () => {
        const scene = new THREE.Scene(),
            camera = new THREE.PerspectiveCamera();
        const source = new THREE.Mesh(
            new THREE.SphereGeometry(),
            new ColorMaterial()
        );
        scene.add(source);
        const effect = createWorldSkyReveal(THREE, {
            scene,
            sources: [source],
            getCamera: () => camera,
            mode: "dissolve",
            segments: 4,
        });
        const container = scene.getObjectByName("world-sky-reveal");
        expect(source.visible).toBe(true);
        expect(container.visible).toBe(false);
        effect.setProgress(0.15);
        expect(source.visible).toBe(false);
        expect(container.visible).toBe(true);
        effect.setProgress(0.3);
        expect(source.visible).toBe(false);
        expect(container.visible).toBe(false);
        effect.setProgress(1);
        expect(source.visible).toBe(false);
        expect(scene.background).toEqual(new THREE.Color(0));
        effect.dispose();
        expect(source.visible).toBe(true);
        expect(scene.background).toBeNull();
    });

    test("supports scene colors and cubemaps but leaves unknown shader sources untouched", () => {
        const scene = new THREE.Scene(),
            camera = new THREE.PerspectiveCamera();
        const source = new THREE.Mesh(
            new THREE.PlaneGeometry(),
            new THREE.ShaderMaterial({
                uniforms: { color: { value: new THREE.Color() } },
            })
        );
        source.name = "backgroundMesh";
        scene.add(source);
        const unknown = createWorldSkyReveal(THREE, {
            scene,
            sources: [source],
            getCamera: () => camera,
        });
        expect(unknown.supported).toBe(false);
        unknown.setProgress(0.5);
        unknown.dispose();
        expect(scene.children).toEqual([source]);
        expect(source.visible).toBe(true);
        const unknownNode = new NodeMaterial();
        (unknownNode as any).uniforms = { color: { value: new THREE.Color() } };
        source.material = unknownNode;
        expect(
            createWorldSkyReveal(THREE, {
                scene,
                sources: [source],
                getCamera: () => camera,
            }).supported
        ).toBe(false);
        for (const background of [
            new THREE.Color(0x345678),
            new THREE.CubeTexture(),
        ]) {
            scene.background = background;
            const effect = createWorldSkyReveal(THREE, {
                scene,
                getCamera: () => camera,
                segments: 100,
            });
            expect(effect.stats).toMatchObject({
                tiles: 0,
                dimmedSources: 1,
                drawCalls: 1,
                backDrawCalls: 0,
            });
            effect.setProgress(1);
            expect(scene.background).toBe(background);
            effect.dispose();
        }
    });

    test("recognizes the native color material by material name after constructor-name minification", () => {
        class a extends NativeColorMaterial {}
        const minified = new a();
        const f = fixture(minified);
        expect(f.effect.supported).toBe(true);
        expect(f.effect.supportedSources).toEqual([f.source]);
        f.effect.dispose();
    });
});

test.each(["reveal", "dissolve"] as const)(
    "%s keeps complete stationary sky coverage without glow, reverse faces or extra draw calls",
    (mode) => {
        const scene = new THREE.Scene();
        const originalBackground = new THREE.Color(0x345678);
        scene.background = originalBackground;
        const camera = new THREE.PerspectiveCamera();
        const effect = createWorldSkyReveal(THREE, {
            scene,
            getCamera: () => camera,
            mode,
            segments: 100,
        });
        expect(effect.stats).toEqual({
            tiles: 0,
            sources: 1,
            dimmedSources: 1,
            drawCalls: 1,
            backDrawCalls: 0,
        });
        const container = scene.getObjectByName("world-sky-reveal");
        const front = container.children[0] as SkyMesh;
        expect(container.children).toEqual([front]);
        expect(
            container.getObjectByName("world-sky-tile-back")
        ).toBeUndefined();
        expect(hasGlow(front.material)).toBe(false);
        expect(front.material.uniforms.color.value).toEqual(originalBackground);
        const direction = front.geometry.getAttribute("skyDirection");
        expect(direction.count).toBe(36);
        let solidAngle = 0;
        let largestOutwardWinding = -Infinity;
        const a = new THREE.Vector3(),
            b = new THREE.Vector3(),
            c = new THREE.Vector3();
        const cross = new THREE.Vector3(),
            edge = new THREE.Vector3();
        for (let i = 0; i < direction.count; i += 3) {
            a.fromBufferAttribute(direction, i);
            b.fromBufferAttribute(direction, i + 1);
            c.fromBufferAttribute(direction, i + 2);
            const determinant = a.dot(cross.crossVectors(b, c));
            solidAngle +=
                2 *
                Math.atan2(
                    Math.abs(determinant),
                    1 + a.dot(b) + b.dot(c) + c.dot(a)
                );
            largestOutwardWinding = Math.max(
                largestOutwardWinding,
                cross.subVectors(b, a).cross(edge.subVectors(c, a)).dot(a)
            );
        }
        expect(solidAngle).toBeCloseTo(4 * Math.PI, 5);
        expect(largestOutwardWinding).toBeLessThan(0);
        const position = front.geometry.getAttribute(
            "position"
        ) as THREE.BufferAttribute;
        const vertices = Array.from(position.array);
        const uv = Array.from(front.geometry.getAttribute("uv").array);
        for (const progress of [0.1, 0.25, 0.45, 0.76, 0.92, 1]) {
            effect.setProgress(progress);
            expect(Array.from(position.array)).toEqual(vertices);
            expect(Array.from(front.geometry.getAttribute("uv").array)).toEqual(
                uv
            );
            expect(position.version).toBe(0);
            expect(front.material.uniforms.color.value).toEqual(
                originalBackground
            );
        }
        const geometryDispose = jest.spyOn(front.geometry, "dispose");
        const materialDispose = jest.spyOn(front.material, "dispose");
        effect.dispose();
        effect.dispose();
        expect(geometryDispose).toHaveBeenCalledTimes(1);
        expect(materialDispose).toHaveBeenCalledTimes(1);
        expect(scene.background).toBe(originalBackground);
        expect(scene.children).toHaveLength(0);
    }
);

function departureImageFixture(material: any) {
    const scene = new THREE.Scene();
    const originalBackground = new THREE.Color(0x012345);
    scene.background = originalBackground;
    const camera = new THREE.PerspectiveCamera();
    const source = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), material);
    source.name = "backgroundMesh";
    source.scale.z = -1;
    source.rotation.set(0.1, 0.65, -0.2);
    scene.add(source);
    const effect = createWorldSkyReveal(THREE, {
        scene,
        sources: [source, source],
        getCamera: () => camera,
        mode: "dissolve",
    });
    const container = scene.getObjectByName("world-sky-reveal");
    const image = container.children[0] as SkyMesh;
    return {
        scene,
        originalBackground,
        camera,
        source,
        material,
        effect,
        container,
        image,
    };
}

describe("departure image backgrounds", () => {
    test("dims a stationary panorama to black early without rotating panels, glow, or texture backs", () => {
        const f = departureImageFixture(new SharpMaterial(new THREE.Texture()));
        const position = f.image.geometry.getAttribute(
            "position"
        ) as THREE.BufferAttribute;
        const initialVertices = Array.from(position.array);
        expect(position.count).toBe(36);
        expect(f.effect.stats).toEqual({
            tiles: 0,
            sources: 1,
            dimmedSources: 1,
            drawCalls: 1,
            backDrawCalls: 0,
        });
        expect(f.container.children).toEqual([f.image]);
        expect(f.source.visible).toBe(true);
        expect(f.scene.background).toBe(f.originalBackground);
        expect(f.container.visible).toBe(false);
        expect(hasGlow(f.image.material)).toBe(false);
        expect(
            dimsWith(
                f.image.material.colorNode,
                f.image.material.uniforms.worldSkyBrightness
            )
        ).toBe(true);
        let previousBrightness = 1;
        for (const progress of [0.02, 0.1, 0.15, 0.25, 0.3, 0.6, 1]) {
            f.effect.setProgress(progress);
            const brightness =
                f.image.material.uniforms.worldSkyBrightness.value;
            expect(brightness).toBeLessThanOrEqual(previousBrightness);
            expect(brightness).toBeGreaterThanOrEqual(0);
            previousBrightness = brightness;
            expect(Array.from(position.array)).toEqual(initialVertices);
            expect(position.version).toBe(0);
            expect(f.source.visible).toBe(false);
            expect((f.scene.background as THREE.Color).getHex()).toBe(0);
            if (progress >= 0.3) {
                expect(brightness).toBe(0);
                expect(f.image.visible).toBe(false);
                expect(f.container.visible).toBe(false);
            } else {
                expect(f.image.visible).toBe(true);
                expect(f.container.visible).toBe(true);
            }
        }
        f.effect.dispose();
    });

    test("preserves rotated mirrored panorama sampling, original material, texture ownership, and cancellation", () => {
        const texture = new THREE.Texture();
        const f = departureImageFixture(new SharpMaterial(texture));
        const originalUniforms = f.material.uniforms;
        const sourceVisibility = f.source.visible;
        const onBeforeRender = f.source.onBeforeRender;
        const expectedInverse = new THREE.Matrix3()
            .setFromMatrix4(f.source.matrixWorld)
            .invert();
        expect(f.image.material.uniforms.skyDirectionToLocal.value).toEqual(
            expectedInverse
        );
        expect(f.image.material.uniforms.map.value).toBe(texture);
        expect(f.image.material.uniforms).not.toBe(originalUniforms);
        expect(
            graph(f.image.material.colorNode).attributes.has("skyDirection")
        ).toBe(true);
        const disposeGeometry = jest.spyOn(f.image.geometry, "dispose");
        const disposeMaterial = jest.spyOn(f.image.material, "dispose");
        const disposeOriginal = jest.spyOn(f.material, "dispose");
        const disposeTexture = jest.spyOn(texture, "dispose");
        f.effect.setProgress(0.15);
        f.effect.setProgress(0);
        expect(f.source.visible).toBe(sourceVisibility);
        expect(f.scene.background).toBe(f.originalBackground);
        expect(f.container.visible).toBe(false);
        f.effect.setProgress(0.2);
        f.effect.dispose();
        f.effect.dispose();
        expect(f.source.visible).toBe(sourceVisibility);
        expect(f.scene.background).toBe(f.originalBackground);
        expect(f.scene.children).toEqual([f.source]);
        expect(f.source.material).toBe(f.material);
        expect(f.material.uniforms).toBe(originalUniforms);
        expect(f.material.uniforms.worldSkyBrightness).toBeUndefined();
        expect(f.source.onBeforeRender).toBe(onBeforeRender);
        expect(f.source.scale.z).toBe(-1);
        expect(disposeGeometry).toHaveBeenCalledTimes(1);
        expect(disposeMaterial).toHaveBeenCalledTimes(1);
        expect(disposeOriginal).not.toHaveBeenCalled();
        expect(disposeTexture).not.toHaveBeenCalled();
    });

    test.each([false, true])(
        "preserves cube sampling and tone mapping (PMREM: %s), including immediate reduced-motion black",
        (pmrem) => {
            const texture = pmrem
                ? new THREE.Texture()
                : new THREE.CubeTexture();
            texture.mapping = pmrem
                ? THREE.CubeUVReflectionMapping
                : THREE.CubeReflectionMapping;
            const material = cubeMaterial(texture);
            const f = departureImageFixture(material);
            expect((f.image.material as any).envMap).toBe(texture);
            expect(f.image.material.uniforms.envMap.value).toBe(texture);
            expect(f.image.material.uniforms.envMap.type).toBe(
                pmrem ? "PMREMNode" : "CubeTextureNode"
            );
            expect(f.image.material.toneMapped).toBe(true);
            // Dimmed in the material colour, ahead of renderer tone mapping.
            expect(
                dimsWith(
                    f.image.material.colorNode,
                    f.image.material.uniforms.worldSkyBrightness
                )
            ).toBe(true);
            f.effect.setProgress(1);
            expect(f.image.material.uniforms.worldSkyBrightness.value).toBe(0);
            expect(f.container.visible).toBe(false);
            expect(f.source.visible).toBe(false);
            f.effect.dispose();
            expect(f.source.visible).toBe(true);
            expect(f.scene.background).toBe(f.originalBackground);
        }
    );

    test("dims scene cube backgrounds and restores their original identity", () => {
        const scene = new THREE.Scene();
        const background = new THREE.CubeTexture();
        scene.background = background;
        const camera = new THREE.PerspectiveCamera();
        const effect = createWorldSkyReveal(THREE, {
            scene,
            getCamera: () => camera,
            mode: "dissolve",
        });
        expect(effect.stats).toMatchObject({
            tiles: 0,
            sources: 1,
            dimmedSources: 1,
            drawCalls: 1,
        });
        effect.setProgress(0.3);
        expect(scene.background).toEqual(new THREE.Color(0));
        effect.dispose();
        expect(scene.background).toBe(background);
    });

    test("dims all image and color layers together without any moving backdrop panels", () => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera();
        const materials = [
            new ColorMaterial(),
            new SharpMaterial(new THREE.Texture()),
            new SharpMaterial(new THREE.Texture()),
        ];
        const sources = materials.map(
            (material) => new THREE.Mesh(new THREE.SphereGeometry(), material)
        );
        const hidden = new THREE.Mesh(
            new THREE.SphereGeometry(),
            new SharpMaterial(new THREE.Texture())
        );
        hidden.visible = false;
        scene.add(...sources, hidden);
        const effect = createWorldSkyReveal(THREE, {
            scene,
            sources: [...sources, hidden],
            getCamera: () => camera,
            mode: "dissolve",
            segments: 4,
        });
        const container = scene.getObjectByName("world-sky-reveal");
        const color = container.getObjectByName(
            "world-sky-image:color"
        ) as THREE.Mesh;
        const images = container.children.filter(
            (child) => child.name === "world-sky-image:sharp"
        ) as SkyMesh[];
        expect(effect.stats).toEqual({
            tiles: 0,
            sources: 3,
            dimmedSources: 3,
            drawCalls: 3,
            backDrawCalls: 0,
        });
        expect(images).toHaveLength(2);
        expect(images[0].geometry).toBe(images[1].geometry);
        expect(images[0].geometry).toBe(color.geometry);
        const imageVertices = Array.from(
            images[0].geometry.getAttribute("position").array
        );
        const colorVertices = Array.from(
            color.geometry.getAttribute("position").array
        );
        const imageDispose = jest.spyOn(images[0].geometry, "dispose");
        const colorDispose = jest.spyOn(color.geometry, "dispose");
        effect.setProgress(0.15);
        expect(images[0].material.uniforms.worldSkyBrightness).toBe(
            images[1].material.uniforms.worldSkyBrightness
        );
        expect(
            Array.from(images[0].geometry.getAttribute("position").array)
        ).toEqual(imageVertices);
        expect(
            Array.from(color.geometry.getAttribute("position").array)
        ).toEqual(colorVertices);
        effect.setProgress(0.35);
        expect(images.every((mesh) => !mesh.visible)).toBe(true);
        expect(container.visible).toBe(false);
        expect(color.visible).toBe(false);
        effect.dispose();
        expect(imageDispose).toHaveBeenCalledTimes(1);
        expect(colorDispose).toHaveBeenCalledTimes(1);
        expect(sources.every((source) => source.visible)).toBe(true);
        expect(hidden.visible).toBe(false);
    });
});

function embeddedBackdropFixture() {
    const scene = new THREE.Scene();
    scene.position.set(5, 2, -3);
    scene.rotation.y = 0.25;
    const parent = new THREE.Group();
    parent.rotation.y = -0.6;
    scene.add(parent);
    const texture = new THREE.Texture();
    texture.name = "SP_Nebula.jpg";
    const material = new THREE.MeshBasicMaterial({ map: texture });
    material.name = "space";
    const source = new THREE.Mesh(
        new THREE.SphereGeometry(300, 12, 8),
        material
    );
    source.name = "Space";
    source.scale.set(1, 0.8, 0.9);
    parent.add(source);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(4, 3, 1);
    scene.updateMatrixWorld(true);
    return { scene, parent, source, material, texture, camera };
}

describe("authored image backdrop departure", () => {
    test("recognizes the enclosing Space Pod nebula while keeping its UV geometry and world transform stationary", () => {
        const f = embeddedBackdropFixture();
        const originalMatrix = f.source.matrixWorld.clone();
        const originalPosition = Array.from(
            f.source.geometry.attributes.position.array
        );
        const originalUv = f.source.geometry.attributes.uv;
        f.scene.fog = new THREE.Fog(0xffffff, 1, 100);
        const effect = createWorldSkyReveal(THREE, {
            scene: f.scene,
            sources: [f.source],
            getCamera: () => f.camera,
            mode: "dissolve",
        });
        const fixed = f.scene.getObjectByName("world-image-background-dim");
        const image = fixed.children[0] as SkyMesh;
        const brightness = image.material.uniforms.worldSkyBrightness;
        expect(effect.supportedSources).toEqual([f.source]);
        expect(effect.stats).toEqual({
            tiles: 0,
            sources: 1,
            dimmedSources: 1,
            drawCalls: 1,
            backDrawCalls: 0,
        });
        expect(image.geometry).toBe(f.source.geometry);
        expect(image.geometry.attributes.uv).toBe(originalUv);
        expect(image.material).not.toBe(f.material);
        expect(image.material.map).toBe(f.texture);
        expect(image.material.side).toBe(f.material.side);
        expect(image.material.isMeshBasicNodeMaterial).toBe(true);
        expect(image.material.fog).toBe(true);
        expect(image.material.uuid).not.toBe(f.material.uuid);
        // Dims the fogged output, before tone mapping and colour conversion.
        expect(dimsWith(image.material.outputNode, brightness)).toBe(true);
        expect(fixed.visible).toBe(false);
        effect.setProgress(0.15);
        expect(f.source.visible).toBe(false);
        expect(fixed.visible).toBe(true);
        expect(brightness.value).toBeCloseTo(Math.pow(0.5, 2.2));
        f.camera.position.set(10, 5, -7);
        effect.setProgress(0.2);
        image.matrixWorld.elements.forEach((value, index) =>
            expect(value).toBeCloseTo(originalMatrix.elements[index], 5)
        );
        expect(Array.from(image.geometry.attributes.position.array)).toEqual(
            originalPosition
        );
        effect.setProgress(0.3);
        expect(brightness.value).toBe(0);
        expect(fixed.visible).toBe(false);
        expect(image.visible).toBe(false);
        const geometryDispose = jest.spyOn(f.source.geometry, "dispose");
        const originalDispose = jest.spyOn(f.material, "dispose");
        const cloneDispose = jest.spyOn(image.material, "dispose");
        const textureDispose = jest.spyOn(f.texture, "dispose");
        effect.dispose();
        effect.dispose();
        expect(f.source.visible).toBe(true);
        expect(f.source.material).toBe(f.material);
        expect(f.source.parent).toBe(f.parent);
        expect(f.material.isNodeMaterial).toBeUndefined();
        expect(
            f.scene.getObjectByName("world-image-background-dim")
        ).toBeUndefined();
        expect(cloneDispose).toHaveBeenCalledTimes(1);
        expect(geometryDispose).not.toHaveBeenCalled();
        expect(originalDispose).not.toHaveBeenCalled();
        expect(textureDispose).not.toHaveBeenCalled();
    });

    test.each(["room", "wall", "distant", "lit", "untextured", "hidden"])(
        "does not classify %s geometry as an image backdrop",
        (kind) => {
            const f = embeddedBackdropFixture();
            if (kind === "room") f.source.scale.setScalar(0.05);
            if (kind === "wall") {
                f.source.name = "S_Wall_01";
                f.material.name = "S_Wall_01";
            }
            if (kind === "distant") f.camera.position.set(1000, 3, 1);
            if (kind === "lit")
                (f.source as any).material = new THREE.MeshStandardMaterial({
                    map: f.texture,
                });
            if (kind === "untextured") f.material.map = null;
            if (kind === "hidden") f.parent.visible = false;
            const effect = createWorldSkyReveal(THREE, {
                scene: f.scene,
                sources: [f.source],
                getCamera: () => f.camera,
                mode: "dissolve",
            });
            expect(effect.supported).toBe(false);
            expect(effect.supportedSources).toEqual([]);
            expect(f.source.visible).toBe(true);
            effect.dispose();
        }
    );

    test("an explicit authored background tag supports a small custom UV backdrop", () => {
        const f = embeddedBackdropFixture();
        f.source.name = "Custom backdrop";
        f.material.name = "Unlit";
        f.source.scale.setScalar(0.05);
        f.source.userData.worldTravelBackground = true;
        const effect = createWorldSkyReveal(THREE, {
            scene: f.scene,
            sources: [f.source],
            getCamera: () => f.camera,
            mode: "dissolve",
        });
        expect(effect.supportedSources).toEqual([f.source]);
        effect.setProgress(1);
        expect(f.source.visible).toBe(false);
        effect.dispose();
        expect(f.source.visible).toBe(true);
    });

    test.each([0x000000, 0xffffff])(
        "native color %s adds no animated panels behind the departing Space Pod nebula",
        (color) => {
            const f = embeddedBackdropFixture();
            const black = new THREE.Mesh(
                new THREE.PlaneGeometry(),
                new ColorMaterial()
            );
            black.material.uniforms.color.value.set(color);
            black.name = "backgroundMesh";
            f.scene.add(black);
            const effect = createWorldSkyReveal(THREE, {
                scene: f.scene,
                sources: [black, f.source],
                getCamera: () => f.camera,
                mode: "dissolve",
            });
            expect(effect.stats).toEqual({
                tiles: 0,
                sources: 2,
                dimmedSources: color ? 2 : 1,
                drawCalls: color ? 2 : 1,
                backDrawCalls: 0,
            });
            expect(effect.supportedSources).toEqual([black, f.source]);
            const colorMesh = f.scene.getObjectByName(
                "world-sky-image:color"
            ) as SkyMesh;
            effect.setProgress(0.15);
            if (color) {
                expect(colorMesh.visible).toBe(true);
                expect(
                    colorMesh.material.uniforms.worldSkyBrightness.value
                ).toBeCloseTo(Math.pow(0.5, 2.2));
            }
            effect.setProgress(0.3);
            if (color) {
                expect(
                    colorMesh.material.uniforms.worldSkyBrightness.value
                ).toBe(0);
                expect(colorMesh.visible).toBe(false);
            }
            expect(black.visible).toBe(false);
            effect.dispose();
            expect(black.visible).toBe(true);
            expect(f.source.visible).toBe(true);
        }
    );
});

test("arrival claims an authored nebula before geometry partitioning and brings it in only after the room forms", () => {
    const f = embeddedBackdropFixture();
    const background = new THREE.Mesh(
        new THREE.PlaneGeometry(),
        new ColorMaterial()
    );
    background.name = "backgroundMesh";
    background.material.uniforms.color.value.set(0xffffff);
    f.scene.add(background);
    const originalWorld = f.source.matrixWorld.clone();
    const effect = createWorldSkyReveal(THREE, {
        scene: f.scene,
        sources: [background, f.source],
        getCamera: () => f.camera,
    });
    expect(effect.supportedSources).toEqual([background, f.source]);
    expect(effect.stats).toEqual({
        tiles: 0,
        sources: 2,
        dimmedSources: 2,
        drawCalls: 2,
        backDrawCalls: 0,
    });
    const fixed = f.scene.getObjectByName("world-image-background-dim");
    const image = fixed.children[0] as SkyMesh;
    const color = f.scene.getObjectByName("world-sky-image:color") as SkyMesh;
    const shader = image.material;
    expect(shader.uniforms.worldSkyBrightness).toBe(
        color.material.uniforms.worldSkyBrightness
    );
    expect(
        dimsWith(shader.outputNode, shader.uniforms.worldSkyBrightness)
    ).toBe(true);
    const position = image.geometry.attributes.position;
    const vertices = Array.from(position.array);
    expect(f.source.visible).toBe(false);
    expect(background.visible).toBe(false);
    expect(image.geometry).toBe(f.source.geometry);
    let brightness = 0;
    for (const progress of [0, 0.4, 0.6, 0.68, 0.76, 0.84, 0.92, 0.99]) {
        effect.setProgress(progress);
        const current = shader.uniforms.worldSkyBrightness.value;
        expect(current).toBeGreaterThanOrEqual(brightness);
        brightness = current;
        expect(Array.from(position.array)).toEqual(vertices);
        image.matrixWorld.elements.forEach((value, index) =>
            expect(value).toBeCloseTo(originalWorld.elements[index], 5)
        );
        if (progress <= 0.6) {
            expect(current).toBe(0);
            expect(image.visible).toBe(false);
            expect(color.visible).toBe(false);
        }
        if (progress >= 0.92) expect(current).toBe(1);
        expect(f.source.visible).toBe(false);
        expect(background.visible).toBe(false);
    }
    effect.setProgress(1);
    expect(f.source.visible).toBe(true);
    expect(background.visible).toBe(true);
    expect(fixed.visible).toBe(false);
    effect.setProgress(0.7);
    const geometryDispose = jest.spyOn(f.source.geometry, "dispose");
    const textureDispose = jest.spyOn(f.texture, "dispose");
    effect.dispose();
    expect(f.source.visible).toBe(true);
    expect(background.visible).toBe(true);
    expect(f.source.material).toBe(f.material);
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(textureDispose).not.toHaveBeenCalled();
});

test.each(["sharp", "cube"] as const)(
    "incoming %s image uses a stationary sampling shell and late fade",
    (kind) => {
        const material =
            kind === "sharp"
                ? new SharpMaterial(new THREE.Texture())
                : cubeMaterial(new THREE.CubeTexture());
        const f = fixture(material);
        expect(f.effect.stats).toMatchObject({
            tiles: 0,
            dimmedSources: 1,
            drawCalls: 1,
            backDrawCalls: 0,
        });
        expect(f.mesh.geometry.attributes.position.count).toBe(36);
        const vertices = Array.from(f.mesh.geometry.attributes.position.array);
        expect(f.mesh.material.uniforms.worldSkyBrightness.value).toBe(0);
        expect(hasGlow(f.mesh.material)).toBe(false);
        f.effect.setProgress(0.76);
        expect(f.mesh.material.uniforms.worldSkyBrightness.value).toBeCloseTo(
            Math.pow(0.5, 2.2)
        );
        expect(Array.from(f.mesh.geometry.attributes.position.array)).toEqual(
            vertices
        );
        f.effect.setProgress(1);
        expect(f.source.visible).toBe(true);
        f.effect.dispose();
    }
);

test.each(["reveal", "dissolve"] as const)(
    "a tagged generated procedural sky uses a stationary %s fade with no squares",
    (mode) => {
        const background = new THREE.CubeTexture();
        background.userData.worldTravelProceduralSky = true;
        const scene = new THREE.Scene();
        scene.background = background;
        const camera = new THREE.PerspectiveCamera();
        const effect = createWorldSkyReveal(THREE, {
            scene,
            getCamera: () => camera,
            segments: 4,
            mode,
        });
        expect(effect.stats).toMatchObject({
            tiles: 0,
            dimmedSources: 1,
            drawCalls: 1,
            backDrawCalls: 0,
        });
        const container = scene.getObjectByName("world-sky-reveal");
        const mesh = container.getObjectByName(
            "world-sky-image:cube"
        ) as SkyMesh;
        expect(container.children).toEqual([mesh]);
        expect(mesh.material.uniforms.envMap.value).toBe(background);
        expect(hasGlow(mesh.material)).toBe(false);
        const position = mesh.geometry.getAttribute(
            "position"
        ) as THREE.BufferAttribute;
        const initial = Array.from(position.array);
        let brightness = mode === "reveal" ? 0 : 1;
        for (const progress of [0.1, 0.25, 0.5, 0.76, 0.92]) {
            effect.setProgress(progress);
            expect(Array.from(position.array)).toEqual(initial);
            expect(position.version).toBe(0);
            const current = mesh.material.uniforms.worldSkyBrightness.value;
            if (mode === "reveal")
                expect(current).toBeGreaterThanOrEqual(brightness);
            else expect(current).toBeLessThanOrEqual(brightness);
            brightness = current;
            expect(mesh.material.uniforms.envMap.value).toBe(background);
        }
        effect.setProgress(1);
        if (mode === "reveal") expect(scene.background).toBe(background);
        else expect(scene.background).toEqual(new THREE.Color(0));
        effect.setProgress(0.5);
        const disposeTexture = jest.spyOn(background, "dispose");
        effect.dispose();
        expect(scene.background).toBe(background);
        expect(background.userData.worldTravelProceduralSky).toBe(true);
        expect(disposeTexture).not.toHaveBeenCalled();
    }
);

test.each(["color", "cube"] as const)(
    "an authored image backdrop also fades its Scene %s backing before the endpoint",
    (kind) => {
        const f = embeddedBackdropFixture();
        (f.source as THREE.Mesh<THREE.BufferGeometry>).geometry =
            new THREE.PlaneGeometry(8, 6);
        f.source.userData.worldTravelBackground = true;
        const backing =
            kind === "color"
                ? new THREE.Color(0xffffff)
                : new THREE.CubeTexture();
        f.scene.background = backing;
        const effect = createWorldSkyReveal(THREE, {
            scene: f.scene,
            sources: [f.source],
            getCamera: () => f.camera,
        });
        const fixed = f.scene.getObjectByName("world-image-background-dim");
        const image = fixed.children[0] as SkyMesh;
        const sky = f.scene.getObjectByName(
            `world-sky-image:${kind}`
        ) as SkyMesh;
        expect(effect.stats).toMatchObject({
            tiles: 0,
            sources: 2,
            dimmedSources: 2,
            drawCalls: 2,
        });
        const shader = image.material;
        expect(shader.uniforms.worldSkyBrightness).toBe(
            sky.material.uniforms.worldSkyBrightness
        );
        expect(sky.material.uniforms.worldSkyBrightness.value).toBe(0);
        effect.setProgress(0.76);
        expect(sky.material.uniforms.worldSkyBrightness.value).toBeCloseTo(
            Math.pow(0.5, 2.2)
        );
        effect.setProgress(0.92);
        expect(sky.material.uniforms.worldSkyBrightness.value).toBe(1);
        effect.setProgress(1);
        expect(f.scene.background).toBe(backing);
        effect.dispose();
        expect(f.scene.background).toBe(backing);
    }
);

test.each(["reveal", "dissolve"] as const)(
    "%s never promotes native background meshes from hidden or excluded ancestors",
    (mode) => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera();
        const hidden = new THREE.Group();
        hidden.visible = false;
        const excluded = new THREE.Group();
        excluded.userData.worldRevealExclude = true;
        const sources = [
            new ColorMaterial(),
            new SharpMaterial(new THREE.Texture()),
        ].map((material, index) => {
            const source = new THREE.Mesh(new THREE.SphereGeometry(), material);
            source.name = "backgroundMesh";
            (index ? excluded : hidden).add(source);
            return source;
        });
        scene.add(hidden, excluded);
        const effect = createWorldSkyReveal(THREE, {
            scene,
            sources,
            getCamera: () => camera,
            mode,
        });
        expect(effect.supported).toBe(false);
        expect(effect.supportedSources).toEqual([]);
        effect.setProgress(0.8);
        expect(scene.children).toEqual([hidden, excluded]);
        effect.dispose();
        expect(sources.every((source) => source.visible)).toBe(true);
        expect(hidden.visible).toBe(false);
    }
);

test("departure keeps the sky hidden when a render hook restores background visibility", () => {
    const scene = new THREE.Scene();
    const background = new THREE.Color(0x445566);
    scene.background = background;
    const source = new THREE.Mesh(
        new THREE.SphereGeometry(2),
        new ColorMaterial()
    );
    scene.add(source);
    const previous = jest.fn(() => {
        source.visible = true;
        scene.background = background;
    });
    scene.onBeforeRender = previous;
    const effect = createWorldSkyReveal(THREE, {
        scene,
        sources: [source],
        getCamera: () => new THREE.PerspectiveCamera(),
        mode: "dissolve",
    });
    const render = () => (scene.onBeforeRender as any)();
    effect.setProgress(0);
    render();
    expect(source.visible).toBe(true);
    for (const progress of [0.15, 0.5, 1]) {
        effect.setProgress(progress);
        render();
        expect(source.visible).toBe(false);
        expect((scene.background as THREE.Color).getHex()).toBe(0);
    }
    effect.dispose();
    expect(scene.onBeforeRender).toBe(previous);
    render();
    expect(source.visible).toBe(true);
    expect(scene.background).toBe(background);
});

test("disposing sky animation preserves later render hooks without retaining its visibility lock", () => {
    const f = fixture();
    const skyRender = f.scene.onBeforeRender;
    const laterRender = jest.fn(function (this: any, ...args: any[]) {
        skyRender.apply(this, args);
    });
    f.scene.onBeforeRender = laterRender;
    f.effect.dispose();
    expect(f.scene.onBeforeRender).toBe(laterRender);
    (f.scene.onBeforeRender as any)();
    expect(f.source.visible).toBe(true);
    expect(f.scene.background).toBe(f.originalBackground);
});
