// @ts-check

import {

    Euler,
	PerspectiveCamera,
    Vector3,
    Group

} from 'three'



import emitter from '@3emitter'

import Events from '@3events'

import ControlsFactory from './controls'

import { FOV, NEAR, FAR } from './constants';

import { USER_HEIGHT } from '../constants';



// import Raycaster

let normalV3 = new Vector3();

import AbstractCamera from './abstract.js'

import { initCamera } from '../utils/camera';

export class PortalCamera extends AbstractCamera {

	constructor(fov, aspect, near, far) {

		super(fov, aspect, near, far)

        this.prevPosition = new Vector3()

        this.prevRotation = new Euler()

        this.roomParameters = null

        this.currentSpace = null

	}

    /**
     *
     * @param { import('@gltypes').SpaceData } space
     * @param { import('@uitypes/roomParameters').RoomParameters } roomParameters
     * @param { import('@gltypes').TeleportState } backState
     */
    setSpace (space, roomParameters, backState ) {

        this.currentSpace = space;

        this.roomParameters = roomParameters;

        initCamera(this.roomParameters, this)

        if(backState != null) {

            this.position.copy(backState.backPosition)

            if(backState.backDirection) {

                this.lookAt(
                    backState.backDirection.clone().setY(0).add(this.position)
                );
            }
            else if(backState.backRotation) {

                this.rotation.x = this.rotation.z = 0

                this.rotation.y = backState.backRotation._y
            }
        }

        this.far = this.roomParameters?.far || this.currentSpace?.far

        this.updateProjectionMatrix()
    }

    async initControls() {

        this.controls = await ControlsFactory.get({

            space: this.currentSpace,

            isPreview: true,

            roomParameters: this.roomParameters,

            camera: this
        })


        // if(backState == null) {

        //     let result = this.controls.world?.floorIntersect (this.position)

        //     if(result) {

        //         this.position.y += USER_HEIGHT - result.position.y

        //         console.log("new Y position", this.position.y)
        //     }

        // }

        // if (this.controls.updatePlayer) {

        //     this.controls.updatePlayer(0,0)
        // }
    }

    get playerRadius() {

        return this.controls.playerRadius
    }

    distanceToFloor(point) {

        return this.controls.distanceToFloor?.(point) || -1
    }


	activate(){

        if( this.controls != null ) {


            this.position.copy(this.prevPosition);

            this.rotation.copy(this.prevRotation);

            this.controls.setCamera(this);

            this.controls.update(0, 0);

            this.controls.addEvents()
        }

		this.active = true
	}

	desactivate(){

        this.prevPosition.copy(this.position)

        this.prevRotation.copy(this.rotation)

		this.active = false

        if ( this.controls ) {

            this.controls.removeEvents()
		}
	}

    dispose() {

        this.controls?.removeEvents()

        this.controls?.dispose?.();

        if(this.resizeEvent != null) {

            emitter.off(Events.RESIZE, this.resizeEvent)
        }
    }

    static create() {

        return new PortalCamera(FOV, 1, NEAR, FAR)
    }
}

export default new PortalCamera(FOV, 1, NEAR, FAR )
