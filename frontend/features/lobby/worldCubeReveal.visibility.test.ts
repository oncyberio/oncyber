import * as THREE from "three";
import { buildWorldCubeReveal, createWorldCubeReveal } from "./worldCubeReveal";

function fixture(mode: "reveal" | "dissolve") {
    const scene = new THREE.Scene();
    const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial()
    );
    // Native artwork backs use a custom GPU instance shader, not InstancedMesh.
    const backing = new THREE.Mesh(
        new THREE.InstancedBufferGeometry().copy(new THREE.BoxGeometry()),
        new THREE.ShaderMaterial()
    );
    const avatar = new THREE.Mesh(wall.geometry, wall.material);
    avatar.userData.worldRevealExclude = true;
    const panorama = new THREE.Mesh(wall.geometry, wall.material);
    const fog = new THREE.Fog(0x123456, 1, 10);
    const background = new THREE.Color(0x123456);
    scene.add(wall, backing, avatar, panorama);
    // Simulate a renderer hook that re-enables a backing for a mirror pass.
    const originalHook = jest.fn(function (this: unknown) {
        backing.visible = true;
        scene.background = background;
        scene.fog = fog;
    });
    scene.onBeforeRender = originalHook;
    const effect = createWorldCubeReveal(THREE, [scene], {
        scene,
        mode,
        anchor: { x: 0, y: 0, z: 0 },
        cellSize: 2,
        exclude: (object) => object === panorama,
    });
    const draw = () =>
        scene.onBeforeRender(null, scene, null, null, null, null);
    return {
        scene,
        wall,
        backing,
        avatar,
        panorama,
        originalHook,
        background,
        fog,
        effect,
        draw,
    };
}

test.each(["reveal", "dissolve"] as const)(
    "%s holds source visibility after native sorting and nested render passes without recomputing tiles",
    (mode) => {
        const f = fixture(mode);
        expect(f.effect.stats.skipped).toBe(1);
        f.effect.setProgress(0.5);
        const batch = f.scene
            .getObjectByName("native-world-cube-reveal")
            .children.find((object) =>
                object.name.startsWith("world-batch:")
            ) as THREE.Mesh;
        const positions = batch.geometry.getAttribute("position");
        const version = (positions as THREE.BufferAttribute).version;
        const data = Array.from(positions.array);
        for (let pass = 0; pass < 3; pass++) {
            f.wall.visible = f.backing.visible = true;
            f.draw();
            expect(f.wall.visible).toBe(false);
            expect(f.backing.visible).toBe(false);
            expect(f.avatar.visible).toBe(true);
            expect(f.panorama.visible).toBe(true);
            expect(f.scene.background).toBe(f.background);
            expect(f.scene.fog).toBe(f.fog);
        }
        expect(f.originalHook.mock.instances).toEqual([
            f.scene,
            f.scene,
            f.scene,
        ]);
        expect(f.originalHook.mock.calls[0]).toEqual([
            null,
            f.scene,
            null,
            null,
            null,
            null,
        ]);
        expect((positions as THREE.BufferAttribute).version).toBe(version);
        expect(Array.from(positions.array)).toEqual(data);
        f.effect.dispose();
        expect(f.scene.onBeforeRender).toBe(f.originalHook);
        expect(f.wall.visible).toBe(true);
        expect(f.backing.visible).toBe(true);
    }
);

test("departure leaves the intact scene alone, then hides backs through the final black hold", () => {
    const f = fixture("dissolve");
    f.wall.visible = false; // Engine culling must still work before departure.
    f.draw();
    expect(f.wall.visible).toBe(false);
    expect(f.backing.visible).toBe(true);
    for (const progress of [0.01, 1]) {
        f.effect.setProgress(progress);
        f.wall.visible = true;
        f.draw();
        expect(f.wall.visible).toBe(false);
        expect(f.backing.visible).toBe(false);
    }
    f.effect.dispose();
});

test("arrival releases visibility ownership once intact, including normal engine culling", () => {
    const f = fixture("reveal");
    f.draw();
    expect(f.backing.visible).toBe(false);
    f.effect.setProgress(1);
    expect(f.wall.visible).toBe(true);
    expect(f.backing.visible).toBe(true);
    f.wall.visible = false;
    f.draw();
    expect(f.wall.visible).toBe(false);
    expect(f.backing.visible).toBe(true);
    f.effect.dispose();
});

