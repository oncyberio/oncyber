import * as THREE from "three";
import { createWorldCubeReveal } from "./worldCubeReveal";
import { createWorldTransitionMedia } from "./worldTransitionMedia";
import {
    clearWorldTransitionCache,
    rememberWorldTransition,
    takeWorldTransition,
} from "./worldTransitionCache";

const effects: Array<{ dispose(): void }> = [];
const settings = {
    anchor: { x: 0, y: 0, z: 0 },
    cellSize: 1,
    coverage: "all" as const,
    radius: 18,
};
function surface(width = 2, height = 2) {
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial()
    );
    mesh.position.set(3, 2, -4);
    return mesh;
}
function latestContainer(scene: THREE.Scene) {
    return scene.children
        .filter((child) => child.name === "native-world-cube-reveal")
        .at(-1);
}
function tileBounds(container: THREE.Object3D) {
    const bounds = new THREE.Box3();
    const vertex = new THREE.Vector3();
    for (const child of container.children) {
        if (!child.name.startsWith("world-batch:")) continue;
        const geometry = (child as THREE.Mesh).geometry;
        const position = geometry.attributes.position;
        for (const range of geometry.userData.worldRevealRanges)
            for (let i = range.start; i < range.start + range.count; i++)
                bounds.expandByPoint(vertex.fromBufferAttribute(position, i));
    }
    return bounds.getSize(new THREE.Vector3());
}

afterEach(() => {
    clearWorldTransitionCache();
    for (const effect of effects.splice(0)) effect.dispose();
    jest.restoreAllMocks();
});

test("video geometry and material replacements rebuild the current media without invalidating parked room buffers", () => {
    const scene = new THREE.Scene();
    const room = new THREE.Group();
    const media = new THREE.Group();
    const wall = surface(8, 5);
    const video = surface();
    video.position.z = -3.9;
    room.add(wall);
    media.add(video);
    scene.add(room, media);
    const roomEffect = createWorldCubeReveal(THREE, [room], {
        ...settings,
        scene,
    });
    effects.push(roomEffect);
    const roomContainer = latestContainer(scene);
    const roomBatch = roomContainer.children.find((child) =>
        child.name.startsWith("world-batch:")
    ) as THREE.Mesh;
    const roomGeometry = roomBatch.geometry;
    const roomArray = roomGeometry.attributes.position.array;
    roomEffect.setProgress(1);
    expect(
        rememberWorldTransition(room, roomEffect, {
            cellSize: 1,
            triangleBudget: 120000,
            refinement: undefined,
        })
    ).toBe(true);
    const arrival = createWorldTransitionMedia(THREE, [media], {
        ...settings,
        scene,
    });
    effects.push(arrival);
    arrival.setProgress(1);
    expect(tileBounds(latestContainer(scene)).x).toBeCloseTo(2);
    arrival.dispose();
    // Posterless video decoding can retire the loading plane and its material.
    video.geometry.dispose();
    video.geometry = new THREE.PlaneGeometry(4, 2);
    video.material = new THREE.MeshBasicMaterial({ map: new THREE.Texture() });
    const roomCached = takeWorldTransition(room);
    expect(roomCached?.effect).toBe(roomEffect);
    expect(
        roomCached.effect.restart({
            mode: "dissolve",
            direction: "inward",
            anchor: settings.anchor,
        })
    ).toBe(true);
    const departure = createWorldTransitionMedia(THREE, [media], {
        ...settings,
        scene,
        mode: "dissolve",
        direction: "inward",
    });
    effects.push(departure);
    const current = latestContainer(scene);
    const size = tileBounds(current);
    expect(size.x).toBeCloseTo(4);
    expect(size.y).toBeCloseTo(2);
    const videoBatch = current.children.find((child) =>
        child.name.startsWith("world-batch:")
    ) as THREE.Mesh;
    expect(videoBatch.material).toBe(video.material);
    expect(roomBatch.geometry).toBe(roomGeometry);
    expect(roomGeometry.attributes.position.array).toBe(roomArray);
    expect(roomEffect.stats.skipped).toBe(0);
    expect(departure.stats.skipped).toBe(0);
    departure.setProgress(0.5);
    expect(media.visible).toBe(false);
    departure.dispose();
    expect(media.visible).toBe(true);
    expect(video.geometry.parameters.width).toBe(4);
});

test.each(["reveal", "dissolve"] as const)(
    "empty %s roots hide late children and restore their original visibility without touching sky",
    (mode) => {
        const scene = new THREE.Scene();
        const media = new THREE.Group();
        const hiddenMedia = new THREE.Group();
        hiddenMedia.visible = false;
        const background = new THREE.Color("#203040");
        const fog = new THREE.Fog("#203040", 1, 60);
        const hook = jest.fn();
        scene.background = background;
        scene.fog = fog;
        scene.onBeforeRender = hook;
        scene.add(media, hiddenMedia);
        const effect = createWorldTransitionMedia(THREE, [media, hiddenMedia], {
            ...settings,
            scene,
            mode,
        });
        effects.push(effect);
        expect(effect.stats.cells).toBe(0);
        expect(latestContainer(scene)).toBeUndefined();
        expect(media.visible).toBe(mode === "dissolve");
        const lateVideo = surface();
        media.add(lateVideo);
        effect.setProgress(0.5);
        effect.setRevealAnchor({ x: 2, y: 0, z: -1 }, 30);
        expect(media.visible).toBe(false);
        expect(hiddenMedia.visible).toBe(false);
        expect(lateVideo.visible).toBe(true);
        effect.setProgress(1);
        expect(media.visible).toBe(mode === "reveal");
        effect.dispose();
        effect.dispose();
        expect(media.visible).toBe(true);
        expect(hiddenMedia.visible).toBe(false);
        expect(media.children).toContain(lateVideo);
        expect(scene.background).toBe(background);
        expect(scene.fog).toBe(fog);
        expect(scene.onBeforeRender).toBe(hook);
    }
);

