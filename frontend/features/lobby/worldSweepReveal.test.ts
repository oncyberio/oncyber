/** @jest-environment jsdom */
import * as THREE from "three/webgpu";
import {
    createWorldSweepReveal,
    readWorldRevealStyle,
} from "./worldSweepReveal";

const room = () => {
    const root = new THREE.Group();
    const floor = new THREE.Mesh(
        new THREE.BoxGeometry(20, 0.1, 20),
        new THREE.MeshStandardNodeMaterial({ color: 0x336699 })
    );
    const far = new THREE.Points(
        new THREE.BufferGeometry().setAttribute(
            "position",
            new THREE.Float32BufferAttribute([9, 1, 0], 3)
        ),
        new THREE.PointsMaterial()
    );
    const avatar = new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.MeshStandardNodeMaterial()
    );
    root.add(floor, far, avatar);
    root.updateMatrixWorld(true);
    return { root, floor, far, avatar };
};

test("swaps world materials for sweep clones and restores them", () => {
    const { root, floor, avatar } = room();
    const original = floor.material;
    const effect = createWorldSweepReveal({
        THREE,
        roots: [root],
        anchor: { x: 0, y: 0, z: 0 },
        exclude: (object) => object === avatar,
    });
    expect(floor.material).not.toBe(original);
    expect((floor.material as any).opacityNode).toBeTruthy();
    expect((floor.material as any).color.getHex()).toBe(0x336699);
    expect(avatar.material).not.toBe(floor.material);
    expect(effect.stats.maxDistance).toBeGreaterThan(13);
    effect.park();
    expect(floor.material).toBe(original);
    effect.dispose();
});

test("objects that can't take the shader appear as the front passes", () => {
    const { root, far } = room();
    const effect = createWorldSweepReveal({
        THREE,
        roots: [root],
        anchor: { x: 0, y: 0, z: 0 },
    });
    expect(far.visible).toBe(false);
    effect.setProgress(0.2);
    expect(far.visible).toBe(false);
    effect.setProgress(1);
    expect(far.visible).toBe(true);
    effect.dispose();
    expect(far.visible).toBe(true);
});

test("dissolve hides the far side first", () => {
    const { root, far } = room();
    const effect = createWorldSweepReveal({
        THREE,
        roots: [root],
        anchor: { x: 0, y: 0, z: 0 },
        mode: "dissolve",
    });
    expect(far.visible).toBe(true);
    effect.setProgress(0.6);
    expect(far.visible).toBe(false);
    effect.dispose();
});

test("cube reveals are default and the sweep remains opt-in", () => {
    expect(readWorldRevealStyle()).toBe("tiles");
    window.history.replaceState(null, "", "/?travel=sweep");
    expect(readWorldRevealStyle()).toBe("sweep");
    window.history.replaceState(null, "", "/?reveal=tiles");
    expect(readWorldRevealStyle()).toBe("tiles");
    window.history.replaceState(null, "", "/");
    window.sessionStorage.clear();
});

test("classic glTF-style materials are converted so they sweep too", () => {
    const root = new THREE.Group();
    const wall = new THREE.Mesh(
        new THREE.BoxGeometry(4, 3, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x884422, roughness: 0.4 })
    );
    root.add(wall);
    root.updateMatrixWorld(true);
    const original = wall.material;
    const effect = createWorldSweepReveal({
        THREE,
        roots: [root],
        anchor: { x: 0, y: 0, z: 0 },
    });
    const swept = wall.material as any;
    expect(swept).not.toBe(original);
    expect(swept.isMeshStandardNodeMaterial).toBe(true);
    expect(swept.color.getHex()).toBe(0x884422);
    expect(swept.roughness).toBe(0.4);
    expect(swept.opacityNode).toBeTruthy();
    expect(effect.stats.coarse).toBe(0);
    effect.dispose();
    expect(wall.material).toBe(original);
});
