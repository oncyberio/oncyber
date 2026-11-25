// Three-free: where the house is and how big, shared by what paints it,
// what collides in it and what opens its door.
import type { Vec3 } from "../../../paintedSurface/painter";

/**
 * The house whose door is `Portal_Door_073`: the first one down the road
 * from the spawn point, one of 27 copies of the world's "House 1" model.
 *
 * Everything about the house is written in its own frame: the origin on the
 * ground at its middle, x across the front, y up, z out through the front
 * door, in world units. `HOUSE.at` and `HOUSE.yaw` are where that frame sits
 * in the world (read from the model; the mod finds the copy standing there).
 */
export const HOUSE = {
    at: [36.51, -20.735, -59.005] as Vec3,
    yaw: 1.07275,
    /** The door's group and its portal placeholder in the world's model. */
    door: "Portal_Door_073",
    portal: "Portal_Preview_073",
    /** The material of the walls, which names the model's copies. */
    walls: "House 1",
};

/** The outside shell, as modelled. */
export const SHELL = {
    /** Half the width (x) and half the depth (z) of the walls. */
    halfWidth: 4.68,
    halfDepth: 5.95,
    eaves: 6.01,
    ridge: 9.73,
    /**
     * The way in through the walking collision (`CL_C_House`): a gap in its
     * front wall with a short passage behind it, closed at `back`.
     */
    passage: { left: -1.44, right: 1.35, top: 4.64, back: 5.04 },
};

/** The room painted inside the shell, a little in from its walls. */
export const ROOM = {
    halfWidth: 4.58,
    halfDepth: 5.85,
    /** The top of the platform the house stands on. */
    floor: -0.25,
    eaves: 6.0,
    ridge: 9.62,
    /** The doorway in the front wall (z = +halfDepth). */
    door: { left: -1.55, right: 1.45, top: 4.82 },
    /** The two lit windows of the left wall (x = -halfWidth), by z. */
    windows: [
        { from: -2.64, to: -0.61 },
        { from: 1.84, to: 4.02 },
    ],
    windowSill: 1.96,
    windowTop: 4.94,
};

/** Where the door turns and how far it swings (outward, to its right). */
export const DOOR = {
    openAngle: (Math.PI * 3) / 4,
    /** The middle of the doorway on the floor, where distance is measured. */
    threshold: [-0.05, ROOM.floor, SHELL.halfDepth] as Vec3,
};

const cos = Math.cos(HOUSE.yaw);
const sin = Math.sin(HOUSE.yaw);

/** A point of the house, in the world. */
export function houseToWorld(p: Vec3): Vec3 {
    return [
        HOUSE.at[0] + cos * p[0] + sin * p[2],
        HOUSE.at[1] + p[1],
        HOUSE.at[2] - sin * p[0] + cos * p[2],
    ];
}

/** A point of the world, in the house's frame. */
export function worldToHouse(p: Vec3): Vec3 {
    const x = p[0] - HOUSE.at[0];
    const z = p[2] - HOUSE.at[2];
    return [cos * x - sin * z, p[1] - HOUSE.at[1], sin * x + cos * z];
}
