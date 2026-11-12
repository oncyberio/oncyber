// @ts-check

import {

	PerspectiveCamera,

	Vector3

} from 'three'

import {

	CANVAS,

	DEBUG

} from '@3constants'

import emitter from '@3emitter'

import Events from '@3events'

import { OrbitControls } from './controls/orbitcontrols'

const ORIGIN = new Vector3(-1.888480015180983,  3.0183884700337007, -0.5683377736257895)

const TARGET = new Vector3(-10.502310085718126, 0.581587538499533,  0.7745837808404059)

import { FAR, FOV, NEAR } from './constants'

class EditCinematicCamera extends PerspectiveCamera {

	constructor(fov, aspect, near, far) {

		super(fov, aspect, near, far)

		this.name = 'EditCinematicCamera'

		this.resizeEvent = this.resize.bind(this)

		this.position.copy(ORIGIN)

		emitter.on(Events.RESIZE, this.resizeEvent )

		if( DEBUG ){
            // @ts-ignore
			window.EditCinematicCamera = this
		}

        this.controls = new OrbitControls(this, CANVAS)

        this.controls.fixedPanDistance = 10

        this.controls.targetRecalc = true

	    this.controls.target.copy( TARGET )

	    this.controls.enableRotate = false

	    this.controls.enabled = false

	    this.controls.update()
	}

	activate(){

		this.controls.enabled = true

		this.controls.enableRotate = true
	}

	desactivate(){

        this.controls.enabled = false

        this.controls.enableRotate = false
	}

	resize(w, h) {

		this.aspect = w / h

		this.updateProjectionMatrix()
	}

}

export default new EditCinematicCamera(FOV, 1, NEAR, FAR )
