/** @jest-environment node */
import {
    BufferAttribute,
    BufferGeometry,
    Group,
    InstancedMesh,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    Quaternion,
    Vector3,
} from "three/webgpu";
import type { Vec3 } from "../../../paintedSurface/painter";
import type { WorldSceneContext } from "../../../types";
import { DOOR_RULES } from "./door";
import { DOOR, HOUSE, SHELL, houseToWorld } from "./layout";
import { openHouse, type HouseSurroundings } from "./openHouse";

const MODEL_SCALE = 0.01;

/** A geometry of loose triangles, given in the house's frame. */
function triangles(points: number[][], scale = 1) {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
        "position",
        new BufferAttribute(
            new Float32Array(points.flat().map((v) => v / scale)),
            3
        )
    );
    return geometry;
}

/** A wall triangle outside the room, and the panel behind the door. */
const WALL = [
    [-4.68, 0, 5.95],
    [4.68, 0, 5.95],
    [0, 9.7, 5.95],
];
const PANEL = [
    [-2.6, -0.5, 4.4],
    [2.6, -0.5, 4.4],
    [0, 5.4, 4.4],
];
const OUTLINE = [
    [-4.9, 0, 6.2],
    [-4.9, 6, 6.2],
    [-4.9, 6, -6.2],
];

function world({ portalIds = [] as string[], at = HOUSE.at } = {}) {
    const scene = new Group();
    const model = new Group();
    scene.add(model);
    const part = (name: string, points: number[][]) => {
        const material = new MeshBasicMaterial();
        material.name = name;
        const mesh = new InstancedMesh(
            triangles(points, MODEL_SCALE),
            material,
            2
        );
        // one copy somewhere else, one where the house stands
        mesh.setMatrixAt(0, new Matrix4().makeTranslation(500, 0, 500));
        mesh.setMatrixAt(
            1,
            new Matrix4().compose(
                new Vector3(...at),
                new Quaternion().setFromAxisAngle(
                    new Vector3(0, 1, 0),
                    HOUSE.yaw
                ),
                new Vector3(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE)
            )
        );
        model.add(mesh);
        return mesh;
    };
    const walls = part(HOUSE.walls, [...WALL, ...PANEL]);
    const outlines = part("Near black", OUTLINE);
    const door = new Group();
    door.name = HOUSE.door;
    scene.add(door);

    // the collision, in the world: a piece of front wall and the passage's end
    const { left, right, top, back } = SHELL.passage;
    const collision = new Mesh(
        triangles(
            [
                [right, 0, 6.2],
                [4.9, 0, 6.2],
                [4.9, 12, 6.2],
                [left, 0, back],
                [right, 0, back],
                [right, top, back],
            ].map((p) => [...houseToWorld(p as [number, number, number])])
        ),
        new MeshBasicMaterial()
    );
    collision.name = "CL_C_House";
    const colliders = [collision];

    let frame: (seconds: number) => void = () => {};
    let visitor: Vec3 | null = null;
    const stop = jest.fn();
    const disposers: Array<() => void> = [];
    const surroundings: HouseSurroundings = {
        onFrame: (callback) => {
            frame = callback;
            return stop;
        },
        visitor: (into) => {
            if (visitor) into.set(...visitor);
            return visitor !== null;
        },
        redraw: jest.fn(),
    };
    const context: WorldSceneContext = {
        slug: "thestarrynight_skydome",
        scene,
        colliders,
        portalIds,
        mobile: false,
        onDispose: (dispose) => disposers.push(dispose),
    };
    return {
        scene,
        walls,
        outlines,
        door,
        collision,
        colliders,
        context,
        surroundings,
        stop,
        disposers,
        standAt: (p: [number, number, number]) => (visitor = houseToWorld(p)),
        run: (seconds: number) => {
            for (let t = 0; t < seconds; t += 0.05) frame(0.05);
        },
    };
}

const scaleOf = (mesh: InstancedMesh, copy: number) => {
    const matrix = new Matrix4();
    mesh.getMatrixAt(copy, matrix);
    return new Vector3().setFromMatrixScale(matrix).length();
};
const corners = (geometry: BufferGeometry) =>
    geometry.getIndex()?.count ?? geometry.getAttribute("position").count;

