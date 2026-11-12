import * as THREE from "three";
import {
    resolveNativeTravelGroundedFeet,
    synchronizeNativeTravelGrounding,
} from "./nativeTravelGrounding";
import { OctreeCollisions } from "../camera/controls/physics/collisions/octreecollisions";

// Keep the real native collision step. Only the external Capsule container and
// octree construction dependencies are replaced; floor queries use the same
// capsule start/end/radius representation as the native collision backend.
jest.mock("../camera/controls/physics/lib/capsule", () => {
    const { Vector3 } = require("three");
    return {
        Capsule: class {
            constructor(
                public start = new Vector3(),
                public end = new Vector3(),
                public radius = 0.35
            ) {}
            clone() {
                return new (this.constructor as any)(
                    this.start.clone(),
                    this.end.clone(),
                    this.radius
                );
            }
            translate(offset) {
                this.start.add(offset);
                this.end.add(offset);
            }
        },
    };
});
jest.mock("@3constants", () => ({ CAPSULE_RADIUS: 0.35, USER_HEIGHT: 1.8 }), {
    virtual: true,
});
jest.mock(
    "@3factory/player",
    () => ({ main: { avatar3D: { headPosition: { y: 1.8 } } } }),
    { virtual: true }
);
jest.mock("@3factory/abstract/spaceitem", () => ({}), { virtual: true });
jest.mock("../camera/controls/physics/lib/topoctree", () => ({}));

function fixture(floorY = 3) {
    const collisions = new OctreeCollisions({
        position: new THREE.Vector3(1, 10, 2),
        roomParameters: {},
    }) as any;
    const query = jest.fn((capsule) => {
        const bottom = capsule.start.y - capsule.radius;
        if (bottom > floorY + 1e-10) return null;
        return {
            normal: new THREE.Vector3(0, 1, 0),
            depth: Math.max(0, floorY - bottom),
        };
    });
    collisions.worldOctree = { capsuleIntersect: query };
    const physics = {
        collisions,
        position: new THREE.Vector3(1, 8.2, 2),
        firstPersonPos: new THREE.Vector3(1, 10, 2),
        thirdPersonPos: new THREE.Vector3(1, 8.2, 2),
        shouldUseFirsPerson: () => false,
        playerState: {
            position: new THREE.Vector3(1, 8.2, 2),
            veclocity: new THREE.Vector3(0.2, -0.8, 0.1),
        },
    };
    return { physics, collisions, query };
}

test.each([2.961, 3.0267])(
    "an unfinished arrival fall from %s settles on the same nearby floor before staging",
    (height) => {
        const { physics, collisions, query } = fixture(2.9);
        const feet = new THREE.Vector3(4, height, 6);
        const originalFeet = feet.clone();
        const start = collisions.capsule.start.clone();
        const end = collisions.capsule.end.clone();
        const velocity = physics.playerState.veclocity.clone();
        const grounded = resolveNativeTravelGroundedFeet(physics, feet);
        expect(grounded.toArray()).toEqual([4, 2.9, 6]);
        expect(feet).toEqual(originalFeet);
        expect(collisions.capsule.start).toEqual(start);
        expect(collisions.capsule.end).toEqual(end);
        expect(physics.playerState.veclocity).toEqual(velocity);
        expect(query.mock.calls.length).toBeGreaterThan(1);
        const probe = query.mock.calls[0][0];
        expect(probe).not.toBe(collisions.capsule);
        expect(probe.radius).toBe(collisions.capsule.radius);
        expect(probe.start.x).toBe(4);
        expect(probe.start.z).toBe(6);
        expect(probe.end.y - probe.start.y + probe.radius).toBeCloseTo(1.8);
    }
);

test("a small existing floor penetration resolves upward using the native contact", () => {
    const { physics } = fixture(3);
    const grounded = resolveNativeTravelGroundedFeet(
        physics,
        new THREE.Vector3(4, 2.95, 6)
    );
    expect(grounded.toArray()).toEqual([4, 3, 6]);
});

test("a lower floor outside the bound is not used to relocate an authored spawn", () => {
    const { physics, collisions, query } = fixture(2);
    const feet = new THREE.Vector3(4, 3, 6);
    const end = collisions.capsule.end.clone();
    expect(resolveNativeTravelGroundedFeet(physics, feet)).toBeUndefined();
    expect(query).toHaveBeenCalledTimes(11);
    expect(feet.y).toBe(3);
    expect(collisions.capsule.end).toEqual(end);
});

test.each([
    { normal: new THREE.Vector3(1, 0, 0), depth: 0.1 },
    { normal: new THREE.Vector3(0, -1, 0), depth: 0.1 },
    { normal: new THREE.Vector3(0, NaN, 0), depth: 0.1 },
    { normal: new THREE.Vector3(0, 1, 0), depth: Infinity },
    { normal: new THREE.Vector3(0, 1, 0), depth: 0.5 },
])(
    "unsupported or excessive collision corrections leave staging unchanged: %p",
    (contact) => {
        const { physics, query } = fixture();
        query.mockReturnValue(contact);
        expect(
            resolveNativeTravelGroundedFeet(physics, new THREE.Vector3(4, 3, 6))
        ).toBeUndefined();
    }
);

