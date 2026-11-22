import { Vector3 } from "three";


import { CAPSULE_RADIUS, USER_HEIGHT, IS_FIRST_PERSON, CURRENT_SPACE } from '@3constants';
import { walkingEyeHeight } from '../../../../utils/eyeHeight';
        // capsuleRadius: CAPSULE_RADIUS,
        // colliderHeight,
        // userHeight: USER_HEIGHT,

import Players from "@3factory/player"

export class AbstractCollisions {

    constructor(opts) {

        this.collisionResult = {
            playerOnFloor: false,
            endPosition: new Vector3(),
            startPosition: new Vector3(),
            intersectedMeshes: null
        };

        this.roomParameters = opts.roomParameters

        this.collider_height = this.getColliderHeight();

        this.user_height = USER_HEIGHT;

        this.capsuleRadius = CAPSULE_RADIUS;
    }

    getColliderHeight(){

        const head = Players.main != null ? Players.main.avatar3D.headPosition.y : USER_HEIGHT

        // The first-person camera sits on top of this capsule, so in first
        // person it takes the destination's own height (see eyeHeight.ts).
        return IS_FIRST_PERSON ? walkingEyeHeight( CURRENT_SPACE, head ) : head
    }

    /**
     *
     * @param {number} min
     * @param {number} max
     * @param {number} radius
     */
    setCapsule(min, max, radius) {}

    /**
     *
     * @param {import("@gltypes").SpaceData} space
     */
    setCollider(space) {}

    /**
     *
     * @param {Vector3} position : ;
     */
    playerCollitions(position) {}

    /** @param { Ray }  ray */
    rayIntersect(ray) {}

    /**
     * @param {Vector3} position : ;
     */
    reset(position) {}
}
