import * as THREE from "three";
import {
    createTravelCameraResolver,
    advanceCompactTravelCamera,
    compactTravelCameraTarget,
    compactTravelAvatarFadeScale,
    orientTravelViewToHeading,
} from "./worldTravelCamera";
const anchor = { x: 0, y: 0, z: 0 };
const view = {
    cameraOffset: { x: 0, y: 2, z: 6 },
    cameraTargetOffset: { x: 0, y: 1.2, z: 0 },
    avatarRotation: 0,
    avatarLift: 0,
    avatarHeight: 1.8,
    fov: 60,
    cameraMode: "third-person" as const,
};
const lens = { near: 0.25, aspect: 1.6 };
function colliders(boxes: THREE.Box3[]) {
    return (ray: THREE.Ray) => {
        let distance = Infinity;
        for (const box of boxes) {
            const p = ray.intersectBox(box, new THREE.Vector3());
            if (p) distance = Math.min(distance, p.distanceTo(ray.origin));
        }
        return Number.isFinite(distance) ? { distance } : null;
    };
}
test("keeps a clear arrival offset exactly", () => {
    const resolver = createTravelCameraResolver(THREE, () => null);
    expect(resolver.resolve(anchor, view, lens).cameraOffset).toEqual(
        view.cameraOffset
    );
});
test("a door behind spawn cannot occlude the staged avatar", () => {
    const door = new THREE.Box3(
        new THREE.Vector3(-2, 0, 0.55),
        new THREE.Vector3(2, 5, 0.75)
    );
    const resolver = createTravelCameraResolver(THREE, colliders([door]));
    const result = resolver.resolve(anchor, view, lens);
    const target = new THREE.Vector3(
            result.cameraTargetOffset.x,
            result.cameraTargetOffset.y,
            result.cameraTargetOffset.z
        ),
        camera = new THREE.Vector3(
            result.cameraOffset.x,
            result.cameraOffset.y,
            result.cameraOffset.z
        );
    expect(camera.distanceTo(target)).toBeGreaterThan(1.4);
    const ray = new THREE.Ray(target, camera.clone().sub(target).normalize());
    const hit = ray.intersectBox(door, new THREE.Vector3());
    expect(
        hit === null || hit.distanceTo(target) > camera.distanceTo(target)
    ).toBe(true);
});
test("prefers a shortened clear view to a needless orbit", () => {
    const wall = new THREE.Box3(
        new THREE.Vector3(-20, 0, 3),
        new THREE.Vector3(20, 8, 3.2)
    );
    const result = createTravelCameraResolver(THREE, colliders([wall])).resolve(
        anchor,
        view,
        lens
    );
    expect(result.cameraOffset.x).toBeCloseTo(0);
    expect(result.cameraOffset.z).toBeGreaterThan(2);
    expect(result.cameraOffset.z).toBeLessThan(3);
});
test("near-plane corners cannot clip a door jamb missed by the centre ray", () => {
    const jamb = new THREE.Box3(
        new THREE.Vector3(0.15, 0, 2),
        new THREE.Vector3(0.35, 4, 2.3)
    );
    const resolver = createTravelCameraResolver(THREE, colliders([jamb]));
    const result = resolver.resolve(anchor, view, {
        ...lens,
        allowOrbit: false,
    });
    expect(result.cameraOffset.z).toBeLessThan(2);
});
test("handoff remains collision-safe through changing focus height without orbiting", () => {
    const wall = new THREE.Box3(
        new THREE.Vector3(-20, 0, 2),
        new THREE.Vector3(20, 8, 2.2)
    );
    const resolver = createTravelCameraResolver(THREE, colliders([wall]));
    for (let i = 0; i <= 10; i++) {
        const targetY = 1.2 + i * 0.18;
        const result = resolver.resolve(
            anchor,
            {
                ...view,
                cameraTargetOffset: { x: 0, y: targetY, z: 0 },
                cameraOffset: { x: 0, y: targetY + 0.8, z: 6 },
            },
            { ...lens, allowOrbit: false }
        );
        expect(result.cameraOffset.x).toBeCloseTo(0);
        expect(result.cameraOffset.z).toBeLessThan(2);
    }
});

