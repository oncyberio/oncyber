//@ts-check

import { DEBUG, IS_FIRST_PERSON, IS_VR, DOWN_VECTOR, CAPSULE_RADIUS, USER_HEIGHT} from "@3constants"


import { PerspectiveCamera, Ray, Vector3 } from "three";

import { PlayerState } from "./playerstate";

import { applyGroundMotion, limitAirSpeed, LEGACY_PACE } from "./groundMotion";

import Collisions from "./collisions"

import Players from "@3factory/player"

import { getUserInitialPositions } from "@components/_3DExhibit-v2/three/utils/camera";

import { isOutsideSpace, pickSpawnInsideSpace } from "./spaceBounds";

/** Seconds a player who lost the floor without jumping keeps probing for it. */
const SNAP_GRACE = 0.1

export class Physics {

    /** Seconds since the floor was last under the player. */
    offFloorTime = 0

    constructor(opts) {

        this.opts = opts

        this.initial = getUserInitialPositions(opts.roomParameters);

        this.userHeight = this.initial.userHeight

        this.isPreview = opts.isPreview;

        this.colliderHeight = this.initial.colliderHeight



        this.isJoystick = !!opts.isJoystick


        /** @type { PerspectiveCamera } */
        this.camera = opts.camera;

        this.currentSpace = opts.space

        /** @type { import("@uitypes/roomParameters").RoomParameters } */
        this.roomParameters = opts.roomParameters

        this.isPlaying = false

        this.gravity = this.roomParameters?.gravity || 30;

        this.speed = this.roomParameters?.playerSpeed || 100;

        this.flymode = false


        // console.log( this.roomParameters )

        // console.log( this.roomParameters?.playerSpeed )
        // console.log( this.roomParameters?.playerSpeed )
        // console.log( this.roomParameters?.playerSpeed )
        // console.log( this.roomParameters?.playerSpeed )
        // console.log( this.roomParameters?.playerSpeed )
        // console.log( this.roomParameters?.playerSpeed )

        this.jump = this.roomParameters?.jump || 8;


        if (DEBUG) {
            // gui.folders.controls.add(this, "gravity");
            // gui.folders.controls.add(this, "speed");
            // gui.folders.controls.add(this.roomParameters, "jump");
        }


        this.cameraRoot = IS_VR ? this.camera.parent : this.camera

        this.target = !this.shouldUseFirsPerson() ? Players.main.position : this.cameraRoot.position;

        this.playerState = new PlayerState();

        this.playerState.position = this.target;

        this.tmpVec3 = new Vector3()

        this.firstPersonPos = new Vector3()

        this.thirdPersonPos = new Vector3()

        this.position = new Vector3()

        if (this.roomParameters?.quidditch){
            this.playerState.quidditch = true;
        }
    }

    async init() {

        this.collisions = await Collisions.get({
            ...this.opts,
            ...this.initial,
            position: this.opts.camera.position
        })
    }

    shouldUseFirsPerson() {

        return this.isPreview || IS_FIRST_PERSON
    }

    setCamera(camera) {

        // Target can be either camera or player

        this.camera = camera

        if (this.shouldUseFirsPerson()) {

            this.cameraRoot = IS_VR ? this.camera.parent : this.camera

            this.target = this.cameraRoot.position;

        } else {

            this.target = Players.main.position;
        }

        this.playerState.position = this.target;
    }

    copyState(otherWorld) {

        this.playerState.copyFrom(otherWorld.playerState)
    }

    /** @returns { number } */
    get playerRadius() {

        return CAPSULE_RADIUS
    }

    update(deltaTime, elapsedTime, speedFactor, lerp = 1) {

        deltaTime = Math.min(deltaTime, 0.03)

        this.playerState.flyMode = this.flymode

        const velocity = this.playerState.veclocity
        const beforeX = velocity.x, beforeZ = velocity.z

        this.controls( deltaTime,  speedFactor)

        // The controls' impulse this frame; updatePlayer turns it into
        // lobby-style acceleration, braking and bounded air control.
        this.motionImpulse = {
            beforeX, beforeZ,
            x: velocity.x - beforeX,
            z: velocity.z - beforeZ,
        }

        return this.updatePlayer(deltaTime, elapsedTime, lerp)
    }

