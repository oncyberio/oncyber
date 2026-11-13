// Running down a slope must keep the player on the floor: a lost contact
// that lasts longer than the avatar's airborne grace (0.18 s) swaps the run
// for the jump animation. Drives the real physics and collision code over a
// flat run-up that tips into a slope.
import {
    BufferGeometry,
    Float32BufferAttribute,
    Mesh,
    MeshBasicMaterial,
    PerspectiveCamera,
} from "three";

jest.mock(
    "@3constants",
    () => {
        const { Vector3 } = jest.requireActual("three");
        return {
            IS_FIRST_PERSON: false,
            IS_MOBILE: false,
            IS_VR: false,
            DEBUG: false,
            STATS: false,
            CAPSULE_RADIUS: 0.55,
            USER_HEIGHT: 2.8,
            DOWN_VECTOR: new Vector3(0, -1, 0),
        };
    },
    { virtual: true }
);
jest.mock("@3emitter", () => ({ on: jest.fn(), off: jest.fn() }), {
    virtual: true,
});
jest.mock("@3events", () => ({}), { virtual: true });
jest.mock("@3scene", () => ({ add: jest.fn() }), { virtual: true });
jest.mock("@3factory/abstract/spaceitem", () => ({ SpaceItem: class {} }), {
    virtual: true,
});
jest.mock("@3utils/three", () => ({ isMesh: (o) => !!o.isMesh }), {
    virtual: true,
});
jest.mock("@components/_3DExhibit-v2/three/utils/three", () => ({
    isMesh: (o) => !!o.isMesh,
}));
jest.mock("@components/_3DExhibit-v2/three/factory/player", () => {
    const { Vector3 } = jest.requireActual("three");
    return {
        main: {
            deactivated: false,
            isSitting: false,
            position: new Vector3(),
            avatar3D: { headPosition: { y: 2.85 } },
            update: () => {},
        },
    };
});
jest.mock(
    "@3factory/player",
    () => jest.requireMock("@components/_3DExhibit-v2/three/factory/player"),
    { virtual: true }
);
jest.mock("../../constants", () => {
    const { Vector3 } = jest.requireActual("three");
    return {
        DIRECTION: {
            FORWARD: new Vector3(0, 0, 1),
            BACKWARD: new Vector3(0, 0, -1),
            LEFT: new Vector3(1, 0, 0),
            RIGHT: new Vector3(-1, 0, 0),
        },
    };
});
jest.mock("@components/_3DExhibit-v2/three/utils/camera", () => {
    const { Vector3, Euler } = jest.requireActual("three");
    return {
        getUserInitialPositions: () => ({
            capsuleRadius: 0.55,
            colliderHeight: 2.85,
            userHeight: 2.85,
            cameraPos: new Vector3(0, 2.85, 0),
            cameraRot: new Euler(),
        }),
    };
});

const { Physics } = require("./index");
const { OctreeCollisions } = require("./collisions/octreecollisions");
const { TopOctree } = require("./lib/topoctree");

const AIRBORNE_GRACE = 0.18;

/** Flat floor from z=10 to z=-5, then a slope down to z=-60 in 1-unit strips. */
function slopeFloor(degrees) {
    const t = Math.tan((degrees * Math.PI) / 180);
    const pos = [];
    const strip = (z0, y0, z1, y1) =>
        pos.push(
            ...[-20, y0, z0, 20, y0, z0, -20, y1, z1],
            ...[-20, y1, z1, 20, y0, z0, 20, y1, z1]
        );
    strip(10, 0, -5, 0);
    for (let i = 0; i < 55; i++) strip(-5 - i, -i * t, -6 - i, -(i + 1) * t);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(pos, 3));
    const mesh = new Mesh(geometry, new MeshBasicMaterial());
    mesh.name = "floor";
    mesh.updateMatrixWorld(true);
    return mesh;
}

function world(degrees) {
    const camera = new PerspectiveCamera();
    camera.position.set(0, 2.85, 0);
    const physics = new Physics({
        camera,
        roomParameters: {},
        space: { bbox: { min: { y: -1000 } } },
    });
    physics.collisions = new OctreeCollisions({
        position: camera.position,
        space: {},
    });
    physics.collisions.worldOctree = new TopOctree();
    physics.collisions.worldOctree.createStaticOcteee([slopeFloor(degrees)]);
    physics.playerState.position.set(0, 0.6, 0);
    return physics;
}