test("multiple single-sided backfaces stop the camera at the wall nearest the avatar", () => {
    const triangles = [2, 4].map(
        (z) =>
            new THREE.Triangle(
                new THREE.Vector3(-20, -20, z),
                new THREE.Vector3(20, -20, z),
                new THREE.Vector3(0, 20, z)
            )
    );
    const resolver = createTravelCameraResolver(THREE, (ray) => {
        let distance = Infinity;
        for (const triangle of triangles) {
            const hit = ray.intersectTriangle(
                triangle.a,
                triangle.b,
                triangle.c,
                true,
                new THREE.Vector3()
            );
            if (hit) distance = Math.min(distance, hit.distanceTo(ray.origin));
        }
        return Number.isFinite(distance) ? { distance } : null;
    });
    const result = resolver.safeDistance(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 6 },
        { ...lens, fov: 60 }
    );
    expect(result).toBeCloseTo(1.9);
});
test("exhausted reverse-hit budget fails closed instead of crossing unchecked walls", () => {
    let calls = 0;
    const resolver = createTravelCameraResolver(THREE, (ray) => {
        calls++;
        return ray.direction.z < 0 ? { distance: 0.01 } : null;
    });
    expect(
        resolver.safeDistance(
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 0, z: 6 },
            { ...lens, fov: 60 }
        )
    ).toBe(0);
    expect(calls).toBeLessThan(30);
});

test("first-person focus beyond a front wall never pulls eyes through that wall", () => {
    const wall = new THREE.Box3(
        new THREE.Vector3(-20, 0, -0.6),
        new THREE.Vector3(20, 8, -0.5)
    );
    const resolver = createTravelCameraResolver(THREE, colliders([wall]));
    const firstView = {
        ...view,
        cameraMode: "first-person" as const,
        cameraOffset: { x: 0, y: 1.8, z: 0 },
        cameraTargetOffset: { x: 0, y: 1.8, z: -1 },
    };
    expect(resolver.resolve(anchor, firstView, lens)).toEqual(firstView);
    const clipped = resolver.resolve(
        anchor,
        {
            ...firstView,
            cameraOffset: { x: 0, y: 1.8, z: -1 },
            cameraTargetOffset: { x: 0, y: 1.8, z: -2 },
        },
        lens
    );
    expect(clipped.cameraOffset.z).toBeGreaterThan(-0.5);
    expect(clipped.cameraTargetOffset.z - clipped.cameraOffset.z).toBeCloseTo(
        -1
    );
});

test("arrival looks along the authored spawn heading while preserving on-screen framing", () => {
    const source = {
        ...view,
        cameraOffset: { x: 3, y: 2.5, z: -5 },
        cameraTargetOffset: { x: 1, y: 1.2, z: -1 },
        avatarRotation: 0.3,
    };
    const before = JSON.stringify(source);
    const heading = -Math.PI / 2;
    const result = orientTravelViewToHeading(source, heading);
    const camera = new THREE.Vector3(
        result.cameraOffset.x,
        result.cameraOffset.y,
        result.cameraOffset.z
    );
    const target = new THREE.Vector3(
        result.cameraTargetOffset.x,
        result.cameraTargetOffset.y,
        result.cameraTargetOffset.z
    );
    const sourceCamera = new THREE.Vector3(
        source.cameraOffset.x,
        source.cameraOffset.y,
        source.cameraOffset.z
    );
    const sourceTarget = new THREE.Vector3(
        source.cameraTargetOffset.x,
        source.cameraTargetOffset.y,
        source.cameraTargetOffset.z
    );
    const originalYaw = Math.atan2(
        sourceCamera.x - sourceTarget.x,
        sourceCamera.z - sourceTarget.z
    );
    const offset = camera.clone().sub(target);
    expect(Math.atan2(offset.x, offset.z)).toBeCloseTo(heading);
    expect(offset.length()).toBeCloseTo(sourceCamera.distanceTo(sourceTarget));
    expect(result.cameraOffset.y).toBe(source.cameraOffset.y);
    expect(Math.cos(result.avatarRotation - heading)).toBeCloseTo(
        Math.cos(source.avatarRotation - originalYaw)
    );
    expect(JSON.stringify(source)).toBe(before);
});