    correctCollisionHeightfromVRM = () => {

        const colliderHeight = this.collisions.getColliderHeight()

        if(  this.previousHeight  == null ) {

            this.previousHeight = colliderHeight

        }

        this.firstPersonPos.y = this.thirdPersonPos.y  + colliderHeight

        this.previousHeight = colliderHeight
    }


    updatePlayer(deltaTime, elapsedTime, lerp = 1) {

        // dont run physics when player is sitting
        if (!this.flymode && (Players.main?.isSitting || Players.main?.deactivated)) return;

        const shouldUseFirsPerson = this.shouldUseFirsPerson()

        const impulse = this.motionImpulse
        this.motionImpulse = null
        const state = this.playerState
        const lobbyFeel = impulse && !this.flymode && !state.quidditch && !state.opts?.editMode
        const wasOnFloor = state.playerOnFloor

        if (state.playerOnFloor || this.flymode) {

            const damping = Math.exp(-10 * deltaTime) - 1

            if (lobbyFeel) {

                state.veclocity.y += state.veclocity.y * damping
                state.veclocity.x = impulse.beforeX
                state.veclocity.z = impulse.beforeZ
                applyGroundMotion(state.veclocity, impulse, deltaTime, state.speed)
            }
            else {

                state.veclocity.addScaledVector(
                    state.veclocity,
                    damping
                )
            }
        }
        else if(!this.flymode) {

            state.veclocity.y -= this.gravity * deltaTime

            if (lobbyFeel) {

                limitAirSpeed(
                    state.veclocity,
                    Math.hypot(impulse.beforeX, impulse.beforeZ),
                    (state.currentSpeed || state.speed) * LEGACY_PACE
                )
            }
        }


        const deltaPosition = this.tmpVec3
            .copy(this.playerState.veclocity)
            .multiplyScalar(deltaTime * lerp)

        // console.log(this.playerState.position)

        // if(  Math.abs(this.playerState.position.z - this.position.z) > 10 ) {


        // }


        this.position = this.position.copy(deltaPosition).add(this.playerState.position)


        this.collisions.isFlymode = this.flymode
        // Stay on the floor over seams, steps and down slopes: a grounded
        // player that is not rising looks a little below for the floor. Reach
        // grows with the stride so a fast run (or a slow frame) down a slope
        // of up to about 55 degrees keeps its footing. A probe that misses on
        // a seam keeps looking for a few frames instead of starting a fall.
        const stride = Math.hypot(deltaPosition.x, deltaPosition.z)
        const footing = wasOnFloor || this.offFloorTime < SNAP_GRACE
        const snap = footing && !this.flymode && state.veclocity.y <= 0 && !state.isJumping
            ? Math.max(0.35, stride * 1.5) : 0
        const collisionResult = this.collisions.playerCollitions(this.position, deltaPosition, !shouldUseFirsPerson, snap);

        const { playerOnFloor, endPosition, startPosition, result } = collisionResult

        this.offFloorTime = playerOnFloor ? 0 : this.offFloorTime + deltaTime

        if (result && (!playerOnFloor && !this.flymode)) {

            this.playerState.veclocity.addScaledVector(
                result.normal,
                -result.normal.dot(this.playerState.veclocity)
            )
        }


        // console.log( endPosition )

        this.firstPersonPos.set(
            endPosition.x,
            endPosition.y,
            endPosition.z
        )

        // console.log( endPosition )

        this.thirdPersonPos.set(
            startPosition.x,
            startPosition.y,
            startPosition.z,
        )

        this.playerState.setFloorContact(playerOnFloor || this.flymode)

        this.playerState.position.copy(!shouldUseFirsPerson ? this.thirdPersonPos : this.firstPersonPos)

        // console.log("this, playerSatete", this.playerState.position);

        // Fell out, or ended up far outside the space: only the background
        // colour shows there, so bring the player back to a spawn inside.
        const bbox = this.currentSpace?.bbox

        const outside = this.isPreview || this.flymode
            ? bbox != null && this.playerState.position.y < bbox.min.y - this.userHeight * 5
            : isOutsideSpace(this.playerState.position, bbox, this.userHeight)

        if (outside) {

            this.reset()
        }

        if ( Players.main && !this.isPreview) {

            if (!this.flymode && shouldUseFirsPerson) {

                Players.main.position.copy(this.thirdPersonPos)
            }

            Players.main.update(deltaTime, elapsedTime, this.playerState, this.flymode)
        }

        return collisionResult
    }


