// @ts-check

import {

    Object3D,

	PerspectiveCamera,

	Vector3

} from 'three'

import {

	CANVAS,

	CURRENT_SPACE,

	DEBUG,

    DOWN_VECTOR

} from '@3constants'


import CameraUtils from './utils'


import emitter from '@3emitter'

import Events from '@3events'

import { OrbitControls } from './controls/orbitcontrols'

const tempVec = new Vector3()

const tempVec2 = new Vector3()

const leftVec  = new Vector3(-1, 0, 0)
const rightVec = new Vector3(1, 1, 0)

const upVector = new Vector3(0, 1, 0)

const animRadius = 0.15

const MAX_360_TESTS = 6

import gsap from 'gsap'

const tempvec = new Vector3()

import AbstractCamera from './abstract.js'


class ExpositionCamera extends AbstractCamera {

	constructor(fov, aspect, near, far) {

		super(fov, aspect, near, far)

		this.position.set(-10, 0, 0)

		if( DEBUG ){
            // @ts-ignore
			window.debugcamera = this
		}

	}

	setState( state, opts ){

		this.position.copy(opts.position)

		this.controls.target.copy( opts.lookAt )

		this.controls.update()

        this.getWorldDirection(tempvec)

        tempvec.normalize()

        this.position.copy( opts.position )

        const newPos = {
            x: opts.position.x + -tempvec.x * animRadius,
            y: opts.position.y + -tempvec.y * animRadius,
            z: opts.position.z + -tempvec.z * animRadius
        }
        if( this.tween ) {

            this.tween.kill()

            this.tween = null
        }

        this.position.copy(newPos)

        this.tween = gsap.to(this.position, {

            x: opts.position.x,
            y: opts.position.y,
            z: opts.position.z,
            ease: 'power2.easeOut',
            duration: 1.3
        })

	}

	activate(){

		this.active = true

		if( this.controls == null ) {

			this.controls = new OrbitControls(this, CANVAS.parentElement)

			this.controls.target.set( 0, 0, 0 )

            this.controls.enablePan  = false

            this.controls.enableKeys = false

			this.controls.enableRotate = true

			this.controls.update()
		}

	}

	desactivate(){

		this.active = false

		if(this.controls){

			this.controls.dispose()

			this.controls = null
		}

	}


    /** @param { { target: Object3D, lookAtDistance: number, checkCollitions: boolean } } opts */
	getTargetPosition (opts) {


		const target = opts.target

	    let distance = opts.lookAtDistance

        let meshPos = target.getWorldPosition(new Vector3())

        let meshDir = target.getWorldDirection(new Vector3())

        let targetPos = meshPos.clone().add(meshDir.setLength(distance))

        let collitionMode = false

        if(opts.checkCollitions) {


            // Check if distance will fall outside the room

            let result = CameraUtils.intersectRay(meshPos, meshDir)

            if(result != null && result.distance < distance && result.distance > CURRENT_SPACE.roomParameters.user_height) {

                console.log("Transition will fall outside", distance, " > ", result.distance)

                console.log(result.triangle)

                distance = result.distance - CameraUtils.playerRadius

                targetPos.copy(meshPos).add(meshDir.setLength(distance))

            }

            // Compute correct user height at the end of the transition

            let currentHeight = CameraUtils.intersectRay(this.position, DOWN_VECTOR)?.distance || -1

            console.log("current height", currentHeight)

            let targetHeight = CameraUtils.distanceToFloor(targetPos)

            console.log("target height", targetHeight)

            // If there's no floor most likely we're outside of the room
            // reset to a safe distance then recomputes the final user height

            let testDistance = Math.max(CURRENT_SPACE.roomParameters.user_height * 4, opts.lookAtDistance) * 2

            let indexTest = 0

          


            if( this.testDistance( meshPos, targetPos) < CURRENT_SPACE.roomParameters.user_height * 0.2){

                targetHeight = Infinity

            }

            // const testnb = 6

            while(targetHeight === Infinity) {


                if(testDistance < CURRENT_SPACE.roomParameters.user_height) {

                    console.log("No safe place: abort transition")

                    

                    // TODO
                    return meshPos.clone().add(meshDir.setLength(distance))
                }


                if( target.mediaType == 'MODEL' ) {

                    indexTest++

                    if( indexTest > MAX_360_TESTS ) {

                        testDistance = 0
                    }

                    else {

                        targetHeight = this.get360Degree( targetHeight, distance,meshPos, targetPos, indexTest )
                    }
                }
                else {

                    console.log("mmm artwork seems to be outside?")

                    // test with a smaller distance
                    testDistance = testDistance / 2

                    distance = testDistance

                    targetPos.copy(meshPos).add(meshDir.setLength(distance))

                    targetHeight = CameraUtils.distanceToFloor(targetPos)
                }
            }


            if(targetHeight < 0 || currentHeight < 0) {

                targetPos.y = Math.max(this.position.y, meshPos.y)

                collitionMode = true

            }
            else if(currentHeight !== targetHeight) {

                targetPos.y -= targetHeight - currentHeight

                // Check final Y position
                CameraUtils.targetCollitions(targetPos)

                console.log("Correcting final Y", targetHeight, "current height", currentHeight, "target height", targetHeight)
            }
        }

        return targetPos
	}

    testDistance(meshPos , targetPos ){

        var a = meshPos.x - targetPos.x;
        var b = meshPos.z - targetPos.z;

        var c = Math.sqrt( a*a + b*b );

        return c
    }

    get360Degree( targetHeight, distance, meshPos, targetPos, indexTest ){

        let r = distance * 1.5

        let ang = this.degrees_to_radians(indexTest * (360 / MAX_360_TESTS))

        tempVec.x = r * Math.cos(ang)

        tempVec.z = r * Math.sin(ang)

        targetPos.copy(meshPos).add(tempVec)

        var result;

        result = CameraUtils.distanceToFloor(targetPos)

        if( result != Infinity) {

            tempVec2.subVectors( targetPos, tempVec ).normalize()

            tempVec2.cross( upVector ).normalize()

            let resultRight = CameraUtils.intersectRay(targetPos, tempVec2)

            tempVec2.x *= -1

            let resultLeft = CameraUtils.intersectRay(targetPos, tempVec2)

            if( resultRight != null && resultRight.distance < distance || resultLeft != null && resultLeft.distance < distance  ) {

                result = Infinity
            }
        }

        console.log(result)

        return result
    }

    degrees_to_radians(degrees)
    {
      var pi = Math.PI;
      return degrees * (pi/180);
    }

}

export default new ExpositionCamera(90, window.innerWidth / window.innerHeight, 0.1, 100000 )
