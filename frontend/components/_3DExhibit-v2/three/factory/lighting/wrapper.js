import {

	Object3D,

	CameraHelper,

	DirectionalLightHelper,

	DirectionalLight,

	AmbientLight

} from 'three'

import {

	DEBUG,

	UPLOADER_MODE,

	EDIT_MODE,

	FBO_DEBUG,

	SHADOW_NEEDS_UPDATE,

	SET_SHADOW_NEEDS_UPDATE

} from '@3constants'

import FBOHelper from '@3gl/globals/fbohelper.js'
   // 63          if( FBO_DEBUG ) {
   // 64
   // 65:            // FBOHelper.attach(this, 'yolo'+Math.random())
   // 66          }

import gui from '@3gui'

import Emitter from '@3emitter'

import Events from '@3events'

const SHADOW_MAP_WIDTH = 2048

import Renderer, { registerShadow } from '@3renderer'

import Mediator from '@3mediator'

import gsap from 'gsap'

// const defaultParams = {
// 	fade: true,
// 	lightX: - 1,
// 	lightY: - 1,
// 	lightZ: - 1,
// 	posX: 200,
// 	posY: 200,
// 	posZ: 200,
// 	bias: -0.002,
// 	lightFar: 513,
// 	lightNear: 139.4,
// 	intensity: 1,
// 	size : 500,
// 	helper: false,
// 	enabled: false

// }

export default class LightingWrapper extends Object3D {

	constructor( opts = {}, scene ){

		super()

		this.meshCounts = 0

		this.parentScene = scene

		this.active = false

		this.opts = opts

		this.debugMapAttached = false

		this.opts = opts

		this.ambientLight = new AmbientLight( 0xffffff,  1 )

		this.add( this.ambientLight )

		this.needsRender = false

		this.addEvents()

		this.initiated = false

		if( this.opts && this.opts.enabled ){

			this.activate( opts )
		}

		window.lighting = this
	}

	init(){

		if( this.initiated == true ) {

			return
		}

		this.initiated = true

		this.directionalLight = new DirectionalLight( 0xffffff, 0.5 )

		this.unregisterShadow = registerShadow( this.directionalLight.shadow )

		this.directionalLight.position.set(0, 10, 0)

		this.directionalLight.castShadow = true

		this.directionalLight.shadow.mapSize.x = SHADOW_MAP_WIDTH
		this.directionalLight.shadow.mapSize.y = SHADOW_MAP_WIDTH

		this.directionalLight.position.copy(this.opts.lightPosition)

		//this.update(true)

		this.directionalLight.shadow.bias = this.opts.bias

		this.directionalLight.intensity = this.opts.intensity


		// if( DEBUG ) {

		// 	this.helper = new DirectionalLightHelper( this.directionalLight, 5 )

		// 	this.cameraHelper = new CameraHelper(this.directionalLight.shadow.camera)

		// 	const guilight = gui.folders.light

		// 	guilight.add( this.opts, 'helper' ).name( 'helper visible' ).onChange(  ( value ) => {

		// 		this.toggleHelpers()
		// 	} )


		// 	guilight.add( this.opts, 'bias', -0.01, 0.01 ).name( 'bias' ).onChange(  ( value ) => {

		// 		this.directionalLight.shadow.bias = this.opts.bias
		// 	} )


		// 	guilight.add( this.opts, 'intensity', 0, 5 ).name( 'light intensity' ).onChange(  ( value ) => {

		// 		this.directionalLight.intensity = this.opts.intensity

		// 		this.needsRender = true
		// 	} )


		// 	guilight.add( this.opts.lightDirection, 'x', - 1, 1 ).name( 'light direction x' ).onChange(  ( value ) => {

		// 		this.needsRender = true

		// 	} )

		// 	guilight.add( this.opts.lightDirection, 'y', - 1, 1 ).name( 'light direction y' ).onChange(  ( value ) => {

		// 		this.needsRender = true
		// 	} )

		// 	guilight.add( this.opts.lightDirection, 'z', - 1, 1 ).name( 'light direction z' ).onChange(  ( value ) => {

		// 		this.needsRender = true

		// 	} )

		// 	guilight.add( this.opts.lightPosition, 'x', - 200, 200 ).name( 'light position x' ).onChange(  ( value ) => {

		// 		this.directionalLight.position.x = value;

		// 		this.needsRender = true

		// 	} )

		// 	guilight.add( this.opts.lightPosition, 'y', - 200, 200 ).name( 'light position y' ).onChange(  ( value ) => {

		// 		this.directionalLight.position.y = value;

		// 		this.needsRender = true

		// 	} )

		// 	guilight.add( this.opts.lightPosition, 'z', - 200, 200 ).name( 'light position z' ).onChange(  ( value ) => {

		// 		this.directionalLight.position.z = value;

		// 		this.needsRender = true

		// 	} )

		// 	guilight.add( this.opts, 'size', 100, 1500 ).name( 'shadow size' ).onChange(  ( value ) => {

		// 		this.needsRender = true

		// 	} )

		// 	guilight.add( this.opts, 'near', 0, 500 ).name( 'camera near' ).onChange(  ( value ) => {

		// 		this.needsRender = true

		// 	} )

		// 	guilight.add( this.opts, 'far', 0, 1000 ).name( 'camera far' ).onChange(  ( value ) => {

		// 		this.needsRender = true

		// 	} )

		// }

		// this.addEvents()
	}

	activate(){

		if( this.active == false ) {

			this.init()

			Renderer.shadowMap.enabled = true

			this.ambientLight.intensity = 0.5

			this.active = true

			this.add( this.directionalLight )

			this.add( this.directionalLight.target )

			this.updateShadowCamera()

			this.needsRender = true

			this.addEvents()
		}
	}

