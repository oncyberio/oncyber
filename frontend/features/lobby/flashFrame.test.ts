import * as THREE from "three";
import { createFlashFrame, flashFrameLayout } from "./flashFrame";

function meshes(root: THREE.Object3D) {
    const result: THREE.Mesh[] = [];
    root.traverse((object) => {
        if ((object as THREE.Mesh).isMesh) result.push(object as THREE.Mesh);
    });
    return result;
}

test.each([1, 16 / 9, 9 / 16, 4, 0.15])(
    "artwork ratio %s stays complete inside a bounded portrait or landscape frame",
    (aspect) => {
        const layout = flashFrameLayout(aspect);
        expect(Math.max(layout.width, layout.height)).toBeCloseTo(1.05);
        expect(layout.artworkWidth / layout.artworkHeight).toBeCloseTo(aspect);
        expect(layout.artworkWidth).toBeLessThan(layout.openingWidth);
        expect(layout.artworkHeight).toBeLessThan(layout.openingHeight);
        expect(layout.width - layout.openingWidth).toBeCloseTo(
            layout.border * 2
        );
        expect(layout.height - layout.openingHeight).toBeCloseTo(
            layout.border * 2
        );
        expect(layout.width).toBeGreaterThan(0.5);
        expect(layout.height).toBeGreaterThan(0.5);
    }
);

test("gold relief has real depth, finite geometry, a solid rear, and a modest draw budget", () => {
    const frame = createFlashFrame(THREE);
    const texture = new THREE.Texture();
    frame.setArtwork(texture);
    const geometryBounds = new THREE.Box3().setFromObject(frame.group);
    const size = geometryBounds.getSize(new THREE.Vector3());
    const center = geometryBounds.getCenter(new THREE.Vector3());
    expect(size.x).toBeLessThanOrEqual(1.051);
    expect(size.y).toBeLessThanOrEqual(1.051);
    expect(size.z).toBeGreaterThan(0.08);
    expect(size.z).toBeLessThan(0.12);
    expect(Math.abs(center.x)).toBeLessThan(0.001);
    expect(Math.abs(center.y)).toBeLessThan(0.001);
    expect(frame.stats.drawCalls).toBeLessThanOrEqual(6);
    expect(frame.stats.triangles).toBeLessThan(8000);
    expect(frame.stats.triangles).toBeGreaterThan(2000);
    // Four gold/backing batches, the artwork, and the pop-in burst ring.
    expect(meshes(frame.group)).toHaveLength(6);
    for (const mesh of meshes(frame.group)) {
        for (const name of ["position", "normal"]) {
            const values = mesh.geometry.getAttribute(name).array;
            expect(Array.from(values).every(Number.isFinite)).toBe(true);
        }
    }
    const backing = frame.group.getObjectByName(
        "flash-dark-backing"
    ) as THREE.Mesh;
    const normals = backing.geometry.getAttribute("normal");
    expect(Array.from(normals.array).some((value) => value < -0.99)).toBe(true);
    const artwork = frame.group.getObjectByName("flash-artwork") as THREE.Mesh;
    expect((artwork.material as THREE.Material).side).toBe(THREE.FrontSide);
    expect(artwork.position.z).toBeGreaterThan(geometryBounds.min.z);
    expect(artwork.position.z).toBeLessThan(geometryBounds.max.z);
    frame.dispose();
    texture.dispose();
});

