import { matchNativeTravelMaterials } from "./nativeTravelMaterials";
const THREE = require("three");
test("arrival uses the same authored material as the native player and returns ownership on disposal", () => {
    const native = new THREE.Group(),
        travel = new THREE.Group();
    const finalMaterial = new THREE.MeshStandardMaterial({
        color: "#8cac23",
        roughness: 0.8,
        metalness: 0.1,
    });
    finalMaterial.name = "Body";
    const temporary = new THREE.MeshLambertMaterial();
    temporary.name = "Body";
    const nativeMesh = new THREE.Mesh(undefined, finalMaterial);
    const travelMesh = new THREE.Mesh(undefined, temporary);
    native.add(nativeMesh);
    travel.add(travelMesh);
    const dispose = jest.spyOn(finalMaterial, "dispose");
    const restore = matchNativeTravelMaterials(travel, native);
    expect(travelMesh.material).toBe(finalMaterial);
    restore();
    expect(travelMesh.material).toBe(temporary);
    expect(nativeMesh.material).toBe(finalMaterial);
    expect(dispose).not.toHaveBeenCalled();
});
test("missing optional high-quality meshes leave the loaded rig intact", () => {
    const travel = new THREE.Mesh();
    const original = travel.material;
    matchNativeTravelMaterials(travel, undefined)();
    expect(travel.material).toBe(original);
});
