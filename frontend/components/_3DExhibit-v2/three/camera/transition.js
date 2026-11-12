// @ts-check

import {

    Box3,

    Mesh,

	PerspectiveCamera,

	Quaternion,

	Ray,

	Vector3

} from 'three'

import Emitter from '@3emitter'

import Players from "@3factory/player"

import Root from "@3gl/root"

import Cache from "@3modules/cache"

import {

	APP_STATES, CURRENT_SPACE, DOWN_VECTOR, IS_FIRST_PERSON, VIEW

} from '@3constants'

import Events from '@3events'

import Camera from "@3camera"

import gsap from 'gsap'

import { FOV, NEAR, FAR } from './constants'

import { copyCamera, projectPoint, unprojectPoint } from '@3utils/three'

import AbstractCamera from './abstract.js'
import { ModelSpaceArtwork } from '../factory/artwork/meshes/model/modelspaceartwork'

export class TransitionCamera extends AbstractCamera {

	constructor(fov, aspect, near, far){

		super(fov, aspect, near, far)

        this.targetRay = new Ray()

        this.prevPos = new Vector3()

        this.lookatPos = new Vector3()

        /** @type { Record<string, gsap.core.Animation> } */
        this.tweens = {}
	}

    setState(STATE, opts){

    	const ps = []

		return new Promise( async (resolve)=>{

			switch (STATE) {

                case APP_STATES.SPACE :

			    	copyCamera(opts.camera, this)

            		Camera.currentControls.setCamera( this )

			    	await this.moveTo(opts)

                    break;


			    case APP_STATES.TRANSITION :

			    	copyCamera(opts.camera, this)

            		Camera.currentControls.setCamera( this )

			    	if(opts.fadeTo) {

                        await this.fadInOut(opts.fadeTo)
                    }
                    else {

                        await this.moveToItem(opts)
                    }

                    break;
			}


			resolve()

		})
	}


