
// @ts-check

import { PerspectiveCamera, Scene, Vector2 } from "three"

import Renderer from '@3renderer'

import Camera from '@3camera'

import Emitter from '@3emitter'

import Events from '@3events'

import {

    CANVAS,
	CSS_FACTOR,
	VIEW,
	REAL_VIEW,
	IS_RECORDING,
    SET_CSS_CANVAS,
	CURRENT_SPACE

} from '@3constants'

import CurrentScene from '@3scene'

import { CSS3DRenderer, CSS3DObject } from './css3Drenderer.js'

class CSS3D {

	constructor(){

		this.renderer = new CSS3DRenderer()

        this.renderer.domElement.id = "CSS"

		this.renderer.domElement.style.position = 'absolute'

		this.renderer.domElement.style.width = '100%'

		this.renderer.domElement.style.height = '100%'

		this.renderer.domElement.style.top = "0"

        // this.renderer.domElement.style.pointerEvents = "none";

        this.renderer.domElement.style.backgroundColor = "black"

        this.renderer.domElement.style.zIndex = "0"

        this.scene = new Scene()

        this.camera = Camera.mainCamera.clone()

        this.cssFactor = CSS_FACTOR

        this.unscaleCameraFar = this.camera.far

        this.unscaleCamereNear = this.camera.near

        this.updateCSSCameraNearFar()
	}

    updateCSSCameraNearFar() {

        this.camera.far = this.unscaleCameraFar * this.cssFactor

        this.camera.near = this.unscaleCamereNear * this.cssFactor

        this.camera.updateProjectionMatrix()
    }

	update( roomParams ) {

		if (!this.active) return

		if(!IS_RECORDING && this.scene.children.length > 0){

			// console.log('update css')

            if(CSS_FACTOR !== this.cssFactor) {

                this.cssFactor = CSS_FACTOR

                this.updateCSSCameraNearFar()
            }

	        this.camera.position.copy(Camera.current.position).multiplyScalar(this.cssFactor)

	        this.camera.quaternion.copy(Camera.current.quaternion)

	        this.scene.fog = CurrentScene.fog

			this.renderer.render(this.scene, this.camera, this.cssFactor)
		}

	}

	set active(val){

        if(val === this._active) return

		this._active = val

		if(CANVAS.parentElement) {

            if ( val ) {

                SET_CSS_CANVAS(this.renderer.domElement)

                CANVAS.parentElement.insertBefore( this.renderer.domElement, CANVAS )

                this.addEvents()

                this.resize()
            }
            else if(this.renderer.domElement.parentElement) {

                SET_CSS_CANVAS(null)

                this.renderer.domElement.parentElement.removeChild( this.renderer.domElement )

                this.removeEvents()
            }
        }

	}

	get active(){

		return this._active

	}

	resize(w, h){

        this.renderer.setSize(REAL_VIEW.w, REAL_VIEW.h, false)

        this.camera.aspect = REAL_VIEW.w / REAL_VIEW.h

        this.camera.updateProjectionMatrix()

	}


	addEvents(){

		if( this.resizeEvent == null ){

			this.resizeEvent = this.resize.bind(this)

			Emitter.on(Events.RESIZE, this.resizeEvent)

			this.resize(REAL_VIEW.w, REAL_VIEW.h)

		}

		// if( this.updateEvent == null ) {

		// 	this.updateEvent = this.update.bind(this)

		// 	Emitter.on(Events.PRE_UPDATE, this.updateEvent)
		// }
	}

	removeEvents(){

		if ( this.resizeEvent ) {

			Emitter.off(Events.RESIZE, this.resizeEvent)

			this.resizeEvent = null
		}

		// if ( this.updateEvent) {

		// 	Emitter.off(Events.PRE_UPDATE, this.updateEvent)

		// 	this.updateEvent = null
		// }
	}
}

export default new CSS3D()
