// Walking over the ridge between two ground triangles must not drop the
// player. On terrain the edge two triangles share slopes, and over a strip
// beside it neither triangle's face is under the capsule's contact point:
// the edge itself has to hold it. The collision library looked for that
// edge in the wrong place (lib/capsule.js), found no floor, and the floor
// snap then settled the player 30 cm down for a frame before the next
// triangle pushed them back up: the camera jolted down and up.
//
// The two triangles are from the Starry Night world's ground (CL_C_Ground),
// where this was measured.
import {
    BufferGeometry,
    Float32BufferAttribute,
    Mesh,
    MeshBasicMaterial,
    PerspectiveCamera,
    Plane,
    Vector3,
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

const A = [20.14, -11.45, -0.53];
const C = [12.42, -9.51, -4.14];
/** The two ground triangles either side of the edge C-A. */
const NEAR = [[18.47, -11.2, 5.75], A, C];
const FAR = [A, [14.13, -10.21, -10.33], C];
/** Where the walk crosses: along -z at this x, over the edge at z = -2.14. */
const X = 16.7;

function ground() {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
        "position",
        new Float32BufferAttribute([...NEAR, ...FAR].flat(), 3)
    );
    const mesh = new Mesh(geometry, new MeshBasicMaterial());
    mesh.name = "ground";
    mesh.updateMatrixWorld(true);
    return mesh;
}

const planeOf = (triangle) =>
    new Plane().setFromCoplanarPoints(
        ...triangle.map((point) => new Vector3(...point))
    );
/**
 * The ground's height under a point. The two faces meet in a ridge, so each
 * one, carried on past the edge, is above the other: the ground is the lower.
 */
function surface(x, z) {
    return Math.min(
        ...[NEAR, FAR].map((triangle) => {
            const plane = planeOf(triangle);
            return (
                -(plane.normal.x * x + plane.normal.z * z + plane.constant) /
                plane.normal.y
            );
        })
    );
}

function world() {
    const camera = new PerspectiveCamera();
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
    physics.collisions.worldOctree.createStaticOcteee([ground()]);
    physics.playerState.position.set(X, surface(X, 1.5) + 3.2, 1.5);
    return physics;
}

describe("the edge between two ground triangles", () => {
    test("holds a capsule standing over it", () => {
        const { OctreeTriangle } = require("./lib/octreetriangle");
        const { Capsule } = require("./lib/capsule");
        const point = (p) => new Vector3(...p);
        const triangles = [NEAR, FAR].map(
            (t) => new OctreeTriangle(...t.map(point), "ground")
        );
        // Just on the far side of the edge, feet 5 cm into the ground.
        const feet = surface(X, -2.2) - 0.05;
        const capsule = new Capsule(
            new Vector3(X, feet + 0.55, -2.2),
            new Vector3(X, feet + 2.85, -2.2),
            0.55
        );
        const hits = triangles
            .map((triangle) => triangle.capsuleIntersect(capsule))
            .filter(Boolean);
        expect(hits.length).toBeGreaterThan(0);
        // It is pushed up and out, not sideways.
        for (const hit of hits) expect(hit.normal.y).toBeGreaterThan(0.9);
    });

    test.each([20, 60, 120])(
        "is walked over at %d fps without a drop",
        (fps) => {
            const physics = world();
            const state = physics.playerState;
            const dt = 1 / fps;
            let time = 0;
            for (let i = 0; i < fps; i++) physics.update(dt, (time += dt), 1);
            state.keyStates.KeyW = true;
            const heights = [];
            let offFloor = 0;
            for (let i = 0; i < fps * 8 && state.position.z > -5; i++) {
                physics.update(dt, (time += dt), 1);
                if (state.position.z > 0.5) continue;
                heights.push(state.position.y - surface(X, state.position.z));
                if (!state.playerOnFloor) offFloor++;
            }
            // It got across the edge (z = -2.14) and well beyond.
            expect(state.position.z).toBeLessThan(-4);
            // The head keeps its height above the ground all the way: over
            // the ridge it may ride a centimetre or two low, as a ball does
            // on an edge, and no more.
            const high = Math.max(...heights);
            const low = Math.min(...heights);
            expect(high - low).toBeLessThan(0.04);
            expect(offFloor).toBe(0);
        }
    );
});
