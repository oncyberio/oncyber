
import conf from "@3gl/utils/params"

import Mix from '@3utils/math/mix'

import Smoothstep from '@3utils/math/smoothstep'

import { Vector3 } from "three"

import {

	VIEW

} from '@3constants'

export const COLLISION_TYPE = conf.collisionType || "OCTREE"

export const IS_BVH = COLLISION_TYPE === "BVH"

export const IS_OCTREE = COLLISION_TYPE === "OCTREE"

export const IS_NONE = COLLISION_TYPE === "NONE"

export const IS_FLY = COLLISION_TYPE === "FLY"

export const FOV = 65

export const MIN_FOV = 65

export const MAX_FOV  = 90

var FOV_RATIO_RESIZE = 1

export const GET_RATIO_FOV = () => {

	FOV_RATIO_RESIZE = Smoothstep(0.5, 1.0, VIEW.w / VIEW.h)

	return Mix( MAX_FOV, MIN_FOV, FOV_RATIO_RESIZE )
}





export const NEAR = 0.5

// The walking camera sits on the collision capsule's axis, so it can get
// CAPSULE_RADIUS (0.55) from a wall. A near plane deeper than that cuts into
// the wall and shows what is behind it; this keeps the near plane's corners
// inside the capsule at the usual fov and aspect.
export const MAX_WALK_NEAR = 0.3

/** Space-authored near plane, capped so walls cannot be clipped open. */
export function walkNear(near) {

	return Math.min(near || NEAR, MAX_WALK_NEAR)
}

export const FAR = 1500

export const PLAYER_CAMERA_SENSITIVITY = 0.5;

// export const MAX_ZOOM_OUT_FACTOR = 2.4;

export const CAMERA_HEIGHT = 3.36

export var VRM_CAMERA_HEIGHT = 2.6


export const SET_CAMERA_HEIGHT_VRM = function( val ){

	VRM_CAMERA_HEIGHT = val
}

export const GET_CAMERA_HEIGHT = function(){

	return  VRM_CAMERA_HEIGHT
}

export const MAX_ZOOM_OUT = 1.8 * CAMERA_HEIGHT;

export const MIN_ZOOM_OUT = CAMERA_HEIGHT;


export const PLAYER_TRANSITION_TYPE = {

    ZOOM_IN: "ZOOM_IN",

    ZOOM_OUT: "ZOOM_OUT"
}

export const DIRECTION = {

    FORWARD     : new Vector3(0, 0, 1).normalize(),

    BACKWARD    : new Vector3(0, 0, -1).normalize(),

    LEFT        : new Vector3(1, 0, 0).normalize(),

    RIGHT       : new Vector3(-1, 0, 0).normalize(),
}


export const JOYSTICK_DIRECTIONS = {
    RIGHT: [0, 8, 1, 7],
    LEFT: [4, 5, 3],
    UP: [2, 1, 3],
    DOWN: [6, 5, 7],
    RIGHT_OR_LEFT_ONLY: [4, 0, 8],
    // RIGHT: 0 AND 8
    // "UP-RIGHT": 1,
    // UP: 2,
    // "UP-LEFT": 3,
    // LEFT: 4,
    // "DOWN-LEFT": 5,
    // DOWN: 6,
    // "DOWN-RIGHT": 7,
};
