// @ts-check

import {

	PerspectiveCamera,

	Vector3

} from 'three'

import {

	CANVAS,

	CURRENT_SPACE,

	DEBUG

} from '@3constants'

import Mediator from '@3mediator'

import gsap from 'gsap'

import emitter from '@3emitter'

import Events from '@3events'

import { MapControls } from './controls/mapcontrols'

import { FOV } from './constants'



const ORIGIN = new Vector3(-1.888480015180983,  3.0183884700337007, -0.5683377736257895)

const ZOOMOUT = new Vector3(-300, 90, 100)



class MapCamera extends PerspectiveCamera {

	constructor(fov, aspect, near, far) {

		super(fov, aspect, near, far)

		this.rotation.order = 'YXZ'

		this.resizeEvent = this.resize.bind(this)

		this.position.copy(ORIGIN)

		emitter.on(Events.RESIZE, this.resizeEvent )

		if( DEBUG ){
            // @ts-ignore
			window.debugcamera = this
		}

		this.layers.enableAll()
	}

	reset() {

		this.position.set( -300, 90, 100)
	}


	activate(opts){

		this.active = true

		if( this.controls == null ) {

			this.controls = new MapControls(this, CANVAS.parentElement)

			this.controls.init()
		}

        this.controls.enabled = true

		this.controls.recalcTarget()

	}

	desactivate(){

		this.active = false

		if(this.controls){

			this.controls.enabled = false
		}

	}

	setState( STATE, opts ){}
	

	// async enter(init, target, transition) {

	// 	const finalPos = ZOOMOUT

	// 	if (!transition) {

	// 		this.position.copy(finalPos)

	// 		this.lookAt(target)
	// 	}
	// 	else {

	// 		this.position.copy(init.position)

	// 		this.quaternion.copy(init.quaternion)

	// 		// await this.transitionTo({

	// 		// 	position: finalPos,

	// 		// 	target
	// 		// })
	// 	}

	// 	this.activate()
	// }

	// async exit(final, transition) {

	// 	this.desactivate()

	// 	if (transition) {

	// 		await this.transitionTo(final)
	// 	}
	// }

	// _tmpLookat = new Vector3()

	// transitionTo ( opts ) {

	// 	var ease = "power1.inOut"

	// 	this._tweenPos?.kill()

	// 	this._tweenQuat?.kill()

	// 	const { position, target } = opts

	// 	let duration =  2;


	// 	const currentPos = {
	// 		x: this.position.x, y: this.position.y, z: this.position.z
	// 	}

	// 	const currentTarget = this.getWorldDirection(this._tmpLookat).add(this.position)

	// 	const endPos = {
	// 		x: position.x, y: position.y, z: position.z
	// 	}

	// 	const endTarget = {
	// 		x: target.x, y: target.y, z: target.z
	// 	}

	// 	const animPos = new Promise(resolve => {

	// 		this._tweenPos = gsap.to(currentPos, {
	// 			...endPos,
	// 			duration,
	// 			ease,
	// 			onUpdate: () => {
	// 				//
	// 				this.position.set(currentPos.x, currentPos.y, currentPos.z)
	// 			},
	// 			onComplete: resolve
	// 		})
	// 	})

	// 	const animQuat = new Promise(resolve => {

	// 		this._tweenQuat = gsap.to(currentTarget, {
	// 			...endTarget,
	// 			duration,
	// 			ease,
	// 			onUpdate: () => {
	// 				//
	// 				this.lookAt(currentTarget.x, currentTarget.y, currentTarget.z)
	// 			},
	// 			onComplete: resolve
	// 		})
	// 	})

	// 	return Promise.all([animPos, animQuat])
	// }

	resize(w, h) {

		this.aspect = w / h

		this.updateProjectionMatrix()
	}

}

export default new MapCamera(FOV, 1, 1, 10000 )
