// @ts-check

import {

	PerspectiveCamera,

	Frustum

} from 'three'

import {

	DEBUG

} from '@3constants'

import {

	CAMERA_LAYERS

} from '@3constants'

import emitter from '@3emitter'

import Events from '@3events'

class CinematicCamera extends PerspectiveCamera {

	constructor(fov, aspect, near, far) {

		super(fov, aspect, near, far)

		this.resizeEvent = this.resize.bind(this)

		this.name = 'CinematicCamera'

		emitter.on(Events.RESIZE, this.resizeEvent )

		if( DEBUG ){
            // @ts-ignore
			window.cinematiccamera = this
		}

		this.layers.enableAll()

		this.layers.disable( CAMERA_LAYERS.SITTING_ZONE )

	}

	activate(){

		this.active = true
	}

	desactivate(){

	}

	resize(w, h) {

		this.aspect = w / h

		this.updateProjectionMatrix()
	}

}

export default new CinematicCamera(65, 1, 0.5, 15000 )