describe("openHouse", () => {
    test("takes the panel out of this house only, and paints the room", () => {
        const w = world();
        expect(openHouse(w.context, w.surroundings)).toBe(true);

        // this copy of the walls is drawn on its own, without the panel
        const own = w.scene.getObjectByName("starryNightHousePart") as Mesh;
        expect(own.material).toBe(w.walls.material);
        expect(corners(own.geometry)).toBe(3);
        expect(scaleOf(w.walls, 1)).toBe(0);
        // the other copy, and the parts with nothing in the room, are as they were
        expect(scaleOf(w.walls, 0)).toBeGreaterThan(0);
        expect(scaleOf(w.outlines, 1)).toBeGreaterThan(0);
        expect(corners(w.walls.geometry)).toBe(6);

        const room = w.scene.getObjectByName("starryNightHouseStrokes") as Mesh;
        expect(room).toBeDefined();
        // the room stands where the house does
        const interior = w.scene.getObjectByName("starryNightHouse");
        expect(interior.position.x).toBeCloseTo(HOUSE.at[0]);
        expect(interior.position.z).toBeCloseTo(HOUSE.at[2]);
        expect(interior.rotation.y).toBeCloseTo(HOUSE.yaw);
    });

    test("opens the way in and gives the room walls of its own", () => {
        const w = world();
        const before = w.collision.geometry;
        openHouse(w.context, w.surroundings);

        // the passage's far end is gone; the wall beside the door is not
        expect(w.collision.geometry).not.toBe(before);
        expect(corners(w.collision.geometry)).toBe(3);
        expect(corners(before)).toBe(6);

        expect(w.colliders).toHaveLength(2);
        const room = w.colliders[1] as Mesh;
        expect(room.name).toBe("starryNightHouseCollision");
        expect(room.visible).toBe(false);
        // placed in the world, as the collision builder reads it
        const corner = new Vector3()
            .fromBufferAttribute(room.geometry.getAttribute("position"), 0)
            .applyMatrix4(room.matrixWorld);
        const [x, , z] = houseToWorld([-4.58, 0, -5.85]);
        expect(corner.x).toBeCloseTo(x, 2);
        expect(corner.z).toBeCloseTo(z, 2);
    });

    test("the door opens as a visitor comes near and shuts behind them", () => {
        const w = world();
        openHouse(w.context, w.surroundings);
        const [x, y, z] = DOOR.threshold;

        w.standAt([x, y, z + DOOR_RULES.closeBeyond + 5]);
        w.run(2);
        expect(w.door.rotation.y).toBe(0);
        expect(w.surroundings.redraw).not.toHaveBeenCalled();

        w.standAt([x, y, z + 3]);
        w.run(2);
        expect(w.door.rotation.y).toBeCloseTo(DOOR.openAngle);
        expect(w.surroundings.redraw).toHaveBeenCalled();

        // at the back of the room, further than it closes at from outside
        w.standAt([0, y, -5]);
        w.run(2);
        expect(w.door.rotation.y).toBeCloseTo(DOOR.openAngle);

        w.standAt([x, y, z + DOOR_RULES.closeBeyond + 5]);
        w.run(2);
        expect(w.door.rotation.y).toBeCloseTo(0);
    });

    test("stops watching for visitors when the space closes", () => {
        const w = world();
        openHouse(w.context, w.surroundings);
        expect(w.disposers).toHaveLength(1);
        w.disposers[0]();
        expect(w.stop).toHaveBeenCalledTimes(1);
    });

    test("a door the space made a portal stays a portal", () => {
        const w = world({ portalIds: [HOUSE.portal] });
        expect(openHouse(w.context, w.surroundings)).toBe(false);
        expect(w.scene.getObjectByName("starryNightHouse")).toBeUndefined();
        expect(scaleOf(w.walls, 1)).toBeGreaterThan(0);
        expect(w.colliders).toHaveLength(1);
        expect(corners(w.collision.geometry)).toBe(6);
    });

    test.each([
        ["the house is not where it was", (w: ReturnType<typeof world>) => w],
        [
            "the door is missing",
            (w: ReturnType<typeof world>) => (w.door.removeFromParent(), w),
        ],
        [
            "the collision is missing",
            (w: ReturnType<typeof world>) => (w.colliders.pop(), w),
        ],
    ])("changes nothing when %s", (what, prepare) => {
        const w = prepare(
            world(what.startsWith("the house") ? { at: [0, 0, 0] } : {})
        );
        const colliders = w.colliders.length;
        expect(openHouse(w.context, w.surroundings)).toBe(false);
        expect(w.scene.getObjectByName("starryNightHouse")).toBeUndefined();
        expect(w.scene.getObjectByName("starryNightHousePart")).toBeUndefined();
        expect(scaleOf(w.walls, 1)).toBeGreaterThan(0);
        expect(w.colliders).toHaveLength(colliders);
        expect(w.disposers).toHaveLength(0);
    });
});