test("party spawn slots and cosmetic peers rotate together without changing their spacing", () => {
    const source = {
        ...view,
        spawnOffset: { x: 2, y: 0, z: 1 },
        peers: [
            {
                id: "friend",
                name: "Friend",
                offset: { x: -2, y: 0, z: 0 },
                rotation: 0,
            },
        ],
    };
    const result = orientTravelViewToHeading(source, Math.PI / 2);
    expect(result.spawnOffset.x).toBeCloseTo(1);
    expect(result.spawnOffset.z).toBeCloseTo(-2);
    expect(result.peers[0].offset.x).toBeCloseTo(0);
    expect(result.peers[0].offset.z).toBeCloseTo(2);
    expect(result.peers[0].rotation).toBeCloseTo(Math.PI / 2);
    expect(source.peers[0].offset.x).toBe(-2);
    expect(result.cameraMode).toBe("third-person");
});

test("first-person entry keeps its eyes anchored and aims into the space", () => {
    const firstView = {
        ...view,
        cameraMode: "first-person" as const,
        cameraOffset: { x: 0, y: 1.8, z: 0 },
        cameraTargetOffset: { x: 0, y: 1.8, z: -1 },
    };
    const result = orientTravelViewToHeading(firstView, Math.PI / 2);
    expect(result.cameraOffset).toEqual(firstView.cameraOffset);
    expect(result.cameraTargetOffset.x).toBeCloseTo(-1);
    expect(result.cameraTargetOffset.z).toBeCloseTo(0);
    expect(result.cameraMode).toBe("first-person");
});

test("missing or invalid spawn headings retain existing framing", () => {
    expect(orientTravelViewToHeading(view, undefined)).toBe(view);
    expect(orientTravelViewToHeading(view, NaN)).toBe(view);
    expect(orientTravelViewToHeading(view, Infinity)).toBe(view);
    expect(orientTravelViewToHeading(undefined, 1)).toBeUndefined();
});