test("changing artwork preserves UVs and borrowed textures while rebuilding only changed proportions", () => {
    const frame = createFlashFrame(THREE, { maxSize: 1 });
    const first = new THREE.Texture({
        width: 400,
        height: 800,
    } as HTMLImageElement);
    const second = new THREE.Texture({
        width: 1600,
        height: 900,
    } as HTMLImageElement);
    const firstDispose = jest.spyOn(first, "dispose");
    const secondDispose = jest.spyOn(second, "dispose");
    first.repeat.set(0.8, 0.7);
    first.offset.set(0.1, 0.2);
    const beforeGeometries = meshes(frame.group)
        .slice(0, 4)
        .map((mesh) => mesh.geometry);
    const retired = beforeGeometries.map((geometry) =>
        jest.spyOn(geometry, "dispose")
    );
    frame.setArtwork(first);
    expect(retired.every((spy) => spy.mock.calls.length === 1)).toBe(true);
    expect(frame.layout.artworkWidth / frame.layout.artworkHeight).toBeCloseTo(
        0.5
    );
    const portrait = meshes(frame.group)
        .slice(0, 4)
        .map((mesh) => mesh.geometry);
    frame.setArtwork(first, 0.5);
    expect(
        meshes(frame.group)
            .slice(0, 4)
            .map((mesh) => mesh.geometry)
    ).toEqual(portrait);
    frame.setArtwork(second);
    expect(frame.layout.artworkWidth / frame.layout.artworkHeight).toBeCloseTo(
        16 / 9
    );
    expect(first.repeat.toArray()).toEqual([0.8, 0.7]);
    expect(first.offset.toArray()).toEqual([0.1, 0.2]);
    const artwork = frame.group.getObjectByName("flash-artwork") as THREE.Mesh;
    expect(Array.from(artwork.geometry.getAttribute("uv").array)).toEqual([
        0, 1, 1, 1, 0, 0, 1, 0,
    ]);
    expect((artwork.material as THREE.MeshBasicMaterial).map).toBe(second);
    frame.dispose();
    expect(firstDispose).not.toHaveBeenCalled();
    expect(secondDispose).not.toHaveBeenCalled();
    first.dispose();
    second.dispose();
});

test("presentation stays local, resource disposal is once-only, and late artwork is ignored", () => {
    const frame = createFlashFrame(THREE);
    const parent = new THREE.Group();
    parent.add(frame.group);
    frame.group.position.set(2, 1.2, -3);
    frame.group.rotation.y = 0.7;
    frame.group.scale.setScalar(0.85);
    const texture = new THREE.Texture();
    frame.setArtwork(texture);
    const initial = meshes(frame.group);
    const geometries = initial.map((mesh) =>
        jest.spyOn(mesh.geometry, "dispose")
    );
    const materials = initial.map((mesh) =>
        jest.spyOn(mesh.material as THREE.Material, "dispose")
    );
    frame.setPresentation(0);
    expect(frame.group.children[0].visible).toBe(false);
    frame.setPresentation(0.05);
    // It pops from a point, overshoots, and settles with a quarter spin.
    expect(frame.group.children[0].scale.x).toBeLessThan(0.3);
    frame.setPresentation(0.5);
    expect(frame.group.children[0].visible).toBe(true);
    expect(frame.group.children[0].scale.x).toBeGreaterThan(1);
    expect(frame.group.children[0].scale.x).toBeLessThan(1.1);
    expect(frame.group.children[0].rotation.y).not.toBe(0);
    expect(frame.group.getObjectByName("flash-burst").visible).toBe(true);
    frame.setPresentation(1);
    expect(frame.group.children[0].scale.x).toBe(1);
    expect(frame.group.children[0].rotation.y).toBeCloseTo(0);
    expect(frame.group.getObjectByName("flash-burst").visible).toBe(false);
    expect(frame.group.position.toArray()).toEqual([2, 1.2, -3]);
    expect(frame.group.rotation.y).toBe(0.7);
    expect(frame.group.scale.x).toBe(0.85);
    frame.dispose();
    frame.dispose();
    frame.setArtwork(new THREE.Texture(), 2);
    frame.setPresentation(1);
    expect(parent.children).toEqual([]);
    expect(frame.group.children).toEqual([]);
    expect(geometries.every((spy) => spy.mock.calls.length === 1)).toBe(true);
    expect(materials.every((spy) => spy.mock.calls.length === 1)).toBe(true);
    texture.dispose();
});

test("invalid ratios and presentation inputs cannot create nonfinite geometry or a visible broken frame", () => {
    const frame = createFlashFrame(THREE, { maxSize: NaN });
    for (const ratio of [NaN, Infinity, -1, 0]) {
        frame.setArtwork(null, ratio);
        expect(frame.layout.aspectRatio).toBe(1);
        expect(Object.values(frame.layout).every(Number.isFinite)).toBe(true);
    }
    frame.setPresentation(NaN);
    expect(frame.group.children[0].visible).toBe(false);
    frame.setPresentation(3);
    expect(frame.group.children[0].scale.x).toBe(1);
    frame.dispose();
});
