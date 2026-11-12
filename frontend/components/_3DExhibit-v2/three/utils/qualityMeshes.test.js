import { Object3D, Scene } from "three";
import { syncQualityMeshes } from "./qualityMeshes";

function world() {
    const scene = new Scene();
    scene.reflector = new Object3D();
    scene.water = new Object3D();
    scene.add(scene.reflector, scene.water, new Object3D());
    return scene;
}

test("each frame leaves the scene graph alone when nothing has to move", () => {
    const scene = world();
    const order = [...scene.children];
    const events = jest.fn();
    scene.reflector.addEventListener("added", events);
    scene.water.addEventListener("removed", events);
    for (let frame = 0; frame < 60; frame++) syncQualityMeshes(scene, false);
    expect(scene.children).toEqual(order);
    expect(events).not.toHaveBeenCalled();
});

test("low quality takes the reflector and visible water out; others put them back", () => {
    const scene = world();
    syncQualityMeshes(scene, true);
    expect(scene.reflector.parent).toBeNull();
    expect(scene.water.parent).toBeNull();
    syncQualityMeshes(scene, true);
    syncQualityMeshes(scene, false);
    expect(scene.reflector.parent).toBe(scene);
    expect(scene.water.parent).toBe(scene);
});

test("hidden water is neither added nor removed, as before", () => {
    const scene = world();
    scene.water.visible = false;
    syncQualityMeshes(scene, true);
    expect(scene.water.parent).toBe(scene);
    scene.remove(scene.water);
    syncQualityMeshes(scene, false);
    expect(scene.water.parent).toBeNull();
});

test("a reflector held by another parent is brought back to the scene", () => {
    const scene = world();
    const other = new Object3D();
    other.add(scene.reflector);
    syncQualityMeshes(scene, false);
    expect(scene.reflector.parent).toBe(scene);
    expect(() => syncQualityMeshes(null, false)).not.toThrow();
});
