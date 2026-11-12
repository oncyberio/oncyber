import type { WorldCubeRevealOptions } from "./worldCubeReveal";

type Point = { x: number; y: number; z: number };
const finitePoint = (point?: Point) =>
    point && [point.x, point.y, point.z].every(Number.isFinite)
        ? { x: point.x, y: point.y, z: point.z }
        : undefined;

/** More squares where the camera can see them, independent of giant sky bounds. */
export function getWorldRevealDetail(
    cameraPosition: Point,
    forward: Point,
    playerPosition: Point
): WorldCubeRevealOptions["refinement"] {
    const player = finitePoint(playerPosition);
    let focus = finitePoint(cameraPosition) ?? player;
    // A camera awaiting its spawn update must not spend detail in the old room.
    if (
        focus &&
        player &&
        Math.hypot(focus.x - player.x, focus.y - player.y, focus.z - player.z) >
            32
    )
        focus = player;
    const direction = finitePoint(forward);
    return {
        minCellSize: 0.25,
        maxCellSize: 4,
        detailRadius: 8,
        ...(focus ? { focus } : {}),
        ...(direction ? { forward: direction } : {}),
    };
}

/** Compact sculptures/fixtures reuse their existing buffers as moving pieces;
 * reserve generated tile geometry for the architecture around them. */
export const WORLD_REVEAL_RIGID_PROPS = {
    minTriangles: 5000,
    maxExtent: 5,
    maxSources: 64,
    maxTriangles: 400000,
};
