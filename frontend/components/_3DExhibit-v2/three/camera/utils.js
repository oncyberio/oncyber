// @ts-check

import {

    Mesh,

	Vector3

} from 'three'

import {

	CURRENT_SPACE,

	DOWN_VECTOR

} from '@3constants'

import Camera from "@3camera"






class CameraUtils {





    get playerRadius() {

        return Camera.currentControls.world?.playerRadius || 1
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

        const result = this.intersectRay(point, DOWN_VECTOR)

        console.log("distanceToFloor", result)

        if(result) {

            const name = result.triangle.meshName.toLowerCase()

            if(name.includes("floor") || name.includes("loft")) {

                return result.distance
            }
            else {

                return -1
            }
        }
        else {

            return Infinity;
        }
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

    /** @param { { target: Mesh, lookAtDistance: number, checkCollitions: boolean, currentPosition: Vector3 } } opts */
	async getTargetPosition (opts) {


		const target = opts.target

	    let distance = opts.lookAtDistance

        let meshPos = target.getWorldPosition(new Vector3())

        let meshDir = target.getWorldDirection(new Vector3())

        let targetPos = meshPos.clone().add(meshDir.setLength(distance))

        let collitionMode = false

        if(opts.checkCollitions) {

            // Check if distance will fall outside the room

            let result = this.intersectRay(meshPos, meshDir)

            if(result != null && result.distance < distance && result.distance > CURRENT_SPACE.roomParameters.user_height) {

                console.log("Transition will fall outside", distance, " > ", result.distance)

                console.log(result.triangle)

                distance = result.distance - (Camera.currentControls.world?.playerRadius || 1)

                targetPos.copy(meshPos).add(meshDir.setLength(distance))

            }

            // Compute correct user height at the end of the transition

            let currentHeight = this.intersectRay(opts.currentPosition, DOWN_VECTOR)?.distance || -1

            console.log("current height", currentHeight)

            let targetHeight = this.distanceToFloor(targetPos)

            console.log("target height", targetHeight)

            // If there's no floor most likely we're outside of the room
            // reset to a safe distance then recomputes the final user height

            let testDistance = Math.max(CURRENT_SPACE.roomParameters.user_height * 4, opts.lookAtDistance) * 2

            while(targetHeight === Infinity) {

                if(testDistance < CURRENT_SPACE.roomParameters.user_height) {

                    console.log("No safe place: abort transition")

                    return null
                }

                console.log("mmm artwork seems to be outside?")

                // test with a smaller distance
                testDistance = testDistance / 2

                distance = testDistance

                targetPos.copy(meshPos).add(meshDir.setLength(distance))

                targetHeight = this.distanceToFloor(targetPos)
            }



            if(targetHeight < 0 || currentHeight < 0) {

                targetPos.y = Math.max(opts.currentPosition.y, meshPos.y)

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

        return targetPos
	}

}

export default new CameraUtils()
