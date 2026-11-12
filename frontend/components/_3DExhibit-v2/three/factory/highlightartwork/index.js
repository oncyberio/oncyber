import {

	Mesh,

	Vector3,

	Quaternion,

	Scene,

	NearestFilter,

	Color,

	WebGPUCoordinateSystem

} from 'three'

import { RenderTarget } from 'three/webgpu'

const tempPosition = new Vector3()

const tempQuat = new Quaternion()

const tempScale = new Vector3()

import ParticlesEmitter from '@3factory/particles/emitter.js'

import MainScene from '@3scene'

import Camera from '@3camera'

import gsap from 'gsap'

import Triangle from "@3gl/globals/triangle";

import RenderMaterial from './rendermaterial/index.js'
import { SCENE_RENDER_ORDER } from '../../utils/sceneRenderOrder'

import Renderer from '@3renderer'

import {

	DEBUG,

	FBO_DEBUG

} from '@3constants'

import FBOHelper from '@3gl/globals/fbohelper.js'

import {

    HTML_MEDIA,
    IMAGE_MEDIA,
    MODEL_MEDIA,
    VIDEO_MEDIA,

}
from "@3utils/mediatype"

const rWidth = 8

// 2D artworks shrink slightly while the camera zooms in on them.
const HIGHLIGHT_SCALE = 0.95

const tempColor = new Color()

class HighlightFactory {

	constructor(){

		this.scene = new Scene()

		this.renderMaterial = new RenderMaterial()

		this.renderMesh = new Mesh(Triangle, this.renderMaterial )

		this.renderMesh.frustumCulled = false

		this.scene.add( this.renderMesh )

		this.rTarget = new RenderTarget(rWidth , rWidth, { magFilter: NearestFilter, minFilter: NearestFilter } )

		this.rTarget.generateMipmaps = false

		this.colorRequest = 0

		if( FBO_DEBUG ) {


			FBOHelper.attach(this.rTarget, 'color pick')
		}

	}

	get = ( opts ) => {

		const target = opts.renderMesh

		this.border = opts.instancedBorder

        console.log("this border this border this border this border", this.border)

		if(this.border) {

            this.border.visible = false
        }

		if( this.lines == null ) {

			this.createEnvironnement()
		}

		// The palette is read back from the GPU asynchronously: the lines
		// start once it is there, unless the highlight ended meanwhile.
		const request = ++ this.colorRequest

		this.getColors( target ).then( ( colors ) => {

			if( request != this.colorRequest ) return

			// this.lines.mesh.material.setColor( colors[0] )

			this.lines.mesh.geometry.setColor( colors )

			this.lines.mesh.position.copy( target.position )

			this.lines.mesh.rotation.copy( target.rotation )

			MainScene.add( this.lines.mesh )

			this.lines.play()
		} )

		this.store( target )

		return target
	}

    play() {

    }

	createEnvironnement(){

		this.lines = new ParticlesEmitter()

		this.lines.mesh.renderOrder = SCENE_RENDER_ORDER.artworkParticles

	}

	async getColors( target ){

		// console.log( target )

		var colors = [ [1.0, 0.768, 0.627] ]

		// get 2D map directly or

		var map = target.material?.map

		if( map == null ) {

			// traverse 3D objects

			target.traverse(( child )=>{

				if( child.material ) {

					if( child.material.map ) {

						map = child.material.map
					}
				}
			})
		}

		if( map != null ){

			this.renderMaterial.map = map

			const previousRenderTarget = Renderer.getRenderTarget()

			Renderer.setRenderTarget( this.rTarget )

			Renderer.render(this.scene, Camera.current)

			Renderer.setRenderTarget( previousRenderTarget )

			const pixels = await Renderer.readRenderTargetPixelsAsync( this.rTarget, 0, 0, rWidth, rWidth )

			// WebGPU pads rows (256 bytes) and reads top-down; keep the WebGL bottom-up order.
			const stride = ( pixels.length - rWidth * 4 ) / ( rWidth - 1 )

			const flip = Renderer.coordinateSystem === WebGPUCoordinateSystem

			this.pxBuffer = new Uint8Array( 4 * rWidth * rWidth )

			for( let row = 0; row < rWidth; row ++ ) {

				const src = ( flip ? rWidth - 1 - row : row ) * stride

				this.pxBuffer.set( pixels.subarray( src, src + rWidth * 4 ), row * rWidth * 4 )
			}

			let i = 0

			colors = []

			// console.log(this.pxBuffer)

			while(i < (rWidth * rWidth * 4) ) {

				// const up = Math.random() * 0.2 + 0.1
				const up = 0

				tempColor.setRGB(
					Math.min( ((this.pxBuffer[ i ]    / 255) + 0.1) * 1.5, 1.0) ,
					Math.min( ((this.pxBuffer[ i+1 ]  / 255) + 0.1) * 1.5, 1.0) ,
					Math.min( ((this.pxBuffer[ i+2 ]  / 255) + 0.1) * 1.5, 1.0)
				)

				if( Math.random() > 0.85 ) {

					colors.push( [1, 1, 1] )
				}

				else {

					colors.push( [tempColor.r, tempColor.g, tempColor.b] )

				}


				i+=4
			}

		}

		return colors
	}


