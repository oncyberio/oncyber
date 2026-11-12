
// @ts-check


import { GET_SINGLE_DISPLAY_EXPERIENCE } from "@utils/partnerships/singledisplay";

import { IS_ARTBLOCKS_SPECIAL_ROOM, MAX_ARTBLOCKS_HEIGHT } from "@utils/partnerships/singledisplay/artblocks"

import { Euler, Object3D, Camera, PerspectiveCamera, Vector3, Quaternion } from 'three';

import { CAPSULE_RADIUS, CURRENT_SPACE, DEF_VOICE_RANGE, USER_HEIGHT } from '../constants';

import { getCameraLocalDirection } from "./three";

import { DEFAULTS } from "./spacecoords";

// The three-free helpers live in spacecoords.js (the app shell imports that
// file directly); re-exported here so engine imports keep working.
export {
    getDistance,
    get2Distance,
    coordsToId,
    matchArtworkByName,
    DEFAULTS,
    artworkVersion,
    artworkDepth,
    CoordsReference,
    overrideInitialCoords,
} from "./spacecoords";


/**
 *
 * @param { string } id
 * @returns {  { position: Vector3, rotation: Euler, uid: string } }
 */
export function idToCoords (id) {

    let [_id, uid] = id.split("@")

    const [x, y, z, _x, _y, _z] = _id.split("X")

    return {

        position: new Vector3(Number(x), Number(y), Number(z)),

        rotation: new Euler(Number(_x), Number(_y), Number(_z)),

        uid
    }
}

/**
 *
 * @param { number } width
 * @param { number } height
 * @param { import('@uitypes/roomParameters').RoomParameters } roomParameters
 */
export function artworkSize(width, height, roomParameters) {


    height = (height * DEFAULTS.MAX_SIZE) / width

    width = DEFAULTS.MAX_SIZE;

    const scaleDown = roomParameters?.artworkScale || DEFAULTS.ARTWORK_SCALE

    let artworkWidth = width / scaleDown

    let artworkHeight = height / scaleDown

    const singledisplay = GET_SINGLE_DISPLAY_EXPERIENCE({
        slug: roomParameters.slug,
    });

    if (singledisplay) {

        artworkWidth = ((artworkWidth * singledisplay.max_height) / artworkHeight);

        artworkHeight = singledisplay.max_height;
    }

    return {
        artworkWidth,
        artworkHeight
    }
}

export function getCurrentSpaceVoiceRange(exhibit = CURRENT_SPACE?.exhibit) {
    // @ts-ignore
    return exhibit?.options?.voice_range || DEF_VOICE_RANGE
}

const cameraPosition = new Vector3()

const cameraDirection = new Vector3()

/**
 *
 * @param {Camera} camera
 * @param {number} distance
 */
export function getDefaultAssetPosition(camera, distance) {


    cameraPosition.copy(camera.position)

    getCameraLocalDirection(camera, cameraDirection)

    cameraDirection.normalize()


    const position = cameraDirection.clone()
        .multiplyScalar(distance)
        .add(cameraPosition)


    position.y = cameraPosition.y

    return position
}


const quat = new Quaternion()
const obj = new Object3D()
const tmpV3 = new Vector3()

/**
 *
 * @param {Camera} camera
 */
export function getDefaultAssetRotation(camera) {

    const euler = new Euler();

    camera.getWorldPosition(cameraPosition)

    camera.getWorldDirection(cameraDirection)


    tmpV3.copy(cameraPosition).add(cameraDirection).setY(cameraPosition.y).sub(cameraPosition).negate()


    euler.setFromQuaternion(
        quat.setFromUnitVectors(new Vector3(0, 0, 1), tmpV3)
    );

    return euler;

}