test("disposal leaves a newer scene hook installed and makes the old wrapper inert", () => {
    const f = fixture("dissolve");
    f.effect.setProgress(0.5);
    const captured = f.scene.onBeforeRender;
    const newer = jest.fn(function (this: unknown, ...args: any[]) {
        captured.apply(this, args);
    });
    f.scene.onBeforeRender = newer;
    f.effect.dispose();
    f.effect.dispose();
    expect(f.scene.onBeforeRender).toBe(newer);
    f.draw();
    expect(f.wall.visible).toBe(true);
    expect(f.backing.visible).toBe(true);
    expect(newer).toHaveBeenCalledTimes(1);
});

test.each(["reveal", "dissolve"] as const)(
    "%s holds late media descendants without suppressing the avatar or background and restores group visibility",
    (mode) => {
        const scene = new THREE.Scene();
        const media = new THREE.Group();
        const emptyStreams = new THREE.Group();
        const hiddenMedia = new THREE.Group();
        hiddenMedia.visible = false;
        const existing = new THREE.Mesh(
            new THREE.BoxGeometry(),
            new THREE.MeshBasicMaterial()
        );
        existing.name = "existing-artwork";
        media.add(existing);
        const avatar = new THREE.Object3D();
        const sky = new THREE.Object3D();
        scene.add(media, emptyStreams, hiddenMedia, avatar, sky);
        const effect = createWorldCubeReveal(
            THREE,
            [media, emptyStreams, hiddenMedia],
            {
                scene,
                mode,
                anchor: { x: 0, y: 0, z: 0 },
                hideRoots: [media, emptyStreams, hiddenMedia],
            }
        );
        expect(effect.stats.cells).toBeGreaterThan(0);
        expect(existing.visible).toBe(mode === "dissolve");
        const late = existing.clone();
        const video = existing.clone();
        late.visible = video.visible = true;
        media.add(late);
        emptyStreams.add(video);
        effect.setProgress(0.5);
        for (let pass = 0; pass < 3; pass++) {
            media.visible = emptyStreams.visible = true;
            scene.onBeforeRender(null, scene, null, null, null, null);
            expect(media.visible).toBe(false);
            expect(emptyStreams.visible).toBe(false);
            expect(hiddenMedia.visible).toBe(false);
            expect(avatar.visible).toBe(true);
            expect(sky.visible).toBe(true);
        }
        effect.setProgress(1);
        expect(media.visible).toBe(mode === "reveal");
        expect(emptyStreams.visible).toBe(mode === "reveal");
        effect.dispose();
        expect(media.visible).toBe(true);
        expect(emptyStreams.visible).toBe(true);
        expect(hiddenMedia.visible).toBe(false);
        expect(late.visible).toBe(true);
        expect(video.visible).toBe(true);
        expect(media.children).toContain(late);
        expect(emptyStreams.children).toContain(video);
    }
);

test("a sliced departure keeps the world on screen until its build commits", () => {
    const scene = new THREE.Scene();
    const material = new THREE.MeshBasicMaterial();
    const near = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    far.position.set(6, 0, 0);
    // A source the build cannot use is skipped (and hidden once it commits).
    const skipped = new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.ShaderMaterial()
    );
    scene.add(near, far, skipped);
    const build = buildWorldCubeReveal(THREE, [scene], {
        scene,
        mode: "dissolve",
        anchor: { x: 0, y: 0, z: 0 },
        cellSize: 2,
        radius: 18,
    });
    const container = () => scene.getObjectByName("native-world-cube-reveal");
    let step = build.next();
    let pauses = 0;
    while (!step.done) {
        pauses++;
        // Mid-build: nothing has vanished and no partial tiles are drawn.
        expect([near.visible, far.visible, skipped.visible]).toEqual([
            true,
            true,
            true,
        ]);
        expect(container()?.visible ?? false).toBe(false);
        step = build.next();
    }
    expect(pauses).toBeGreaterThan(0);
    const effect = step.value;
    // Committed and intact: the world is still exactly as it was.
    expect([near.visible, far.visible]).toEqual([true, true]);
    effect.setProgress(0.5);
    expect([near.visible, far.visible, skipped.visible]).toEqual([
        false,
        false,
        false,
    ]);
    expect(container().visible).toBe(true);
    effect.dispose();
    expect([near.visible, far.visible, skipped.visible]).toEqual([
        true,
        true,
        true,
    ]);
});