/** Longest stretch off the floor on the slope (past the crest), in seconds. */
function longestAirTime(degrees, fps, sprint) {
    const physics = world(degrees);
    const state = physics.playerState;
    const dt = 1 / fps;
    let time = 0;
    for (let i = 0; i < fps; i++) physics.update(dt, (time += dt), 1);
    state.keyStates.KeyW = true;
    if (sprint) state.keyStates.ShiftLeft = true;
    let air = 0,
        longest = 0;
    for (let i = 0; i < fps * 6 && state.position.z > -55; i++) {
        physics.update(dt, (time += dt), 1);
        if (state.position.z > -6) continue;
        air = state.playerOnFloor ? 0 : air + dt;
        longest = Math.max(longest, air);
    }
    expect(state.position.z).toBeLessThan(-30);
    return longest;
}

describe.each([15, 30, 45])("running down a %d degree slope", (degrees) => {
    test.each([
        [30, false],
        [60, false],
        [60, true],
        [120, true],
    ])("at %d fps (sprint %s) stays on the floor", (fps, sprint) => {
        expect(longestAirTime(degrees, fps, sprint)).toBeLessThan(
            AIRBORNE_GRACE
        );
    });
});

test("a jump still leaves the floor", () => {
    const physics = world(30);
    const state = physics.playerState;
    const dt = 1 / 60;
    let time = 0;
    for (let i = 0; i < 60; i++) physics.update(dt, (time += dt), 1);
    state.keyStates.Space = true;
    let air = 0;
    for (let i = 0; i < 30; i++) {
        physics.update(dt, (time += dt), 1);
        if (!state.playerOnFloor) air += dt;
    }
    expect(air).toBeGreaterThan(0.3);
});

// The feet must follow the slope every frame. A ground snap that only finds
// the floor in coarse steps lets the player hover, then drop a step at a
// time, which shakes the camera all the way down a hill.
describe.each([10, 30])("walking down a %d degree slope", (degrees) => {
    test("descends smoothly, frame by frame", () => {
        const physics = world(degrees);
        const state = physics.playerState;
        const dt = 1 / 60;
        let time = 0;
        for (let i = 0; i < 60; i++) physics.update(dt, (time += dt), 1);
        state.keyStates.KeyW = true;
        const drops = [];
        for (let i = 0; i < 240 && state.position.z > -50; i++) {
            const y = state.position.y;
            physics.update(dt, (time += dt), 1);
            // steady state on the slope, a few strides past the crest
            if (state.position.z < -9) drops.push(y - state.position.y);
        }
        expect(state.position.z).toBeLessThan(-20);
        const mean = drops.reduce((a, b) => a + b, 0) / drops.length;
        const worst = Math.max(...drops.map((d) => Math.abs(d - mean)));
        expect(mean).toBeGreaterThan(0);
        expect(worst).toBeLessThan(0.01);
    });
});

describe("spawn on the floor", () => {
    const { Vector3 } = jest.requireActual("three");

    test("a spawn above the floor lands standing on it", () => {
        const physics = world(30);
        const spawn = new Vector3(0, 8, 0);

        expect(physics.placeOnFloor(spawn)).toBe(true);
        expect(spawn.y).toBeCloseTo(2.86, 2);
    });

    test("a spawn just under a slope is lifted onto it", () => {
        const physics = world(30);
        const floorY = -15.5 * Math.tan(Math.PI / 6);
        const spawn = new Vector3(0, floorY + 2.6, -20.5);

        expect(physics.placeOnFloor(spawn)).toBe(true);
        expect(spawn.y).toBeCloseTo(floorY + 2.86, 1);
    });

    test("a spawn with no floor under it is left alone", () => {
        const physics = world(30);
        const spawn = new Vector3(100, 8, 0);

        expect(physics.placeOnFloor(spawn)).toBe(false);
        expect(spawn.y).toBe(8);
    });
});
