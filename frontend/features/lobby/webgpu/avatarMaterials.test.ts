import * as THREE from "three/webgpu";
import { MeshLambertNodeMaterial, MeshBasicNodeMaterial } from "three/webgpu";
import {
    applyNativeAvatarMaterials,
    cloneNativeAvatarMaterial,
    supportsNativeAvatarMaterial,
} from "./avatarMaterials";

function mesh(material: THREE.Material | THREE.Material[]) {
    return new THREE.Mesh(new THREE.BoxGeometry(), material);
}

test("Lambert conversion preserves authored color, alpha, emissive and surface maps", () => {
    const source = new THREE.MeshPhysicalMaterial({
        name: "native-body",
        color: 0x7856ab,
        emissive: 0x283647,
        emissiveIntensity: 0.3,
        map: new THREE.Texture(),
        emissiveMap: new THREE.Texture(),
        normalMap: new THREE.Texture(),
        normalScale: new THREE.Vector2(0.7, -0.8),
        aoMap: new THREE.Texture(),
        aoMapIntensity: 0.4,
        alphaMap: new THREE.Texture(),
        bumpMap: new THREE.Texture(),
        bumpScale: 0.2,
        displacementMap: new THREE.Texture(),
        displacementScale: 0.04,
        displacementBias: 0.01,
        opacity: 0.65,
        transparent: true,
        alphaTest: 0.2,
        vertexColors: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        envMap: new THREE.Texture(),
        metalness: 0.7,
        roughness: 0.2,
    });
    const root = new THREE.Group();
    const body = mesh(source);
    root.add(body);
    const retired = jest.spyOn(source, "dispose");
    const mapDispose = jest.spyOn(source.map, "dispose");
    const envDispose = jest.spyOn(source.envMap, "dispose");
    applyNativeAvatarMaterials(root);
    const result = body.material as MeshLambertNodeMaterial;
    expect(result).toBeInstanceOf(MeshLambertNodeMaterial);
    expect(result).not.toBe(source);
    expect(result.color.equals(source.color)).toBe(true);
    expect(result.color).not.toBe(source.color);
    expect(result.emissive.equals(source.emissive)).toBe(true);
    expect(result.normalScale.equals(source.normalScale)).toBe(true);
    expect(result.normalScale).not.toBe(source.normalScale);
    for (const property of [
        "name",
        "map",
        "emissiveMap",
        "emissiveIntensity",
        "normalMap",
        "aoMap",
        "aoMapIntensity",
        "alphaMap",
        "bumpMap",
        "bumpScale",
        "displacementMap",
        "displacementScale",
        "displacementBias",
        "opacity",
        "transparent",
        "alphaTest",
        "vertexColors",
        "side",
    ])
        expect(result[property]).toBe(source[property]);
    expect(result.depthWrite).toBe(true);
    expect(result.depthTest).toBe(true);
    expect(result.envMap).toBeNull();
    expect(result.reflectivity).toBe(0);
    expect(retired).toHaveBeenCalledTimes(1);
    expect(mapDispose).not.toHaveBeenCalled();
    expect(envDispose).toHaveBeenCalledTimes(1);
});

test("shared materials convert once and retire only textures unused by every resulting material", () => {
    const retained = new THREE.Texture();
    const shaderShared = new THREE.Texture();
    const unused = new THREE.Texture();
    const source = new THREE.MeshStandardMaterial({
        map: retained,
        aoMap: retained,
        metalnessMap: unused,
        roughnessMap: unused,
        envMap: shaderShared,
    });
    const custom = new THREE.ShaderMaterial({
        uniforms: { retainedSampler: { value: [shaderShared] } },
    });
    const root = new THREE.Group();
    const one = mesh(source);
    const two = mesh(source);
    const three = mesh([source, custom]);
    root.add(one, two, three);
    const retiredMaterial = jest.spyOn(source, "dispose");
    const retainedDispose = jest.spyOn(retained, "dispose");
    const sharedDispose = jest.spyOn(shaderShared, "dispose");
    const unusedDispose = jest.spyOn(unused, "dispose");
    applyNativeAvatarMaterials(root);
    expect(one.material).toBe(two.material);
    expect(three.material[0]).toBe(one.material);
    expect(three.material[1]).toBe(custom);
    expect(retiredMaterial).toHaveBeenCalledTimes(1);
    expect(unusedDispose).toHaveBeenCalledTimes(1);
    expect(retainedDispose).not.toHaveBeenCalled();
    expect(sharedDispose).not.toHaveBeenCalled();
});

test("custom shaders and custom standard shader hooks stay intact and outside batching", () => {
    const shader = new THREE.ShaderMaterial();
    const hooked = new THREE.MeshStandardMaterial();
    hooked.onBeforeCompile = jest.fn();
    const keyed = new THREE.MeshStandardMaterial();
    keyed.customProgramCacheKey = () => "custom-shader";
    const root = new THREE.Group();
    const materials = [shader, hooked, keyed];
    const meshes = materials.map(mesh);
    root.add(...meshes);
    const disposals = materials.map((material) =>
        jest.spyOn(material, "dispose")
    );
    applyNativeAvatarMaterials(root);
    meshes.forEach((mesh, index) => {
        expect(mesh.material).toBe(materials[index]);
        expect(supportsNativeAvatarMaterial(materials[index])).toBe(false);
        expect(disposals[index]).not.toHaveBeenCalled();
    });
});