    /** @param { { target: Mesh, lookAtDistance: number, highlight?: boolean, checkCollitions: boolean, viewOffset?: { x: number, y: number } } } opts */
	async moveToItem (opts) {

		var ease = "power2.inOut"

        if(opts.highlight) {

            ease = "power1.inOut"
        }

		else if( this.tweenPos ) {

			ease = "power2.Out"
		}

		this.killCurrentTweens()


		const target = opts.target


        const isModel = target instanceof ModelSpaceArtwork

	    let distance = opts.lookAtDistance

        let meshPos = target.getWorldPosition(new Vector3())

        let meshDir = target.getWorldDirection(new Vector3())

        let meshCenterPos = meshPos.clone()

        if(isModel) {

            let box = new Box3().setFromObject(target)

            box.getCenter(meshCenterPos)

            meshDir.copy(this.position).sub(meshCenterPos)
        }

        this.lookatPos.copy(meshCenterPos)

        let targetPos = meshCenterPos.clone().add(meshDir.setLength(distance))

        if(isModel) {

            // targetPos.y = Math.max(this.position.y, targetPos.y)
        }


        let collitionMode = false

        if(opts.checkCollitions) {

            // Check if distance will fall outside the room

            let result = this.intersectRay(meshPos, meshDir)

            if(result != null && result.distance < distance && result.distance > 2) {

                console.log("Transition will fall outside", distance, " > ", result.distance)

                console.log(result.triangle)

                distance = result.distance - (Camera.currentControls.world?.playerRadius || 1)

                targetPos.copy(meshPos).add(meshDir.setLength(distance))

            }

            // Compute correct user height at the end of the transition

            let currentHeight = this.intersectRay(this.position, DOWN_VECTOR)?.distance || -1

            console.log("current height", currentHeight)

            let targetHeight = this.distanceToFloor(targetPos)

            console.log("target height", targetHeight)

            // If there's no floor most likely we're outside of the room
            // reset to a safe distance then recomputes the final user height

            let testDistance = Math.max(9, opts.lookAtDistance) * 2

            while(targetHeight === Infinity) {

                if(testDistance < 2) {

                    console.log("No safe place: abort transition")

                    return
                }

                console.log("mmm artwork seems to be outside?")

                // test with a smaller distance
                testDistance = testDistance / 2

                distance = testDistance

                targetPos.copy(meshPos).add(meshDir.setLength(distance))

                targetHeight = this.distanceToFloor(targetPos)
            }



            if(targetHeight < 0 || currentHeight < 0) {

                targetPos.y = Math.max(this.position.y, meshPos.y)

                collitionMode = true

            }
            else if(currentHeight !== targetHeight) {

                targetPos.y -= targetHeight - currentHeight

                // Check final Y position
                this.targetCollitions(targetPos)

                console.log("Correcting final Y", targetHeight, "current height", currentHeight, "target height", targetHeight)
            }

            console.log("Target mesh pos", targetPos)

            if(collitionMode) {

                console.log("Running in collition mode")
            }
        }

        let offset = new Vector3();

        if(opts.viewOffset) {
            const pp1 = projectPoint(meshPos, this)
            const pp2 = { x: pp1.x + opts.viewOffset.x * 0.5, y: pp1.y + opts.viewOffset.y * 0.5, z: pp1.z }

            let mp1 = unprojectPoint(pp1, this)
            let mp2 = unprojectPoint(pp2, this)

            offset = mp2.sub(mp1)

            targetPos.add(offset)
        }

	    let currentLookAt = new Vector3(0, 0, -distance)
	        .applyQuaternion(this.quaternion)
	        .add(this.position)

	    let targetLookAt = new Vector3()
	        .copy(meshCenterPos.add(offset))
	        // .setY(Math.max(targetPos.y, meshPos.y))


	    const animationSpeed = 7; // speed per milliseconds

        const distanceToTraget = targetPos.distanceTo(this.position)

	    let duration =  opts.highlight ? 1 : Math.min( Math.max(distanceToTraget / animationSpeed, 0.8), 3 );

        if(distanceToTraget < 9 && !opts.highlight) {

            ease = "power2.Out"
        }

	    // moveTween = new TWEEN.Group();

	    // this.controls.isPlaying = true

	    const currentState = {
            x: this.position.x,
            y: this.position.y,
            z: this.position.z,
            opacity: 1,
        }

        const endState = {
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z,
            opacity: 0
        }

	    const animPos = new Promise(resolve => {
	        this.tweens.position = gsap.to(currentState, {
	            ...endState,
	            duration,
	            ease,
	            onUpdate: (e)=> {

                    if(collitionMode) {

                        this.prevPos.copy(this.position)

                        this.position.set(currentState.x, currentState.y, currentState.z)

                        if(this.playerCollitions(this.position) ) {
                            this.position.copy(this.prevPos)
                        }
                    }
                    else {
                        this.position.set(currentState.x, currentState.y, currentState.z)
                    }

                    if(!IS_FIRST_PERSON && Players.main && opts.highlight) {

                        Players.main.setOpacity(currentState.opacity)
                    }
	            },
	            onComplete: resolve
	        })
	    })

	    const animDir = new Promise(resolve => {
	        this.tweens.direction = gsap.to(currentLookAt, {
	            ...targetLookAt,
	            duration,
	            ease,
	            onUpdate: ()=> {
	                this.lookAt(currentLookAt)
	            },
	            onComplete: () => {
                    Camera.currentControls.setCamera(this)
                    resolve()
                }
	        })

	    })

        /*
        let animOffset;

        if(opts.viewOffset) {

            let currentOffset = {
                ...Camera.viewOffset
            }

            animOffset = new Promise(resolve => {
                this.tweenOffset = gsap.to(currentOffset, {
                    ...opts.viewOffset,
                    duration,
                    ease,
                    onUpdate: ()=> {
                        Camera.viewOffset.x = currentOffset.x
                        Camera.viewOffset.y = currentOffset.y
                    },
                    onComplete: () => {
                        Camera.currentControls.setCamera(this)
                        resolve()
                    }
                })

            })
        }
        */



	    await Promise.all([ animPos, animDir ]).then(()=>{

	    	this.killCurrentTweens()
	    })
	    // this.controls.isPlaying = false
	}


