import { Euler, Vector3 } from 'three';

import { CAPSULE_RADIUS, USER_HEIGHT } from '../constants';

import Players from '../factory/player';

import { CoordsReference } from './spaceutils';

export function getUserInitialPositions(roomParameters) {

    let initialPlayerPosition = roomParameters?.initialPlayerPosition

    let initialPlayerRotation = roomParameters?.initialPlayerRotation

    const colliderHeight = Players.main != null ? Players.main.avatar3D.headPosition.y : USER_HEIGHT

    let y = colliderHeight;

    if(initialPlayerPosition?.reference === CoordsReference.ABSOLUTE) {
        //
        y = initialPlayerPosition.y
    } else if (initialPlayerPosition?.reference === CoordsReference.HEAD) {
        //
        y += initialPlayerPosition.y
    }

    return {
        capsuleRadius: CAPSULE_RADIUS,
        colliderHeight,
        userHeight: colliderHeight,
        cameraPos: new Vector3(
            initialPlayerPosition?.x || 0,
            y,
            initialPlayerPosition?.z || 0,
        ),
        cameraRot: new Euler(
            initialPlayerRotation?.x || 0,
            initialPlayerRotation?.y || 0,
            initialPlayerRotation?.z || 0,
        )
    }
}


/**
 *
 * @param { import('@uitypes/roomParameters').RoomParameters } roomParameters
 * @param { PerspectiveCamera } camera
 */
export function initCamera(roomParameters, camera) {
    const { cameraRot, cameraPos } = getUserInitialPositions(roomParameters);

    camera.position.copy(cameraPos);
    camera.rotation.copy(cameraRot);

    camera.rotation.order = "YXZ";
}
