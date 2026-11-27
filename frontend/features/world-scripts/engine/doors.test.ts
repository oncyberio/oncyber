/** @jest-environment node */
import { Group, Mesh, Object3D, PlaneGeometry, Vector3 } from "three";

jest.mock("./facade", () => ({
    DOOR_MESH_NAME: /^Portal_Door_(\d+)$/i,
    worldModel: jest.fn(() => null),
    portalPlaceholders: jest.fn(() => []),
    assignedPortalIds: jest.fn(() => new Set()),
}));

import { createDoors, doorFacing } from "./doors";
import { assignedPortalIds, portalPlaceholders, worldModel } from "./facade";

/**
 * A model with two doors in the plane z = 0, each one metre wide and two
 * high on the ground, and what their portals would show a metre behind.
 */
function house() {
    const model = new Group();
    const placeholders = [1, 2].map((n) => {
        const door = new Group();
        door.name = `Portal_Door_${n}`;
        door.position.set(n * 10, 0, 0);
        const leaf = new Mesh(new PlaneGeometry(1, 2));
        leaf.position.y = 1;
        door.add(leaf);
        model.add(door);
        const preview = new Object3D();
        preview.position.set(n * 10, 1, -1);
        model.add(preview);
        return { door, preview, portalId: `portal-${n}` };
    });
    // Named like a door's frame, not a door.
    const frame = new Group();
    frame.name = "Portal_Door_1_frame";
    model.add(frame);
    model.updateMatrixWorld(true);
    (worldModel as jest.Mock).mockReturnValue(model);
    (portalPlaceholders as jest.Mock).mockReturnValue(placeholders);
    return { model, placeholders };
}

beforeEach(() => {
    (worldModel as jest.Mock).mockReturnValue(null);
    (portalPlaceholders as jest.Mock).mockReturnValue([]);
    (assignedPortalIds as jest.Mock).mockReturnValue(new Set());
});

describe("which way a door lets out", () => {
    test("the side its faces look to, from what stands behind it", () => {
        const door = new Mesh(new PlaneGeometry(1, 2));
        door.updateMatrixWorld(true);
        expect(doorFacing(door, new Vector3(0.3, 0, 1)).toArray()).toEqual([
            0, 0, 1,
        ]);
        expect(doorFacing(door, new Vector3(0, 0, -1)).toArray()).toEqual([
            0, 0, -1,
        ]);
    });

    test("a door with no faces lets out the way it was roughly told", () => {
        const out = doorFacing(new Object3D(), new Vector3(1, 5, 0));
        expect(out.toArray()).toEqual([1, 0, 0]);
    });
});

describe("the world's doors, for a script", () => {
    test("each door of the model is told: where, which way, how big", () => {
        house();
        const list = createDoors().list();
        expect(list.map((door) => door.id)).toEqual([
            "Portal_Door_1",
            "Portal_Door_2",
        ]);
        expect(list[0]).toMatchObject({
            position: [10, 0, 0],
            width: 1,
            height: 2,
            portal: false,
            open: 0,
            building: null,
        });
        // Out is away from what stands behind: +z.
        expect(list[0].yaw).toBeCloseTo(0);
    });

    test("a script swings a door on its hinge, and it is shut again after", () => {
        const { placeholders } = house();
        const doors = createDoors();
        doors.set("Portal_Door_1", 1);
        expect(placeholders[0].door.rotation.y).toBeCloseTo((Math.PI * 3) / 4);
        expect(doors.list()[0].open).toBe(1);
        doors.set("Portal_Door_9", 1);
        doors.reset();
        expect(placeholders[0].door.rotation.y).toBe(0);
        expect(doors.list()[0].open).toBe(0);
    });

    test("a door the space made a portal is listed, and is not the script's to open", () => {
        const { placeholders } = house();
        (assignedPortalIds as jest.Mock).mockReturnValue(new Set(["portal-2"]));
        const doors = createDoors();
        expect(doors.list().map((door) => door.portal)).toEqual([false, true]);
        doors.set("Portal_Door_2", 1);
        expect(placeholders[1].door.rotation.y).toBe(0);
    });

    test("no world, or a door with nothing behind it, is no door", () => {
        const doors = createDoors();
        expect(doors.list()).toEqual([]);
        expect(() => doors.reset()).not.toThrow();
        const { placeholders } = house();
        placeholders[0].preview = null;
        (portalPlaceholders as jest.Mock).mockReturnValue(placeholders);
        expect(createDoors().list()).toHaveLength(1);
    });

    test("another world's doors replace these", () => {
        house();
        const doors = createDoors();
        expect(doors.list()).toHaveLength(2);
        (worldModel as jest.Mock).mockReturnValue(new Group());
        expect(doors.list()).toEqual([]);
    });
});
