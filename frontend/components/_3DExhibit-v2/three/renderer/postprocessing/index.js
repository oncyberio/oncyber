import {

	RenderTarget,

	Color,

	LinearFilter,

	HalfFloatType

} from 'three/webgpu'

import Renderer from '@3renderer'

import {

	DEBUG,
	
	FBO_DEBUG,
	
	DPI,

	IS_FUTURE,

	CURRENT_SPACE
	
} from '@3constants'

import Quad from './quad'

import Emitter from '@3emitter'

import FBOHelper from '@3gl/globals/fbohelper.js'

import Events from  '@3events'

import Shared from '@3shared'

import { POST_PROCESSINGS, POST_TYPES } from "@3editgui/index.js"

class PostProcessing {

	constructor() {

		// Linear half-float targets: the renderer converts the final kernel
		// output to sRGB. Depth + stencil for the portals drawn into it.
		this.settings =  {

			minFilter: LinearFilter,

			magFilter: LinearFilter,

			type: HalfFloatType,

			stencilBuffer: true,

			depthBuffer: true,

			generateMipmaps: false

		}


		this.target = new RenderTarget(1, 1, this.settings)

		this.occlusion = new RenderTarget(1, 1, this.settings)


		if(FBO_DEBUG){

			FBOHelper.attach(this.target, 'color')

			FBOHelper.attach(this.occlusion, 'occlusion')

		}

		this.isLightingEnabled = false


		this.quad = new Quad()

		this.addEvents()

		this.oldClearColor = new Color()

		this.resize(window.innerWidth, window.innerHeight)

		this.previousLightingRenderSetting = null

	}


	/**
	 * A throw inside the renderer stops the frame before it puts its output
	 * target back, and every later frame then draws into that offscreen
	 * target: the view stays black for good. Put the renderer back so the
	 * next frame can draw, and report the error once.
	 */
	render(scene, camera, roomParameters, target, debug = false ) {

		const renderTarget = Renderer.getRenderTarget()

		const callDepth = Renderer._callDepth

		const autoClear = Renderer.autoClear

		try {

			this.renderFrame(scene, camera, roomParameters, target, debug)
		}
		catch( err ) {

			Renderer.setRenderTarget( renderTarget )

			Renderer.autoClear = autoClear

			if( typeof callDepth === "number" ) Renderer._callDepth = callDepth

			const key = String( err?.message || err )

			this.reportedErrors ??= new Set()

			if( !this.reportedErrors.has( key ) ) {

				this.reportedErrors.add( key )

				console.error( "[PostProcessing] frame failed", err )
			}
		}
	}

	renderFrame(scene, camera, roomParameters, target, debug = false ) {

		if ( roomParameters?.lighting?.enabled == true  ) {

			// if( this.previousLightingRenderSetting != true ) {

				Emitter.emit(Events.LIGHTING, true )
			// }

			this.previousLightingRenderSetting = true
			

		}
		else {

			// if( this.previousLightingRenderSetting != false ) {

				Emitter.emit(Events.LIGHTING, false )
			// }

			this.previousLightingRenderSetting = false
		}

		// if ( roomParameters?.lighting?.enabled == true && this.isLightingEnabled == false ) {

		// 	this.isLightingEnabled = true

		// 	Emitter.emit(Events.LIGHTING, true )

		// }
		// else {

		// 	if( this.isLightingEnabled == true ) {

		// 		Emitter.emit(Events.LIGHTING, false )
					
		// 	}

		// }

		Emitter.emit(Events.PRE_RENDER, scene, camera )

		if ( roomParameters?.usePostProcessing?.enabled == true ) {


			let oldSSRendering = Shared.isDynamicRendering.value

			Shared.isDynamicRendering.value = 0.0


			const type = roomParameters?.usePostProcessing.type

			let oldRenderTarget = Renderer.getRenderTarget()

			let oldAutoClear = Renderer.autoClear

			Renderer.autoClear = false

			// diffuse

			Renderer.setRenderTarget(this.target)

			Renderer.clear(true,true,false)

			Renderer.render(scene, camera)

			if( type == POST_TYPES.BLOOM || type == POST_TYPES.CYBERCITY ) {

				// console.log(' render occlusion ')

				this.renderOcclusionTarget(scene, camera)
			}

			this.quad.render(this.target, this.occlusion, roomParameters, target)

			if(oldRenderTarget != Renderer.getRenderTarget()){

				Renderer.setRenderTarget(oldRenderTarget)	
			}

			Renderer.autoClear = oldAutoClear

			Shared.isDynamicRendering.value = oldSSRendering

		}

		else {

			if( target != null ) {

				Renderer.setRenderTarget( target )
			}

			Renderer.render(scene, camera)
		}

	}

	renderOcclusionTarget(scene, camera){

		let oldRenderTarget = Renderer.getRenderTarget()

		Renderer.getClearColor( this.oldClearColor )

		Renderer.setClearColor(0x000000)

		Renderer.setRenderTarget(this.occlusion)

		Emitter.emit(Events.OCCLUSION, true)

		let oldAutoUpdate = scene.matrixWorldAutoUpdate
		let oldCameraAutoUpdate = camera.matrixWorldAutoUpdate

		scene.matrixWorldAutoUpdate = false

		camera.matrixWorldAutoUpdate = false

		Renderer.clear(true,true,false)

		let oldResolution = {

			x: Shared.resolution.value.x,

			y: Shared.resolution.value.y
		}

		Shared.resize( oldResolution.x * 0.5, oldResolution.y * 0.5 )

		// resize
		// this.resolution.value.set(w, h)

		Renderer.render(scene, camera)

		scene.matrixWorldAutoUpdate = oldAutoUpdate

		camera.matrixWorldAutoUpdate = oldCameraAutoUpdate

		Emitter.emit(Events.OCCLUSION, false)

		Renderer.setClearColor(this.oldClearColor)

		if(oldRenderTarget != Renderer.getRenderTarget()){

			Renderer.setRenderTarget(oldRenderTarget)	
		}

		Shared.resize( oldResolution.x, oldResolution.y )

	}

	resize(w, h, forceDPI = null ) {

		this.width = w 

		this.height = h

		const calcDPI = forceDPI == null ? DPI : forceDPI

		this.target.setSize(Math.floor(w  * calcDPI), Math.floor(h  * calcDPI))

		this.occlusion.setSize(Math.floor(w  * calcDPI * 0.5 ), Math.floor(h  * calcDPI * 0.5 ))

		// console.log( this.quad )

		this.quad.resize(w, h, calcDPI)
	}

	addEvents() {

		Emitter.on( Events.RESIZE, this.resize.bind(this))
	}
}

export default new PostProcessing()