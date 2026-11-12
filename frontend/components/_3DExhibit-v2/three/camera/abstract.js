import {

	PerspectiveCamera,

} from 'three'

import Emitter from '@3emitter'

import Events from '@3events'

import { FAR, FOV, NEAR, GET_RATIO_FOV } from './constants';

class AbstractCamera extends PerspectiveCamera {

	constructor(fov, aspect, near, far) {

		super(fov, aspect, near, far)

		this.resizeEvent = this.resize.bind(this)

		Emitter.on(Events.RESIZE, this.resizeEvent)

		this.layers.enableAll()

	}

	resize(w, h) {

		this.fov = GET_RATIO_FOV()

		this.aspect = w / h

		this.updateProjectionMatrix()
	}
}

export default AbstractCamera
