// Three-free: the triangles a visitor collides with inside the house, in
// the house's own frame (see layout.ts).
import type { Vec3 } from "../../../paintedSurface/painter";
import { FURNITURE } from "./interior";
import { ROOM, SHELL } from "./layout";

/**
 * The room's walls and floor, facing in, and its furniture, facing out, as
 * triangle positions (nine numbers per triangle).
 *
 * The world's own collision stops a visitor from outside only: a wall is
 * solid from the side it faces. So the room needs walls of its own facing
 * in, with the same doorway as the passage through the outer wall.
 */
export function roomColliderPositions(): Float32Array {
    const out: number[] = [];
    // counter-clockwise from the side it stops
    const quad = (a: Vec3, b: Vec3, c: Vec3, d: Vec3) =>
        out.push(...a, ...b, ...c, ...a, ...c, ...d);

    const W = ROOM.halfWidth;
    const D = ROOM.halfDepth;
    const low = ROOM.floor - 0.5;
    const high = ROOM.ridge;
    const { left, right, top } = SHELL.passage;

    quad([-W, low, -D], [W, low, -D], [W, high, -D], [-W, high, -D]);
    quad([-W, low, D], [-W, low, -D], [-W, high, -D], [-W, high, D]);
    quad([W, low, -D], [W, low, D], [W, high, D], [W, high, -D]);
    // the front wall, either side of the doorway and above it
    quad([W, low, D], [right, low, D], [right, high, D], [W, high, D]);
    quad([left, low, D], [-W, low, D], [-W, high, D], [left, high, D]);
    quad([right, top, D], [left, top, D], [left, high, D], [right, high, D]);

    // the boards underfoot, and a ramp down to the porch through the door
    // (the porch's own collision lies a little under what is drawn of it)
    const floor = ROOM.floor;
    quad([-W, floor, -D], [-W, floor, D], [W, floor, D], [W, floor, -D]);
    quad(
        [left, floor, D],
        [left, floor - 0.13, D + 0.9],
        [right, floor - 0.13, D + 0.9],
        [right, floor, D]
    );

    for (const [[x0, y0, z0], [x1, y1, z1]] of FURNITURE) {
        quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
        quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
        quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
        quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]);
        quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
    }
    return new Float32Array(out);
}

/** True for a point of the house's frame that is inside the room. */
export function insideRoom(x: number, y: number, z: number, margin = 0) {
    return (
        Math.abs(x) <= ROOM.halfWidth + margin &&
        Math.abs(z) <= ROOM.halfDepth + margin &&
        y >= ROOM.floor - 1 &&
        y <= ROOM.ridge
    );
}

/**
 * True for a point of the house's frame that is well inside the room, clear
 * of the walls and under the roof: nothing of the outside shell is there.
 */
export function standsInRoom(x: number, y: number, z: number) {
    return (
        Math.abs(x) < ROOM.halfWidth - 0.05 &&
        z > -ROOM.halfDepth + 0.05 &&
        z < ROOM.halfDepth - 0.15 &&
        y > ROOM.floor - 0.6 &&
        y < ROOM.eaves - 0.05
    );
}