test("authored unlit GLTF materials remain unlit with their alpha map", () => {
    const source = new THREE.MeshBasicMaterial({
        color: 0xaabbcc,
        alphaMap: new THREE.Texture(),
        alphaTest: 0.5,
    });
    const root = mesh(source);
    applyNativeAvatarMaterials(root);
    const material = root.material as MeshLambertNodeMaterial;
    expect(material.type).toBe("MeshBasicNodeMaterial");
    expect(material.alphaMap).toBe(source.alphaMap);
    expect(material.alphaTest).toBe(0.5);
    expect(material.lightsNode).toBeNull();
    expect(supportsNativeAvatarMaterial(material)).toBe(true);
});

// Roller Pepe's GLB has one KHR_materials_unlit / BLEND material shared by
// separate body and glasses meshes. GLTF defaults depthWrite to false, while
// Oncyber gltf.validate and the reference VRM pipeline explicitly restore it.
test("Pepe-style transparent body and glasses retain alpha but write native depth", () => {
    const source = new THREE.MeshBasicMaterial({
        name: "Pepe_Roller 2",
        map: new THREE.Texture(),
        transparent: true,
        opacity: 1,
        depthWrite: false,
        side: THREE.FrontSide,
    });
    const root = new THREE.Group();
    const body = mesh(source);
    const glasses = mesh(source);
    root.add(body, glasses);
    applyNativeAvatarMaterials(root);
    const material = body.material as MeshLambertNodeMaterial;
    expect(glasses.material).toBe(material);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(1);
    expect(material.alphaTest).toBe(0);
    expect(material.map).toBe(source.map);
    expect(material.side).toBe(THREE.FrontSide);
    expect(material.depthWrite).toBe(true);
    expect(material.depthTest).toBe(true);
});

test("crowd clones preserve node material authored textures, colors and normal strength", () => {
    const source = new THREE.MeshStandardMaterial({
        color: 0x314159,
        emissive: 0x123456,
        emissiveIntensity: 0.25,
        map: new THREE.Texture(),
        emissiveMap: new THREE.Texture(),
        normalMap: new THREE.Texture(),
        normalScale: new THREE.Vector2(0.4, -0.7),
        aoMap: new THREE.Texture(),
        aoMapIntensity: 0.6,
        alphaMap: new THREE.Texture(),
        opacity: 0.7,
        transparent: true,
        alphaTest: 0.2,
    });
    const root = mesh(source);
    applyNativeAvatarMaterials(root);
    const native = root.material as MeshLambertNodeMaterial;
    const clone = cloneNativeAvatarMaterial(native);
    expect(clone).toBeInstanceOf(MeshLambertNodeMaterial);
    expect(clone).not.toBe(native);
    for (const key of [
        "map",
        "emissiveMap",
        "emissiveIntensity",
        "normalMap",
        "aoMap",
        "aoMapIntensity",
        "alphaMap",
        "opacity",
        "transparent",
        "alphaTest",
        "depthWrite",
        "depthTest",
        "envMap",
        "reflectivity",
    ])
        expect(clone[key]).toBe(native[key]);
    expect(clone.color.equals(native.color)).toBe(true);
    expect(clone.color).not.toBe(native.color);
    expect(clone.emissive.equals(native.emissive)).toBe(true);
    expect(clone.emissive).not.toBe(native.emissive);
    expect(clone.normalScale.equals(native.normalScale)).toBe(true);
    expect(clone.normalScale).not.toBe(native.normalScale);
    const photo = new MeshBasicNodeMaterial({
        map: new THREE.Texture(),
        color: 0xabcdef,
        side: THREE.DoubleSide,
    });
    const photoClone = cloneNativeAvatarMaterial(photo);
    expect(photoClone.map).toBe(photo.map);
    expect(photoClone.color.equals(photo.color)).toBe(true);
    expect(photoClone.side).toBe(THREE.DoubleSide);
});

test("lobby, native and crowd avatars share a stable avatar-only light profile", () => {
    const a = mesh(new THREE.MeshStandardMaterial());
    const b = mesh(new THREE.MeshStandardMaterial());
    const native = mesh(new THREE.MeshStandardMaterial());
    applyNativeAvatarMaterials(a);
    applyNativeAvatarMaterials(b);
    applyNativeAvatarMaterials(native, 1);
    const first = a.material as MeshLambertNodeMaterial;
    const second = b.material as MeshLambertNodeMaterial;
    const local = native.material as MeshLambertNodeMaterial;
    expect(first.lightsNode).toBeTruthy();
    expect(second.lightsNode).toBe(first.lightsNode);
    expect(local.lightsNode).not.toBe(first.lightsNode);
    expect(cloneNativeAvatarMaterial(first).lightsNode).toBe(first.lightsNode);
    expect(supportsNativeAvatarMaterial(first)).toBe(true);
    const lobbyLights = first.lightsNode.getLights();
    const nativeLights = local.lightsNode.getLights();
    expect(lobbyLights.map((l) => l.intensity)).toEqual(
        nativeLights.map((l) => l.intensity * Math.PI)
    );
    expect(lobbyLights.map((l) => l.position.toArray())).toEqual(
        nativeLights.map((l) => l.position.toArray())
    );
});
