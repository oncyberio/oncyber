import {
    BufferAttribute,
    BufferGeometry,
    Group,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    Quaternion,
    Vector3,
    type InstancedMesh,
    type Object3D,
} from "three/webgpu";
import { createPaintedSurface } from "../../../paintedSurface/paintedSurface";
import type { WorldSceneContext } from "../../../types";
import { insideRoom, roomColliderPositions, standsInRoom } from "./colliders";
import {
    DOOR_CLOSED,
    easedSwing,
    transition,
    type DoorEvent,
    type DoorState,
} from "./door";
import { paintInterior } from "./interior";
import { DOOR, HOUSE, SHELL } from "./layout";

/** What the house needs from the running engine, so tests can stand in. */
export type HouseSurroundings = {
    /** Calls `frame` every frame with the seconds since the last; returns how to stop. */
    onFrame: (frame: (seconds: number) => void) => () => void;
    /**
     * Writes where the visitor stands, in the world, into `into`. False
     * before they have arrived.
     */
    visitor: (into: Vector3) => boolean;
    /** Asks for the world to be drawn again (it draws on demand). */
    redraw: () => void;
};

type HouseCopy = {
    /** Every part of the house model: walls, roof, outlines, windows. */
    parts: InstancedMesh[];
    /** Which copy of the model this house is. */
    copy: number;
    /** That copy's place in the world. */
    matrix: Matrix4;
};

/** The copy of the house model standing at HOUSE.at, with all its parts. */
function findHouse(scene: Object3D): HouseCopy | null {
    const at = new Vector3();
    const here = new Vector3(...HOUSE.at);
    const matrix = new Matrix4();
    const isPart = (object: Object3D): object is InstancedMesh =>
        (object as InstancedMesh).isInstancedMesh === true;
    let found: HouseCopy | null = null;
    scene.traverse((object) => {
        if (found || !isPart(object)) return;
        if ((object.material as { name?: string })?.name !== HOUSE.walls)
            return;
        for (let copy = 0; copy < object.count; copy++) {
            object.getMatrixAt(copy, matrix);
            matrix.premultiply(object.matrixWorld);
            if (at.setFromMatrixPosition(matrix).distanceTo(here) > 0.75)
                continue;
            found = {
                // the model's materials are each a mesh, side by side
                parts: object.parent.children.filter(
                    (part): part is InstancedMesh =>
                        isPart(part) && part.count === object.count
                ),
                copy,
                matrix: matrix.clone(),
            };
            return;
        }
    });
    return found;
}

/**
 * The triangles of `geometry` to keep: all but those `drop` says to take
 * out, given each corner in the house's frame. Null when none are dropped.
 */
function withoutTriangles(
    geometry: BufferGeometry,
    toHouse: Matrix4,
    drop: (a: Vector3, b: Vector3, c: Vector3) => boolean
) {
    const position = geometry.getAttribute("position");
    const index = geometry.getIndex();
    const corners = index ? index.count : position.count;
    const kept: number[] = [];
    const points = [new Vector3(), new Vector3(), new Vector3()];
    for (let i = 0; i + 2 < corners; i += 3) {
        const triangle = [0, 1, 2].map((k) =>
            index ? index.getX(i + k) : i + k
        );
        triangle.forEach((vertex, k) =>
            points[k]
                .fromBufferAttribute(position, vertex)
                .applyMatrix4(toHouse)
        );
        if (!drop(points[0], points[1], points[2])) kept.push(...triangle);
    }
    if (kept.length === corners) return null;
    const result = geometry.clone();
    result.setIndex(kept);
    return result;
}

/**
 * Opens the house at HOUSE.at: takes out what closed its doorway from
 * behind, paints the room inside, lets visitors walk in and swings the door
 * as they come and go.
 *
 * Does nothing, and changes nothing, when the house or its door is not
 * where this expects, or when the space has given this door a destination
 * (it is a portal there, and stays one).
 */