const nativeFraming = {
    avatarHeight: 2.7,
    targetHeight: 3.1,
    radius: 6,
    heading: 0,
    fov: 65,
};
function projection(result) {
    const camera = new THREE.PerspectiveCamera(
        result.fov,
        lens.aspect,
        lens.near,
        1000
    );
    camera.position.copy(new THREE.Vector3().copy(result.cameraOffset));
    camera.lookAt(new THREE.Vector3().copy(result.cameraTargetOffset));
    camera.updateMatrixWorld(true);
    const feet = new THREE.Vector3().project(camera);
    const head = new THREE.Vector3(0, result.avatarHeight, 0).project(camera);
    return { feet, head };
}
test("compact room uses bounded shoulders and a native-size full-body composition", () => {
    const wall = new THREE.Box3(
        new THREE.Vector3(-20, -2, 2.4),
        new THREE.Vector3(20, 10, 2.6)
    );
    const result = createTravelCameraResolver(
        THREE,
        colliders([wall])
    ).cinematic(anchor, view, lens, nativeFraming);
    expect(result.profile).toBeDefined();
    expect(result.view.avatarHeight).toBe(2.7);
    expect(result.view.avatarLift).toBe(0);
    const camera = new THREE.Vector3(
        result.view.cameraOffset.x,
        result.view.cameraOffset.y,
        result.view.cameraOffset.z
    );
    const target = new THREE.Vector3(
        result.view.cameraTargetOffset.x,
        result.view.cameraTargetOffset.y,
        result.view.cameraTargetOffset.z
    );
    const orbit = camera.clone().sub(target);
    expect(Math.abs(Math.atan2(orbit.x, orbit.z))).toBeLessThanOrEqual(
        Math.PI / 6 + 1e-6
    );
    expect(camera.z).toBeLessThan(2.4);
    const { feet, head } = projection(result.view);
    expect(Math.abs(head.y - feet.y) / 2).toBeLessThan(0.82);
    expect(Math.abs(head.y)).toBeLessThan(1);
    expect(Math.abs(feet.y)).toBeLessThan(1);
    expect(Math.abs((head.x + feet.x) / 2)).toBeGreaterThan(0.1);
    expect(result.view.fov).toBeLessThanOrEqual(90);
});
test("compact shoulder cannot escape through a narrow corridor wall", () => {
    const boxes = [
        new THREE.Box3(
            new THREE.Vector3(-20, -2, 2.4),
            new THREE.Vector3(20, 10, 2.6)
        ),
        new THREE.Box3(
            new THREE.Vector3(-3, -2, -20),
            new THREE.Vector3(-0.7, 10, 20)
        ),
        new THREE.Box3(
            new THREE.Vector3(0.7, -2, -20),
            new THREE.Vector3(3, 10, 20)
        ),
    ];
    const result = createTravelCameraResolver(
        THREE,
        colliders(boxes)
    ).cinematic(anchor, view, lens, nativeFraming);
    const camera = new THREE.Vector3(
        result.view.cameraOffset.x,
        result.view.cameraOffset.y,
        result.view.cameraOffset.z
    );
    expect(camera.z).toBeLessThan(2.4);
    expect(Math.abs(camera.x)).toBeLessThan(0.7);
    expect(boxes.some((box) => box.containsPoint(camera))).toBe(false);
});
test("open scenes and first-person travel retain existing framing", () => {
    const resolver = createTravelCameraResolver(THREE, () => null);
    const open = resolver.cinematic(anchor, view, lens, nativeFraming);
    expect(open.profile).toBeUndefined();
    expect(open.view).toEqual(view);
    const first = { ...view, cameraMode: "first-person" as const };
    const result = resolver.cinematic(anchor, first, lens, nativeFraming);
    expect(result.profile).toBeUndefined();
    expect(result.view.cameraOffset).toEqual(first.cameraOffset);
    expect(result.view.cameraTargetOffset.y).toBeCloseTo(
        first.cameraTargetOffset.y
    );
    expect(result.view.cameraMode).toBe("first-person");
});
test("compact follow framing stays fixed by walls and recovers smoothly in open space", () => {
    const profile = {
        avatarHeight: 2.7,
        focusHeight: 1.674,
        sideOffset: 0.756,
        fov: 82,
        baseFov: 65,
        blend: 1,
    };
    for (let frame = 0; frame < 120; frame++)
        advanceCompactTravelCamera(profile, 2.4, 1 / 60);
    expect(profile.blend).toBe(1);
    const initial = compactTravelCameraTarget(profile, 3.1, Math.PI / 2);
    expect(initial.x).toBeCloseTo(0);
    expect(initial.z).toBeCloseTo(-0.756);
    expect(initial.y).toBeCloseTo(1.674);
    advanceCompactTravelCamera(profile, 6, 1 / 60);
    expect(profile.blend).toBeGreaterThan(0.95);
    expect(profile.blend).toBeLessThan(1);
    for (let frame = 0; frame < 180; frame++)
        advanceCompactTravelCamera(profile, 6, 1 / 60);
    const settled = compactTravelCameraTarget(profile, 3.1, Math.PI / 2);
    expect(settled.y).toBeCloseTo(3.1, 2);
    expect(settled.z).toBeCloseTo(0, 2);
    expect(settled.fov).toBeCloseTo(65, 1);
});

test("compact avatar fade follows the selected lens and retains a near-plane floor", () => {
    expect(compactTravelAvatarFadeScale()).toBe(1);
    expect(compactTravelAvatarFadeScale({ near: 0.1 })).toBe(1);
    expect(
        compactTravelAvatarFadeScale({ near: 0.1, travelFraming: { blend: 1 } })
    ).toBeCloseTo(0.45);
    expect(
        compactTravelAvatarFadeScale({
            near: 0.1,
            travelFraming: { blend: 0.5 },
        })
    ).toBeCloseTo(0.725);
    expect(
        compactTravelAvatarFadeScale({ near: 1, travelFraming: { blend: 1 } }) *
            1.5
    ).toBeCloseTo(1.15);
    expect(
        compactTravelAvatarFadeScale({ near: 2, travelFraming: { blend: 1 } })
    ).toBe(1);
});