    controls( deltaTime, speedFactor ) {


        this.playerState.speed = this.speed * speedFactor

        // console.log( speedFactor )
        // console.log( this.speed,  speedFactor)

        this.playerState.jump = this.jump


        if(this.isJoystick) {

            this.playerState.joystickControls(deltaTime, this.camera)
        }
        else {

            this.playerState.keyControls(deltaTime, this.camera)
        }

        if (IS_FIRST_PERSON && Players.main && (!Players.main.isSitting && !Players.main.deactivated)) {

            // Players.main.rotation.y = this.camera.rotation.y;
            this.playerState.tempRotation = this.camera.rotation.y;
        }
    }

    ray = new Ray()

    /**
     * @param { Vector3 | Ray } origin
     * @param { Vector3 } direction
     */
    rayIntersect(origin, direction) {

        let ray = this.ray;

        // @ts-ignore
        if(origin.origin && origin.direction) {
            // @ts-ignore
            ray = origin
        }
        else {
            // @ts-ignore
            ray.origin.copy(origin)

            ray.direction.copy(direction)
        }

        return this.collisions.rayIntersect(ray)
    }

    distanceToFloor(point) {

        const result = this.rayIntersect(point, DOWN_VECTOR)

        if(result) {

            const name = result.triangle.meshName.toLowerCase()

            if(name.includes("floor") || name.includes("loft") || name.includes("bound") || name.includes("sidewalks")) {

                return result.distance
            }
            else {

                return -1
            }
        }
        else {

            return 0;
        }
    }


    floorIntersect(point) {

        const result = this.rayIntersect(point, DOWN_VECTOR)

        if(result) {

            const name = result.triangle.meshName.toLowerCase()

            if(name.includes("floor") || name.includes("loft") || name.includes("bound")) {

                return result
            }
        }
    }

    playerCollitions(position) {
        return this.collisions.playerCollitions(position)
    }

    reset() {

        if (Players.main.deactivated) return;

        this.playerState.reset();

        // A shared link's coords can point outside the space. Respawning
        // there again would loop forever, so fall back to the room's own
        // spawn and keep it for later resets.
        const params = this.roomParameters || /** @type { import("@uitypes/roomParameters").RoomParameters } */ ({})

        const spawn = pickSpawnInsideSpace(
            [params.initialPlayerPosition, params.roomSpawnPosition],
            this.currentSpace?.bbox
        )

        if (this.roomParameters && spawn !== params.initialPlayerPosition) {

            this.roomParameters.initialPlayerPosition = spawn

            if (spawn === params.roomSpawnPosition && params.roomSpawnRotation) {

                this.roomParameters.initialPlayerRotation = params.roomSpawnRotation
            }
        }

        const { cameraPos, cameraRot } = getUserInitialPositions(this.roomParameters)

        this.playerState.position.copy(cameraPos)

        if (IS_FIRST_PERSON) {

            // this.cameraRoot.rotation.copy(cameraRot);

        }
        else {

            // this.playerState.rotation.copy(cameraPos)
        }

        this.collisions.reset(cameraPos);
    }

    dispose(){

        this.playerState.dispose()

        this.collisions.dispose()
    }
}
