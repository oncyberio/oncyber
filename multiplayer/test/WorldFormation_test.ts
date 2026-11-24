import assert from "assert";
import { FORMATION_ROW_DEPTH, FORMATION_ROW_MAX, FORMATION_SPACING, formationPoses, formationSlots } from "../src/world/formation";

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe("party formation", () => {
    it("two travellers stand side by side, not one in front of the other", () => {
        // Facing +z: the row runs along x.
        const [first, second] = formationPoses({ x: 10, y: 0, z: 4, rotation: 0 }, 2);
        assert.deepEqual(first, { x: 10, y: 0, z: 4, rotation: 0 });
        assert(near(second.z, 4), "no step forward or back");
        assert(near(Math.abs(second.x - 10), FORMATION_SPACING));
        assert.equal(second.rotation, 0);
    });

    it("keeps one row up to six, alternating right and left of the first traveller", () => {
        assert.deepEqual(formationSlots(6), [
            { side: 0, row: 0 },
            { side: 1, row: 0 },
            { side: -1, row: 0 },
            { side: 2, row: 0 },
            { side: -2, row: 0 },
            { side: 3, row: 0 },
        ]);
        assert.equal(FORMATION_ROW_MAX, 6);
    });

    it("seven or eight make two rows, the back one standing in the gaps of the front", () => {
        for (const count of [7, 8]) {
            const slots = formationSlots(count);
            const front = slots.filter((slot) => slot.row === 0),
                back = slots.filter((slot) => slot.row === 1);
            assert.equal(front.length, Math.ceil(count / 2));
            assert.equal(back.length, Math.floor(count / 2));
            // Nobody in the back row is directly behind anybody in the front row.
            for (const behind of back) assert(front.every((ahead) => Math.abs(ahead.side - behind.side) >= 0.5 - 1e-9));
        }
    });

    it("nobody shares a place, for every party size", () => {
        for (let count = 1; count <= 8; count++) {
            const poses = formationPoses({ x: -3, y: 0, z: 7, rotation: 1.1 }, count);
            assert.equal(poses.length, count);
            for (let a = 0; a < count; a++) for (let b = a + 1; b < count; b++) assert(Math.hypot(poses[a].x - poses[b].x, poses[a].z - poses[b].z) >= Math.min(FORMATION_SPACING, FORMATION_ROW_DEPTH) - 1e-9);
        }
    });

    it("turns with the first traveller: the row is across the way they face", () => {
        const rotation = Math.PI / 2; // facing +x
        const [first, second, , , , , , behind] = formationPoses({ x: 0, y: 0, z: 0, rotation }, 8);
        // The neighbour is to the side: along z, not along the facing axis.
        assert(near(second.x, first.x));
        assert(near(Math.abs(second.z), FORMATION_SPACING));
        // The back row is behind: against the way they face.
        assert(behind.x < 0);
        assert(near(behind.x, -FORMATION_ROW_DEPTH));
    });
});
