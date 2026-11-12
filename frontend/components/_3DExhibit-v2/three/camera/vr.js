// @ts-check

import {

	PerspectiveCamera
} from 'three'



import emitter from '@3emitter'

import Events from '@3events'

import { FOV, NEAR, FAR } from './constants'


export class VRCamera extends PerspectiveCamera {

	constructor(fov, aspect, near, far) {

		super(fov, aspect, near, far)

        this.resizeEvent = this.resize.bind(this)

        emitter.on(Events.RESIZE, this.resizeEvent )
	}

    /**
     *
     * @param { import('@gltypes').SpaceData } space
     * @param {  import('@uitypes/roomParameters').RoomParameters } roomParameters
     */
     setSpace (space, roomParameters) {

        this.currentSpace = space

        this.roomParameters = roomParameters
    }

    activate(){

		this.active = true

	}

	desactivate(){

		this.active = false
	}

	resize(w, h) {

		this.aspect = w / h

		this.updateProjectionMatrix()
	}

}

export default new VRCamera(FOV, 1, NEAR, FAR )