	store( target ){

		const mediaType = target.mediaType

		this.is2D = mediaType == IMAGE_MEDIA || mediaType == VIDEO_MEDIA


        target.isTransitionning = true

		// if object 3D
		if ( target.children.length > 0 && this.is2D == false ) {

			target.highlightInfos = {

				previousParent   : target.parent,

				previousPosition : target.position.clone(),

				previousQuaternion : target.quaternion.clone(),

				previousScale : target.scale.clone(),

				// previousRenderOrder   : target.renderOrder,

				// previousTransparency : target.material.transparent,

				// previousDepthTest : target.material.depthTest,

				// previousDepthWrite : target.material.depthWrite
			}

			// console.log()

			target.traverse(( child )=>{

				if( child.material ) {

					child.highlightInfos = {

						previousRenderOrder   : child.renderOrder,

						previousTransparency  : child.material.transparent,

					}

					child.material.transparent = true

					child.renderOrder = SCENE_RENDER_ORDER.artwork
				}
			})
		}

		else {


			target.highlightInfos = {

				previousParent   : target.parent,

				previousPosition : target.position.clone(),

				previousQuaternion : target.quaternion.clone(),

				previousScale : target.scale.clone(),

				previousRenderOrder   : target.renderOrder,

				previousTransparency : target.material.transparent,

				previousDepthTest	 : target.material.depthTest,

				previousDepthWrite : target.material.depthWrite

			}

			target.material.transparent = true

			target.renderOrder = SCENE_RENDER_ORDER.artwork

			target.material.depthTest = false

		}


		target.matrixWorld.decompose( tempPosition, tempQuat, tempScale )

		target.position.copy(tempPosition )

		target.quaternion.copy(tempQuat )

		target.scale.copy( tempScale )


		if( this.tween ){

			this.tween.kill()

			this.tween = null
		}

		if( this.is2D ) {

			this.tween = gsap.to( target.scale, {

				duration : 1.,

				x : tempScale.x * HIGHLIGHT_SCALE,
				y : tempScale.y * HIGHLIGHT_SCALE,
				z : tempScale.z * HIGHLIGHT_SCALE,

				ease: "power1.inOut",

			})
		}
	}

	async restore( target ){

		// drop a palette still being read back
		this.colorRequest ++


		if( this.tween ) {

			this.tween.kill()

			this.tween = null

		}

        target.isTransitionning = false

		target.highlightInfos.previousParent.add( target )

		target.position.copy( target.highlightInfos.previousPosition )

		target.quaternion.copy( target.highlightInfos.previousQuaternion )

		target.scale.copy( target.highlightInfos.previousScale )


		// if 3D object
		if ( target.children.length > 0 && this.is2D == false ) {

			target.traverse(( child )=>{

				if( child.material ) {

					child.material.transparent  = child.highlightInfos.previousTransparency

					child.renderOrder 			= child.highlightInfos.previousRenderOrder
				}
			})
		}

		else {

			target.material.depthTest = target.highlightInfos.previousDepthTest

			target.material.transparent = target.highlightInfos.previousTransparency

			target.renderOrder 			= target.highlightInfos.previousRenderOrder
		}

		target.highlightInfos = null

		if(this.border) {

            this.border.visible = true

		    this.border = null
        }

		MainScene.remove( this.lines.mesh )

		this.lines.stop()
	}
}

export default new HighlightFactory()