	async moveTo (opts) {

		var ease = "power1.inOut"

		this.killCurrentTweens()


        const { position, direction } = opts



	    let duration =  0.5;

	    // moveTween = new TWEEN.Group();

	    // this.controls.isPlaying = true

        const currentState = {
            x: this.position.x,
            y: this.position.y,
            z: this.position.z,
            opacity: 0
        }

        const endState = {
            x: position.x,
            y: position.y,
            z: position.z,
            opacity: 1
        }

        // const endQuat = {
        //     x: quaternion.x,
        //     y: quaternion.y,
        //     z: quaternion.z,
        //     w: quaternion.w
        // }

        const currentLookAt = this.getWorldDirection(new Vector3()).add(this.position)

        const targetLookAt = {
            x: direction.x + position.x,
            y: direction.y + position.y,
            z: direction.z + position.z,
        }

	    const animPos = new Promise(resolve => {

	        this.tweens.position = gsap.to(currentState, {
	            ...endState,
	            duration,
	            ease,
                onUpdate: () => {
                    //
                    this.position.set(currentState.x, currentState.y, currentState.z)

                    if ( !IS_FIRST_PERSON && Players.main ) {

                        Players.main.setOpacity(currentState.opacity)
                    }
                },
	            onComplete: resolve
	        })
	    })

	    const animDir = new Promise(resolve => {
	        this.tweens.direction = gsap.to(currentLookAt, {
	            ...targetLookAt,
	            duration,
	            ease,
	            onUpdate: ()=> {
	                this.lookAt(currentLookAt)
	            },
	            onComplete: () => {
                    Camera.currentControls.setCamera(this)
                    resolve()
                }
	        })

	    })

	    await Promise.all([ animPos, animDir ]).then(()=>{

	    	this.killCurrentTweens()
	    })
	}

    /**
     *
     * @param { { targetPosition: Vector3, targetDirection: Vector3 } } opts
     */
    fadInOut(opts) {

        this.killCurrentTweens()


        Root.add( Cache )

        return new Promise(( resolve )=>{

            const tl = this.tweens.fadInOut = gsap.timeline()

            tl.to(Cache, {

                alpha: 1,

                duration: 1,

                onComplete: () => {

                    this.position.copy(opts.targetPosition)

                    this.lookAt(opts.targetDirection)
                }
            })

            tl.to(Cache, {

                alpha: 0,

                duration: 1,

                onComplete:()=>{

                    Root.remove( Cache )

                    this.tweens.fadInOut = null

                    resolve()
                }
            })

        })

    }


    killCurrentTweens() {

        Object.values(this.tweens).forEach(t => {

            t?.kill()
        })

        this.tweens = {}

    }




    /**
     *
     * @param { Vector3 } origin
     * @param { Vector3 } direction
     */
    intersectRay(origin, direction) {

        return Camera.currentControls.world?.rayIntersect(origin, direction)

    }


    distanceToFloor(point) {

        return Camera.currentControls.world?.distanceToFloor(point)
    }

    dir = new Vector3()

    tmpVec3 = new Vector3()

    targetCollitions(target) {

        let result = Camera.currentControls.world?.playerCollitions(target)

        if(result?.result) {

            target.copy(result.endPosition)

            return result.result
        }
    }

    playerCollitions(target) {

        let result = Camera.currentControls.world?.playerCollitions(target)

        if(result?.result) {

            let intersect = this.intersectRay(
                target,
                this.dir.copy(result.endPosition).sub(target).normalize()
            )

            this.tmpVec3.copy(target).sub(result.endPosition)

            let diffDistance = this.tmpVec3.length()

            if (intersect && intersect.distance < diffDistance) {

                console.log(
                    "Player glitched from",
                    target.y,
                    "to",
                    result.endPosition.y,
                    "Correcting ..."
                )

                return true
            }
        }

       // target.copy(result.endPosition)
    }

	activate(){
		this.active = true
	}

	desactivate(){
     	this.active = false
	}
}

export default new TransitionCamera(FOV, 1, NEAR, FAR )