test.each(["outward", "inward"] as const)(
    "shared wave extent keeps separately prepared media and room cells synchronized %s",
    (direction) => {
        const scene = new THREE.Scene();
        const room = new THREE.Group();
        const media = new THREE.Group();
        const near = surface();
        const far = surface();
        far.position.x = 24;
        room.add(near, far);
        media.add(surface());
        scene.add(room, media);
        const roomEffect = createWorldCubeReveal(THREE, [room], {
            ...settings,
            scene,
            mode: "dissolve",
            direction,
        });
        effects.push(roomEffect);
        const roomSchedule =
            latestContainer(scene).userData.worldRevealSchedule;
        const independent = createWorldTransitionMedia(THREE, [media], {
            ...settings,
            scene,
            mode: "dissolve",
            direction,
        });
        effects.push(independent);
        const independentSchedule =
            latestContainer(scene).userData.worldRevealSchedule;
        independent.dispose();
        const synchronized = createWorldTransitionMedia(THREE, [media], {
            ...settings,
            scene,
            mode: "dissolve",
            direction,
            waveExtent: roomEffect.stats.maxDistance,
        });
        effects.push(synchronized);
        const schedule = latestContainer(scene).userData.worldRevealSchedule;
        expect(schedule.length).toBeGreaterThan(0);
        for (const step of schedule) {
            const roomStep = roomSchedule.find(
                (other) => other.key === step.key
            );
            expect(roomStep).toBeDefined();
            expect(step.distance).toBeCloseTo(roomStep.distance, 10);
            expect(step.delay).toBeCloseTo(roomStep.delay, 10);
        }
        expect(
            schedule.some(
                (step, index) =>
                    Math.abs(step.delay - independentSchedule[index].delay) >
                    0.1
            )
        ).toBe(true);
    }
);

test.each(["reveal", "dissolve"] as const)(
    "populated %s media leaves the current scene background and fog owned by the room effect",
    (mode) => {
        const scene = new THREE.Scene();
        const media = new THREE.Group();
        media.add(surface());
        scene.add(media);
        const initialBackground = new THREE.Color("#123456");
        const initialFog = new THREE.Fog("#123456", 2, 70);
        scene.background = initialBackground;
        scene.fog = initialFog;
        const effect = createWorldTransitionMedia(THREE, [media], {
            ...settings,
            scene,
            mode,
        });
        effects.push(effect);
        expect(effect.stats.cells).toBeGreaterThan(0);
        expect(scene.background).toBe(initialBackground);
        expect(scene.fog).toBe(initialFog);
        for (const progress of [0, 0.4, 1]) {
            // The room or sky effect can replace these between media updates.
            const background = new THREE.Color().setRGB(progress, 0.3, 0.5);
            const fog =
                progress === 0.4 ? null : new THREE.Fog("#345678", 1, 50);
            scene.background = background;
            scene.fog = fog;
            effect.setProgress(progress);
            expect(scene.background).toBe(background);
            expect(scene.fog).toBe(fog);
            effect.setRevealAnchor({ x: 2, y: 0, z: -1 }, 30);
            expect(scene.background).toBe(background);
            expect(scene.fog).toBe(fog);
        }
        const finalBackground = new THREE.Color("#aabbcc");
        const finalFog = new THREE.Fog("#aabbcc", 3, 90);
        scene.background = finalBackground;
        scene.fog = finalFog;
        effect.dispose();
        effect.dispose();
        expect(scene.background).toBe(finalBackground);
        expect(scene.fog).toBe(finalFog);
    }
);

test("moving the staged arrival anchor realigns media with the room wave without recutting buffers", () => {
    const scene = new THREE.Scene();
    const room = new THREE.Group();
    const media = new THREE.Group();
    const near = surface();
    const far = surface();
    far.position.x = 24;
    room.add(near, far);
    media.add(surface());
    scene.add(room, media);
    const roomEffect = createWorldCubeReveal(THREE, [room], {
        ...settings,
        scene,
    });
    effects.push(roomEffect);
    const roomContainer = latestContainer(scene);
    const mediaEffect = createWorldTransitionMedia(THREE, [media], {
        ...settings,
        scene,
        waveExtent: roomEffect.stats.maxDistance,
    });
    effects.push(mediaEffect);
    const mediaContainer = latestContainer(scene);
    const batch = mediaContainer.children.find((child) =>
        child.name.startsWith("world-batch:")
    ) as THREE.Mesh;
    const geometry = batch.geometry;
    const array = geometry.attributes.position.array;
    const before = mediaContainer.userData.worldRevealSchedule;
    const shiftedAnchor = { x: -4, y: 0, z: 7 };
    roomEffect.setRevealAnchor(shiftedAnchor);
    mediaEffect.setRevealAnchor(shiftedAnchor, roomEffect.stats.maxDistance);
    const after = mediaContainer.userData.worldRevealSchedule;
    expect(after.length).toBeGreaterThan(0);
    expect(
        after.some(
            (step, index) =>
                Math.abs(step.distance - before[index].distance) > 1
        )
    ).toBe(true);
    for (const step of after) {
        const roomStep = roomContainer.userData.worldRevealSchedule.find(
            (other) => other.key === step.key
        );
        expect(roomStep).toBeDefined();
        expect(step.distance).toBeCloseTo(roomStep.distance, 10);
        expect(step.delay).toBeCloseTo(roomStep.delay, 10);
    }
    expect(batch.geometry).toBe(geometry);
    expect(geometry.attributes.position.array).toBe(array);
});
