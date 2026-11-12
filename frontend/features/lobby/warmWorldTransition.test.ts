import { warmWorldTransition } from "./warmWorldTransition";
const THREE = require("three");
test("hidden and offscreen tile pipelines compile without exposing their staging pose", async () => {
    const scene = new THREE.Scene();
    const tiles = new THREE.Group();
    tiles.name = "native-world-cube-reveal";
    const mesh = new THREE.Mesh();
    mesh.visible = false;
    tiles.add(mesh);
    scene.add(tiles);
    let progress = 0;
    const seen = [];
    const finish = [];
    const renderer = {
        compileAsync: jest.fn(() => {
            seen.push([progress, mesh.visible, mesh.frustumCulled]);
            return new Promise((resolve) => finish.push(resolve));
        }),
    };
    const pending = warmWorldTransition(renderer, scene, {}, (value) => {
        progress = value;
    });
    expect(progress).toBe(0);
    expect(mesh.frustumCulled).toBe(true);
    finish.shift()();
    await Promise.resolve();
    await Promise.resolve();
    expect(seen).toEqual([
        [1, false, false],
        [0.5, true, false],
    ]);
    expect(progress).toBe(0);
    expect(mesh.visible).toBe(false);
    finish.shift()();
    await pending;
});
test("a failed shader restores presentation and cancellation does not compile another variant", async () => {
    let progress = 0;
    const abort = new AbortController();
    const compileAsync = jest.fn(async () => {
        abort.abort();
    });
    await expect(
        warmWorldTransition(
            { compileAsync },
            new THREE.Scene(),
            {},
            (p) => {
                progress = p;
            },
            abort.signal
        )
    ).rejects.toThrow();
    expect(compileAsync).toHaveBeenCalledTimes(1);
    expect(progress).toBe(0);
});
