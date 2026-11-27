/** @jest-environment node */
import * as THREE from "three/webgpu";
import {
    FAR_MIN_TRIANGLES,
    FAR_PIXELS,
    createFarMesh,
    drawFar,
} from "./crowdDetail";

test("a far mesh cuts big parts down and leaves small ones whole", async () => {
    const big = new THREE.SphereGeometry(0.15, 96, 64);
    const small = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const triangles = big.index.count / 3;
    expect(triangles).toBeGreaterThan(FAR_MIN_TRIANGLES);
    const far = await createFarMesh([big, small]);
    expect(far).not.toBeNull();
    expect(far.parts[1]).toBeNull();
    expect(far.parts[0].triangles).toBeLessThan(triangles * 0.7);
    expect(far.parts[0].index.length).toBe(far.parts[0].triangles * 3);
    // Every index still names a vertex of the part: it shares its buffers.
    const vertices = big.getAttribute("position").count;
    expect(Math.max(...far.parts[0].index)).toBeLessThan(vertices);
    expect(far.saved).toBe(triangles - far.parts[0].triangles);
    // Off by at most a few millimetres on a 30 cm sphere.
    expect(far.error).toBeGreaterThan(0);
    expect(far.error).toBeLessThan(0.01);
});

test("small avatars have no far mesh", async () => {
    expect(await createFarMesh([new THREE.BoxGeometry()])).toBeNull();
});

test("a visitor is drawn far once the error is under a pixel or two", () => {
    // 1 cm of error, a 50° view 1000 pixels tall: a pixel is 1 cm at ~10.7 m.
    const pixelAt = (d: number) =>
        (2 * d * Math.tan((25 * Math.PI) / 180)) / 1000;
    const switchAt = 0.01 / (FAR_PIXELS * pixelAt(1));
    expect(drawFar(0.01, switchAt * 0.95, 50, 1000)).toBe(false);
    expect(drawFar(0.01, switchAt * 1.05, 50, 1000)).toBe(true);
    // A taller view shows more, so it switches further off.
    expect(drawFar(0.01, switchAt * 1.05, 50, 2000)).toBe(false);
    expect(drawFar(0, 100, 50, 1000)).toBe(false);
    expect(drawFar(0.01, 100, 50, 0)).toBe(false);
});
