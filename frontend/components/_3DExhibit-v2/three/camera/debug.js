// @ts-check

import {

	PerspectiveCamera,

	Vector3

} from 'three'

import {

	CANVAS,

	DEBUG

} from '@3constants'

import Mediator from '@3mediator'

import emitter from '@3emitter'

import Events from '@3events'

import { OrbitControls } from './controls/orbitcontrols'

const ORIGIN = new Vector3(-1.888480015180983,  3.0183884700337007, -0.5683377736257895)

const TARGET = new Vector3(-10.502310085718126, 0.581587538499533,  0.7745837808404059)

class DebugCamera extends PerspectiveCamera {

	constructor(fov, aspect, near, far) {

		super(fov, aspect, near, far)

		this.resizeEvent = this.resize.bind(this)

		this.position.copy(ORIGIN)

		emitter.on(Events.RESIZE, this.resizeEvent )

		if( DEBUG ){
            // @ts-ignore
			window.debugcamera = this
		}
	}

	activate(){

		this.active = true

		if( this.controls == null ) {

			this.controls = new OrbitControls(this, CANVAS.parentElement)

			this.controls.target.copy( TARGET )

			this.controls.enableRotate = true

			this.controls.update()
		}

	}

	desactivate(){

		this.active = false

		if(this.controls){

			this.controls.dispose()

			this.controls = null
		}

	}

	resize(w, h) {

		this.aspect = w / h

		this.updateProjectionMatrix()
	}

	setState( STATE, opts ){}

}

export default new DebugCamera(70, window.innerWidth / window.innerHeight, 0.1, 100000 )
