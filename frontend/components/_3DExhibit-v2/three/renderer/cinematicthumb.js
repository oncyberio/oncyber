import Camera 	from '@3camera'

import Emitter 	from '@3emitter'

import Events 	from '@3events'

import Scene 	from '@3scene'

import Renderer from '@3renderer'

import {

	VIEW,

	REAL_VIEW,

	RECORD_SIZE,

	CINEMATIC_PREVIEW_SIZE,

	CINEMATIC,

} from '@3constants'

const ratio = 0.25

import Root from '@3gl/root'

import PostProcessing from "./postprocessing"

import { Color, Mesh, NoBlending, Vector2 } from 'three'

import { MeshBasicNodeMaterial } from 'three/webgpu'

import { positionGeometry, uniform, vec4 } from 'three/tsl'

import Triangle from "@3gl/globals/triangle"

const size = new Vector2()

const clearColor = new Color()

/**
 * WebGPU clears whole attachments (load ops ignore the scissor), so the
 * preview rectangle is "cleared" by drawing this full-viewport triangle.
 * Colours go in linear; alpha is written as is (premultiplied, like a clear).
 */
class ViewportFill extends Mesh {

	constructor() {

		const color = uniform( new Color() )

		const alpha = uniform( 0 )

		const material = new MeshBasicNodeMaterial({

			blending: NoBlending,

			depthTest: false,

			depthWrite: false,

			fog: false
		})

		material.vertexNode = vec4( positionGeometry.xy, 0.0, 1.0 )

		material.colorNode = vec4( color, alpha )

		super( Triangle, material )

		this.frustumCulled = false

		this.color = color

		this.alpha = alpha
	}

	/**
	 * @param { Color } linearColor
	 * @param { number } a
	 */
	draw( linearColor, a, camera ) {

		// WebGL premultiplied the sRGB clear value: srgb( c ) * a
		this.color.value.copy( linearColor ).convertLinearToSRGB().multiplyScalar( a ).convertSRGBToLinear()

		this.alpha.value = a

		Renderer.render( this, camera )
	}
}

class CinematicThumb {

	constructor() {

		this.fill = null
	}

	/**
	 * Viewport / scissor are top-left based on WebGPURenderer (both backends);
	 * the preview rectangle is given from the bottom like WebGL's.
	 */
	setRect( left, bottom, width, height ) {

		Renderer.getSize( size )

		const top = size.y - bottom - height

		Renderer.setViewport( left, top, width, height )

		Renderer.setScissor( left, top, width, height )
	}


	render(scene, camera, opts ){

		// render cinematic thumb


		if( Camera.cinematic &&  Camera.current == Camera.cinematic.editcamera  ){

			// console.log(CINEMATIC_PREVIEW_SIZE)

			if( CINEMATIC_PREVIEW_SIZE.w == 0 || CINEMATIC_PREVIEW_SIZE.h == 0  ) {

				return
			}



		    Emitter.emit(Events.CINEMATIC_RENDER, true)

		    this.oldAutoClear = Renderer.autoClear

		    Renderer.autoClear = false

		    Renderer.clearDepth()

		    Renderer.setScissorTest(true)

		    const aspect = CINEMATIC_PREVIEW_SIZE.h / CINEMATIC_PREVIEW_SIZE.w

		    const oldAspectRatio = Camera.cinematic.displaycamera.aspect

		    Camera.cinematic.displaycamera.aspect = 1 / aspect

		    Camera.cinematic.displaycamera.updateProjectionMatrix()



		    if( CINEMATIC  == true || Camera.cinematic.advanced ) {

		    	this.setRect( CINEMATIC_PREVIEW_SIZE.left, CINEMATIC_PREVIEW_SIZE.bottom, VIEW.w * 0.25, VIEW.w * 0.25 * aspect )

		    }
		    else {

		    	const ratio = VIEW.w / REAL_VIEW.w

		    	this.setRect( CINEMATIC_PREVIEW_SIZE.left * ratio, CINEMATIC_PREVIEW_SIZE.bottom * ratio, CINEMATIC_PREVIEW_SIZE.w  * ratio, CINEMATIC_PREVIEW_SIZE.h  * ratio)

		    }

		    // new api

		    if( this.fill == null ) this.fill = new ViewportFill()

		    // A colour background would force-clear the whole canvas on WebGPU;
		    // fill the rectangle with it instead and render without it.
		    const background = Scene.background

		    const colorBackground = background?.isColor === true

		    if( colorBackground ) {

		    	this.fill.draw( background, 1, Camera.cinematic.displaycamera )

		    	Scene.background = null
		    }
		    else {

		    	this.fill.draw( Renderer.getClearColor( clearColor ), Renderer.getClearAlpha(), Camera.cinematic.displaycamera )
		    }



		    // const prevVisibility =  Root.currentArtworks.visible

		 	var previousVisibility = false

		    if( Root.currentArtworks?.artworks ) {

		    	Root.currentArtworks.artworks.forEach(( artwork )=>{

		    		if( artwork.isPlaceholder ) {

		    			previousVisibility = artwork.visible

		    			artwork.visible = false
		    		}
		    	})
		    }

		    Camera.updateFrustum( Camera.cinematic.displaycamera )

		    Emitter.emit(Events.PRE_RENDER, Scene, Camera.cinematic.displaycamera )


		    PostProcessing.render(Scene, Camera.cinematic.displaycamera, opts || {} )
		    // Renderer.render(Scene, Camera.cinematic.displaycamera)

		    if( colorBackground ) Scene.background = background

		    Camera.cinematic.composer.render()

		    Renderer.setViewport(0, 0, VIEW.w, VIEW.h)

		    Renderer.setScissor( 0, 0, VIEW.w, VIEW.h)

		    Camera.cinematic.displaycamera.aspect = oldAspectRatio

		    Camera.cinematic.displaycamera.updateProjectionMatrix()


		    Renderer.autoClear = this.oldAutoClear


		    Emitter.emit(Events.CINEMATIC_RENDER, false)

		    Renderer.setScissorTest(false)


		    if( Root.currentArtworks?.artworks ) {

		    	Root.currentArtworks.artworks.forEach(( artwork )=>{

		    		if( artwork.isPlaceholder ) {

		    			artwork.visible = previousVisibility
		    		}
		    	})
		    }


		   




		    // Root.currentArtworks.visible = prevVisibility

		    // camera.main.desactivate()

		}

		// else if( Camera.cinematic &&   Camera.cinematic.composerActive ) {

		// 	 Camera.cinematic.composer.render()
		// }


	}

}

export default new CinematicThumb()