test("exact zero-normal contact is probed slightly lower to find real support", () => {
    const { physics, query } = fixture();
    query.mockReturnValueOnce({ normal: new THREE.Vector3(), depth: 0 });
    expect(
        resolveNativeTravelGroundedFeet(physics, new THREE.Vector3(4, 3, 6)).y
    ).toBeCloseTo(3);
    expect(query).toHaveBeenCalledTimes(2);
});

test("the first resumed third-person collision preserves final feet instead of reusing stale capsule height", () => {
    const { physics, collisions } = fixture();
    const feet = new THREE.Vector3(4, 3, 6);
    const zero = new THREE.Vector3();
    // Regression reproduction: the native third-person step ignores feet.y.
    expect(
        collisions.playerCollitions(feet, zero, true).startPosition.y
    ).toBeCloseTo(8.2);
    expect(synchronizeNativeTravelGrounding(physics, feet)).toBe(true);
    expect(physics.playerState.position).toEqual(feet);
    expect(physics.position).toEqual(feet);
    expect(physics.thirdPersonPos).toEqual(feet);
    expect(physics.firstPersonPos.toArray()).toEqual([4, 4.8, 6]);
    expect(physics.playerState.veclocity.length()).toBe(0);
    const resumed = collisions.playerCollitions(
        physics.playerState.position,
        zero,
        true
    );
    expect(resumed.startPosition.toArray()).toEqual([4, 3, 6]);
    expect(resumed.endPosition.toArray()).toEqual([4, 4.8, 6]);
    expect(feet.toArray()).toEqual([4, 3, 6]);
});

test("first-person resumption gets matching head coordinates and uses current collider height", () => {
    const { physics, collisions } = fixture();
    physics.shouldUseFirsPerson = () => true;
    collisions.getColliderHeight = () => 2.2;
    const feet = new THREE.Vector3(4, 3, 6);
    synchronizeNativeTravelGrounding(physics, feet);
    expect(physics.playerState.position.toArray()).toEqual([4, 5.2, 6]);
    expect(physics.position.toArray()).toEqual([4, 5.2, 6]);
    expect(collisions.collider_height).toBe(2.2);
    const resumed = collisions.playerCollitions(
        physics.playerState.position,
        new THREE.Vector3(),
        false
    );
    expect(resumed.startPosition.toArray()).toEqual([4, 3, 6]);
    expect(resumed.endPosition.toArray()).toEqual([4, 5.2, 6]);
});

test("a third-person input aliased to the live target stays unchanged", () => {
    const { physics } = fixture();
    const feet = physics.playerState.position.set(4, 3, 6);
    synchronizeNativeTravelGrounding(physics, feet);
    expect(physics.playerState.position).toBe(feet);
    expect(feet.toArray()).toEqual([4, 3, 6]);
});

test("flight, missing colliders and invalid positions are untouched", () => {
    const { physics, collisions, query } = fixture();
    const feet = new THREE.Vector3(4, 3, 6);
    const end = collisions.capsule.end.clone();
    const velocity = physics.playerState.veclocity.clone();
    for (const value of [
        undefined,
        {},
        { ...physics, flymode: true },
        { ...physics, collisions: undefined },
    ]) {
        expect(resolveNativeTravelGroundedFeet(value, feet)).toBeUndefined();
        expect(synchronizeNativeTravelGrounding(value, feet)).toBe(false);
    }
    expect(
        synchronizeNativeTravelGrounding(physics, { x: 4, y: NaN, z: 6 })
    ).toBe(false);
    expect(query).not.toHaveBeenCalled();
    expect(collisions.capsule.end).toEqual(end);
    expect(physics.playerState.veclocity).toEqual(velocity);
});

test.each(["state", "scratch", "target"])(
    "a stale first-person mode with a live feet %s alias cannot lift the player by a collider height",
    (alias) => {
        const { physics, collisions } = fixture();
        physics.shouldUseFirsPerson = () => true;
        const feet = new THREE.Vector3(4, 3, 6);
        if (alias === "state") physics.playerState.position = feet;
        if (alias === "scratch") physics.position = feet;
        if (alias === "target") (physics as any).target = feet;
        const start = collisions.capsule.start.clone();
        const end = collisions.capsule.end.clone();
        const velocity = physics.playerState.veclocity.clone();
        expect(synchronizeNativeTravelGrounding(physics, feet)).toBe(false);
        expect(feet.toArray()).toEqual([4, 3, 6]);
        expect(collisions.capsule.start).toEqual(start);
        expect(collisions.capsule.end).toEqual(end);
        expect(physics.playerState.veclocity).toEqual(velocity);
    }
);
