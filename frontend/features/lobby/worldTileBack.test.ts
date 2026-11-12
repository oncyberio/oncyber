import * as THREE from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { vec4 } from "three/tsl";
import {
    createWorldTileBackMaterial,
    worldTileBackPixels,
} from "./worldTileBack";
import { createWorldCubeReveal } from "./worldCubeReveal";

test("tile backs use a neutral opaque black-to-dark-gray gradient without scene lighting", () => {
    const pixels = worldTileBackPixels();
    let darkest = 255,
        lightest = 0;
    for (let index = 0; index < pixels.length; index += 4) {
        expect(pixels[index]).toBe(pixels[index + 1]);
        expect(pixels[index]).toBe(pixels[index + 2]);
        expect(pixels[index + 3]).toBe(255);
        darkest = Math.min(darkest, pixels[index]);
        lightest = Math.max(lightest, pixels[index]);
    }
    expect(darkest).toBe(0);
    expect(lightest).toBe(26);
    const back = createWorldTileBackMaterial(THREE);
    expect(back.material).toMatchObject({
        isMeshBasicMaterial: true,
        side: THREE.BackSide,
        depthTest: true,
        depthWrite: true,
        toneMapped: false,
    });
    expect(back.material.map).toBe(back.texture);
    expect(back.material.envMap).toBeNull();
    expect(back.material.vertexColors).toBe(false);
    const materialDispose = jest.spyOn(back.material, "dispose"),
        textureDispose = jest.spyOn(back.texture, "dispose");
    back.dispose();
    back.dispose();
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(textureDispose).toHaveBeenCalledTimes(1);
});

test("double-sided walls preserve both authored faces, maps and node graphs during tile motion", () => {
    const scene = new THREE.Scene();
    const map = new THREE.Texture(),
        normalMap = new THREE.Texture();
    // Mesh-family node materials keep their graph (cyber terrain recolouring).
    const material = new MeshStandardNodeMaterial({
        side: THREE.DoubleSide,
        map,
        normalMap,
        vertexColors: true,
    });
    const colorNode = vec4(1, 0.5, 0.25, 1);
    material.colorNode = colorNode;
    const geometry = new THREE.PlaneGeometry(2, 2);
    geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(new Array(12).fill(0.5), 3)
    );
    const source = new THREE.Mesh(geometry, material);
    source.name = "textured-wall";
    source.receiveShadow = true;
    scene.add(source);
    const originalPositions = Array.from(geometry.attributes.position.array);
    const sourceDispose = jest.spyOn(material, "dispose"),
        textureDispose = jest.spyOn(map, "dispose");
    const effect = createWorldCubeReveal(THREE, [source], {
        scene,
        anchor: { x: 0, y: 0, z: 0 },
        cellSize: 0.5,
    });
    const container = scene.getObjectByName("native-world-cube-reveal");
    const front = container.children.find((mesh) =>
        mesh.name.startsWith("world-batch:")
    ) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    expect(container.getObjectByName("world-tile-back")).toBeUndefined();
    expect(effect.stats.drawCalls).toBe(2);
    expect(effect.stats.backDrawCalls).toBe(0);
    expect(front.material).not.toBe(material);
    expect(front.material.side).toBe(THREE.DoubleSide);
    expect(front.material.map).toBe(map);
    expect(front.material.normalMap).toBe(normalMap);
    expect(front.material.vertexColors).toBe(true);
    expect((front.material as any).isMeshStandardNodeMaterial).toBe(true);
    expect((front.material as any).colorNode).toBe(colorNode);
    expect(front.receiveShadow).toBe(true);
    const saved = Array.from(front.geometry.attributes.position.array);
    effect.setProgress(0.5);
    expect(Array.from(front.geometry.attributes.position.array)).not.toEqual(
        saved
    );
    expect(material.side).toBe(THREE.DoubleSide);
    expect(Array.from(geometry.attributes.position.array)).toEqual(
        originalPositions
    );
    const frontDispose = jest.spyOn(front.material, "dispose");
    effect.dispose();
    effect.dispose();
    expect(frontDispose).toHaveBeenCalledTimes(1);
    expect(sourceDispose).not.toHaveBeenCalled();
    expect(textureDispose).not.toHaveBeenCalled();
    expect(scene.children).toEqual([source]);
    expect(source.visible).toBe(true);
});

test("inside-out source surfaces keep their textured side and put the gradient on the opposite face", () => {
    const scene = new THREE.Scene();
    const material = new THREE.MeshBasicMaterial({
        side: THREE.BackSide,
        map: new THREE.Texture(),
    });
    const source = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    scene.add(source);
    const effect = createWorldCubeReveal(THREE, [source], {
        scene,
        anchor: { x: 0, y: 0, z: 0 },
    });
    const container = scene.getObjectByName("native-world-cube-reveal");
    const front = container.children.find((mesh) =>
        mesh.name.startsWith("world-batch:")
    ) as THREE.Mesh;
    const back = container.getObjectByName("world-tile-back") as THREE.Mesh<
        THREE.BufferGeometry,
        THREE.MeshBasicMaterial
    >;
    expect(front.material).toBe(material);
    expect(back.material.side).toBe(THREE.FrontSide);
    effect.dispose();
    expect(material.side).toBe(THREE.BackSide);
});
