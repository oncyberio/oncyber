// @ts-check

import {

    MathUtils,
	Matrix4,
	PerspectiveCamera,

	Vector2,

	Vector3

} from 'three'

import {

    APP_STATES,

	CANVAS,

	DEBUG

} from '@3constants'

import Mediator from '@3mediator'

import emitter from '@3emitter'

import Events from '@3events'

import PlayerImageAvatar from "@3factory/player"


import Raycaster from '@3raycaster'

import { FAR, FOV,  NEAR, PLAYER_CAMERA_SENSITIVITY, PLAYER_TRANSITION_TYPE } from './constants'

import AbstractCamera from './abstract.js'

class SampleCamera extends AbstractCamera {

	constructor(fov, aspect, near, far) {

		super(fov, aspect, near, far)

		if( DEBUG ){
            // @ts-ignore
			window.camera = this
		}

	}

	setState( STATE, opts ){}

	activate(){

		this.active = true

	}

	desactivate(){

		this.active = false
	}

}

export default new SampleCamera(FOV, 1, NEAR, FAR )