export function openHouse(
    { scene, colliders, portalIds, mobile, onDispose }: WorldSceneContext,
    { onFrame, visitor, redraw }: HouseSurroundings
): boolean {
    if (portalIds.includes(HOUSE.portal)) return false;

    scene.updateMatrixWorld(true);
    const house = findHouse(scene);
    const door = scene.getObjectByName(HOUSE.door);
    const outer = colliders.find(
        (collider) => collider.name === "CL_C_House"
    ) as Mesh | undefined;
    if (!house || !door || !outer?.geometry) return false;

    // the house's frame: where its copy stands, without the model's scale
    const frame = new Matrix4().compose(
        new Vector3().setFromMatrixPosition(house.matrix),
        new Quaternion().setFromRotationMatrix(
            new Matrix4().extractRotation(house.matrix)
        ),
        new Vector3(1, 1, 1)
    );
    const toHouse = frame.clone().invert();

    // ---- everything that can fail is made first; nothing is changed yet ----
    // The model closes its doorway from behind with a panel and lines the
    // recess with dark strokes: all of it stands inside the room. Each part
    // that has some is redrawn for this copy without it.
    const { parts, copy } = house;
    const { passage } = SHELL;
    const middle = new Vector3();
    const place = new Matrix4();
    const opened = parts
        .map((part) => {
            part.getMatrixAt(copy, place);
            place.premultiply(part.matrixWorld).premultiply(toHouse);
            return {
                part,
                geometry: withoutTriangles(part.geometry, place, (a, b, c) => {
                    middle.copy(a).add(b).add(c).divideScalar(3);
                    return standsInRoom(middle.x, middle.y, middle.z);
                }),
            };
        })
        .filter(({ geometry }) => geometry !== null);
    outer.updateWorldMatrix(true, false);
    const openCollision = withoutTriangles(
        outer.geometry,
        toHouse.clone().multiply(outer.matrixWorld),
        (a, b, c) =>
            [a, b, c].every(
                (p) =>
                    Math.abs(p.z - passage.back) < 0.2 &&
                    p.x > passage.left - 0.2 &&
                    p.x < passage.right + 0.2 &&
                    p.y < passage.top + 0.2
            )
    );
    if (opened.length === 0 || !openCollision) return false;

    const room = createPaintedSurface(
        paintInterior({ density: mobile ? 0.6 : 1 }),
        "starryNightHouse"
    );
    const toScene = scene.matrixWorld.clone().invert();
    room.applyMatrix4(toScene.clone().multiply(frame));

    const solid = new BufferGeometry();
    solid.setAttribute(
        "position",
        new BufferAttribute(roomColliderPositions(), 3)
    );
    // never drawn: it is only there to be walked into
    const roomCollider = new Mesh(solid, new MeshBasicMaterial());
    roomCollider.name = "starryNightHouseCollision";
    roomCollider.visible = false;
    roomCollider.applyMatrix4(toScene.clone().multiply(frame));

    // ---- now open it ----
    // those parts of this copy are drawn on their own; the shared ones skip it
    const nothing = new Matrix4().makeScale(0, 0, 0);
    for (const { part, geometry } of opened) {
        const own = new Mesh(geometry, part.material);
        own.name = "starryNightHousePart";
        own.renderOrder = part.renderOrder;
        part.getMatrixAt(copy, own.matrix);
        own.matrix.premultiply(part.matrix);
        own.matrixAutoUpdate = false;
        part.parent.add(own);
        part.setMatrixAt(copy, nothing);
        part.instanceMatrix.needsUpdate = true;
        part.computeBoundingSphere();
    }

    const group = new Group();
    group.name = "starryNightHouseInterior";
    group.add(room, roomCollider);
    scene.add(group);
    group.updateMatrixWorld(true);

    outer.geometry = openCollision;
    colliders.push(roomCollider);

    // ---- the door ----
    const threshold = new Vector3(...DOOR.threshold).applyMatrix4(frame);
    const shut = door.rotation.y;
    const point = new Vector3();
    // one event, filled in each frame: nothing is allocated while it runs
    const event: DoorEvent = { type: "frame", seconds: 0, distance: 0 };
    let state: DoorState = DOOR_CLOSED;
    const stop = onFrame((seconds) => {
        if (!visitor(point)) return;
        const distance = point.distanceTo(threshold);
        point.applyMatrix4(toHouse);
        event.seconds = seconds;
        // someone in the room keeps the door open however far back
        event.distance = insideRoom(point.x, point.y, point.z, 0.6)
            ? 0
            : distance;
        const next = transition(state, event);
        if (next === state) return;
        state = next;
        door.rotation.y = shut + DOOR.openAngle * easedSwing(state.swing);
        redraw();
    });
    onDispose(stop);

    return true;
}
