// @ts-check

// The parts of spaceutils.js that need no three.js classes. The app shell
// (utils/metadata/formatExhibit.ts, and the room-data defaults reached from
// utils/anon) imports this file; spaceutils.js re-exports every name here so
// engine imports keep working. Keep three.js out of this module.

import { asConst, parseLocation } from "@utils/js";

export function getDistance(v1, v2) {
    const dx = v1.x - v2.x;
    const dy = v1.y - v2.y;
    const dz = v1.z - v2.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function get2Distance(v1, v2) {
    const dx = v1.x - v2.x;
    const dz = v1.z - v2.z;

    return Math.sqrt(dx * dx + dz * dz);
}

/**
 *
 * @param { { position: import('@gltypes').XYZ, rotation: import('@gltypes').XYZ } } object
 * @param { string } [uid]
 * @returns { string }
 */
export function coordsToId(object, uid) {
    const { position, rotation } = object;

    const { x, y, z } = position;

    let coords = `${x.toFixed(2)}X${y.toFixed(2)}X${z.toFixed(
        2
    )}X${rotation.x.toFixed(2)}X${rotation.y.toFixed(2)}X${rotation.z.toFixed(
        2
    )}`;

    if (uid) {
        coords += `@${uid}`;
    }

    return coords;
}

/**
 *
 * @param { import('@uitypes/experience').ArtworkData } it
 * @param { string } name
 */
export function matchArtworkByName(it, name) {
    return it.data.name.toLowerCase().includes(name.toLowerCase());
}

export const DEFAULTS = {
    MAX_SIZE: 200,
    DEPTH: 0.04,
    ARTWORK_SCALE: 15,
};

/**
 *
 * @param { import('@uitypes/experience').ArtworkData } item
 * @returns
 */
export function artworkVersion(item) {
    return item.version || 0;
}

export function artworkDepth(roomParameters) {
    return +roomParameters.placeholderSize?.[2] || DEFAULTS.DEPTH;
}

export const CoordsReference = {
    // will force the Y position of the camera on initial load
    ABSOLUTE: asConst("absolute"),

    // relative to user head
    HEAD: asConst("head"),
};

/** The default avatar's head height; matches USER_HEIGHT in constants.js. */
const DEFAULT_HEAD_HEIGHT = 2.8;

/**
 * Saved spawns and `?coords` links hold where the head was. Spawn data
 * holds where the feet go (the player's own head height is added on top),
 * so this turns one into the other. A missing height means the floor at 0.
 *
 * @param {{ x?: number, y?: number, z?: number }} head
 */
export function headToFeet(head) {
    const y = Number(head?.y);

    return {
        x: head?.x || 0,
        y: Number.isFinite(y) ? y - DEFAULT_HEAD_HEIGHT : 0,
        z: head?.z || 0,
    };
}

/**
 * @param {import('@uitypes/roomParameters').RoomParameters} roomParameters
 * @param {string} coords
 * @param {CoordsReference[keyof CoordsReference]} reference
 */
export function overrideInitialCoords(
    roomParameters,
    coords,
    reference = CoordsReference.ABSOLUTE
) {
    if (!coords) return roomParameters;

    const location = parseLocation(coords);

    if (location == null) return roomParameters;

    return {
        ...roomParameters,
        // The room's own spawn, kept for when the link's coords turn out to
        // be outside the space (see physics/spaceBounds.js).
        roomSpawnPosition:
            roomParameters.roomSpawnPosition ??
            roomParameters.initialPlayerPosition,
        roomSpawnRotation:
            roomParameters.roomSpawnRotation ??
            roomParameters.initialPlayerRotation,
        initialPlayerPosition: {
            ...location.position,
            reference,
        },
        initialPlayerRotation: {
            ...roomParameters.initialPlayerRotation,
            y: location._y,
        },
    };
}