	desactivate( force = false ){

		if( this.active ) {

			this.ambientLight.intensity = 1

			this.active = false

			this.remove( this.directionalLight )

			this.remove( this.directionalLight.target )

			Renderer.shadowMap.enabled = false

			Renderer.shadowMap.autoUpdate = false

			if( force != false &&  this.directionalLight && this.directionalLight.shadow.map ) {

				const target = Renderer.getRenderTarget()

				Renderer.setRenderTarget(this.directionalLight.shadow.map)

				Renderer.clear(true,true,false)

				Renderer.setRenderTarget( target )

			}

			this.toggleHelpers( false )
		}

	}

	render( val ){

		if( this.opts.enabled ) {

			this.activate()

			if( UPLOADER_MODE || EDIT_MODE ) {

				this.opts.helper = this.opts.helper
			}
			else {

				this.opts.helper = false
			}

			this.toggleHelpers()

			if( FBO_DEBUG && this.debugMapAttached == false && this.directionalLight.shadow.map ) {

				FBOHelper.attach(this.directionalLight.shadow.map, 'shadowmap')

				this.debugMapAttached = true
			}

			this.directionalLight.position.copy(this.opts.lightPosition)

			this.directionalLight.intensity = this.opts.intensity

			this.directionalLight.target.position.copy(this.directionalLight.position)

			this.directionalLight.target.position.add(this.opts.lightDirection)

			if( this.helper ) {

				if(this.opts.helper) {

					this.updateShadowCamera()

					this.helper.update()

					this.cameraHelper.update()

				}
			}

			// this.detectSceneChange()

			if( this.needsRender || val == true || SHADOW_NEEDS_UPDATE == true ) {

				console.log('UPDATE SHADOW ??')

				SET_SHADOW_NEEDS_UPDATE( false )

				// console.log('RENDER SHADOW MAP ')

				this.updateShadowCamera()


				Renderer.shadowMap.autoUpdate = true

				window.firstShadowRender = true

				this.needsRender = false

				if( this.promiseOff != null ) {

					this.promiseOff.kill()

					this.promiseOff = null
				}
			}

			else {


				// next two frames turn off

				if( this.promiseOff == null ) {

					this.promiseOff = gsap.delayedCall( 0.3,  ()=>{

						if( this.needsRender == false ) {



							this.promiseOff = null


                            Renderer.shadowMap.autoUpdate = false
						}

					} )

				}
			}

			// samsy

			// Renderer.shadowMap.autoUpdate = true

		}

		else {

			this.desactivate()
		}
	}

	detectSceneChange(){

		let count = 0

		this.parentScene.traverse((child)=>{

			if( child.material && child.castShadow ){

				count++
			}
		})

		let changed = this.meshCounts != count

		this.meshCounts = count

		if( changed ) {

			this.needsRender = true
		}

	}

	onOcclusion( val ){

		// return;

		if( val ){

			if( this.helper && this.opts.helper ) {

				this.helper.visible = false

				this.cameraHelper.visible = false
			}
		}
		else {

			if( this.helper && this.opts.helper ) {

				this.helper.visible = true

				this.cameraHelper.visible = true
			}
		}
	}

	toggleHelpers(){

		const value = this.opts.helper

		if( this.helper == null && value == true ) {

			this.helper = new DirectionalLightHelper( this.directionalLight, 5 )

			this.cameraHelper = new CameraHelper(this.directionalLight.shadow.camera)
		}

		if( this.helper ){

			if(value && this.opts.enabled ){

				this.add( this.helper )

				this.add(this.cameraHelper)
			}
			else{

				this.remove( this.helper )

				this.remove( this.cameraHelper )
			}
		}
	}

	addEvents(){

		if( this.updateEvent == null ) {

			this.updateEvent = this.render.bind(this)

			Emitter.on(Events.DUSK_UPDATE, this.updateEvent)

			if( UPLOADER_MODE || EDIT_MODE ) {

				this.occlusionEvent = this.onOcclusion.bind(this)

				Emitter.on(Events.OCCLUSION, this.occlusionEvent)

			}


			this.mirrorEvent = this.onOcclusion.bind(this)

			Emitter.on(Events.MIRROR, this.mirrorEvent)

			this.needsRender = true
		}

	}

	removeEvents(){

		if( this.updateEvent != null ) {

			Emitter.off(Events.DUSK_UPDATE, this.updateEvent)

			this.updateEvent = null

			if( UPLOADER_MODE || EDIT_MODE ) {

				Emitter.off(Events.OCCLUSION, this.occlusionEvent)

				this.occlusionEvent = null
			}

			Emitter.off(Events.MIRROR, this.mirrorEvent)

			this.mirrorEvent = null
		}
	}


	updateShadowCamera(){

		const size = this.opts.size
		const aspect = 1;

		const camera = this.directionalLight.shadow.camera

		camera.left = size * aspect / - 2;
		camera.right = size * aspect / 2;

		camera.top = size / 2;
		camera.bottom = size / - 2;


		camera.near = this.opts.near
		camera.far = this.opts.far

		camera.updateProjectionMatrix()

		// this.needsRender = true
	}

	dispose(){

		this.unregisterShadow?.()

		this.removeEvents()

		this.desactivate( true )

		if( this.directionalLight ) {

			this.remove(this.directionalLight)

			this.directionalLight.dispose()

			this.directionalLight = null
		}

		this.remove(this.ambientLight)

		this.ambientLight.dispose()

		this.ambientLight = null

		if( this.helper ) {

			this.helper.dispose()

			this.helper = null

			this.cameraHelper.dispose()

			this.cameraHelper = null
		}

		console.log('DISPOSE LIGHTING')
	}

}
