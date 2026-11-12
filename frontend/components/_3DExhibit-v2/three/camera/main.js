// @ts-check

import {

    Euler,
	MathUtils,
	Object3D,
	PerspectiveCamera,
    Vector3

} from 'three'

import gsap from 'gsap'



import emitter from '@3emitter'

import Events from '@3events'



import { APP_STATES } from '../constants'

// import Raycaster

import Camera from "@3camera"

import { FAR, FOV, NEAR, GET_RATIO_FOV, walkNear } from './constants';

import AbstractCamera from './abstract.js'

import { initCamera } from '../utils/camera'

class MainCamera extends AbstractCamera {

	constructor(fov, aspect, near, far) {

		super(fov, aspect, near, far)

        this.prevPosition = new Vector3()

        this.prevRotation = new Euler()

        this.roomParameters = null

        this.currentSpace = null
	}


    setState(STATE, opts){

		return new Promise((resolve)=>{


			switch (STATE) {

			    case APP_STATES.SPACE :

                    this.setSpace(opts.space, opts.roomParameters)

                    break;

                case APP_STATES.TELEPORT :

                    this.roomParameters = opts.roomParameters

                    this.currentSpace = opts.space

                    this.far = this.roomParameters.far || this.currentSpace.far

                    // this.near = this.roomParameters.near || 0.5

                    this.updateProjectionMatrix()

                    break;

			}

			resolve()
		})
	}

    /**
     *
     * @param { import('@gltypes').SpaceData } space
     * @param {  import('@uitypes/roomParameters').RoomParameters } roomParameters
     */
    setSpace (space, roomParameters) {

        if( space == null ) {

            return
        }

        this.currentSpace = space;

        this.roomParameters = roomParameters;

        initCamera(this.roomParameters, this)

        this.near = walkNear(this.roomParameters.near || this.currentSpace.near)

        this.far = this.roomParameters.far || this.currentSpace.far

        if( this.roomParameters.fog?.enabled == true ) {

            this.far =  this.roomParameters.fog.far
        }


        // this.near = 0.1

        this.updateProjectionMatrix()

        // @ts-ignore
        window.$mainCamera = this
    }

    reset() {
        initCamera(this.roomParameters, this)
    }

    activate(){

		this.active = true

	}

	desactivate(){

		this.active = false
	}

    get playerRadius() {
        return Camera.currentControls.playerRadius
    }
}

export default new MainCamera(FOV, 1, NEAR, FAR )
