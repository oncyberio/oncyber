import * as THREE from "three/webgpu";
import { texture } from "three/tsl";
import { disposeAvatarGraph, disposeAvatarTextures } from "./avatarResources";
import { applyNativeAvatarMaterials } from "./avatarMaterials";

const bitmap = () => ({ width: 16, height: 16, close: jest.fn() });

test("owned geometries, skeletons, materials and node textures are released once per avatar", () => {
    const root = new THREE.Group();
    const image = bitmap();
    const map = new THREE.Texture(image as any);
    const material = new THREE.MeshBasicNodeMaterial();
    material.colorNode = texture(map);
    const geometry = new THREE.BoxGeometry();
    const skeleton = new THREE.Skeleton([new THREE.Bone()]);
    skeleton.computeBoneTexture();
    const boneTexture = skeleton.boneTexture;
    for (let i = 0; i < 2; i++) {
        const mesh = new THREE.SkinnedMesh(geometry, material);
        mesh.bind(skeleton);
        root.add(mesh);
    }
    const releases = [geometry, material, map, boneTexture].map((resource) =>
        jest.spyOn(resource, "dispose")
    );
    disposeAvatarGraph(root);
    releases.forEach((release) => expect(release).toHaveBeenCalledTimes(1));
    expect(image.close).toHaveBeenCalledTimes(1);
});

test("retiring a sampler keeps a bitmap alive while another texture still uses it", () => {
    const image = bitmap();
    const retained = new THREE.Texture(image as any);
    const retired = retained.clone();
    const source = new THREE.MeshStandardMaterial({
        map: retained,
        roughnessMap: retired,
    });
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), source));
    const release = jest.spyOn(retired, "dispose");
    applyNativeAvatarMaterials(root);
    expect(release).toHaveBeenCalledTimes(1);
    expect(image.close).not.toHaveBeenCalled();
    disposeAvatarGraph(root);
    expect(image.close).toHaveBeenCalledTimes(1);
});

test("replaced-only maps are closed and explicitly shared assets stay alive", () => {
    const unusedImage = bitmap(),
        sharedImage = bitmap();
    const unused = new THREE.Texture(unusedImage as any);
    const shared = new THREE.Texture(sharedImage as any);
    shared.userData.isShared = true;
    const sharedRelease = jest.spyOn(shared, "dispose");
    disposeAvatarTextures(new Set([unused, shared]));
    expect(unusedImage.close).toHaveBeenCalledTimes(1);
    expect(sharedImage.close).not.toHaveBeenCalled();
    expect(sharedRelease).not.toHaveBeenCalled();
});
