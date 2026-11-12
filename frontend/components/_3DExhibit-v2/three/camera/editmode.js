// @ts-check

import {

	PerspectiveCamera,

	Vector3

} from 'three'

import {

    APP_STATES,

	CANVAS,

	CURRENT_SPACE,

	DEBUG

} from '@3constants'

import Mediator from '@3mediator'

import emitter from '@3emitter'

import Events from '@3events'

import {EditModeControls} from './controls/editmodecontrols'

import { FAR, FOV, NEAR } from './constants';

import AbstractCamera from './abstract.js'

import { initCamera } from '../utils/camera'

class EditmodeCamera extends AbstractCamera {

	constructor(fov, aspect, near, far) {

		super(fov, aspect, near, far)


		if( DEBUG ){
            // @ts-ignore
			window.editmodecamera = this
		}

        // window.editCamera = this
	}

	setControls( val ){

		this.controls = val
	}

    setState(STATE, opts){

		return new Promise(async (resolve)=>{

			switch (STATE) {


			    case APP_STATES.SPACE :

                    this.setSpace(opts.space || CURRENT_SPACE.space, opts.roomParameters || CURRENT_SPACE.roomParameters)

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

        this.currentSpace = space;

        this.roomParameters = roomParameters;

        initCamera(this.roomParameters, this)

        this.far = this.roomParameters.far || this.currentSpace.far

        // this.near = this.roomParameters.near || 0.5

        this.updateProjectionMatrix()


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

}

export default new EditmodeCamera(FOV, 1, NEAR, FAR)

