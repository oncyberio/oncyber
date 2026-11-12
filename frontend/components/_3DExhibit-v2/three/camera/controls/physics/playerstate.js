// @ts-check

import { IS_FIRST_PERSON, IS_MOBILE, ORIENTATION, PORTRAIT } from "@3constants";

import { Vector3, Spherical, Euler,Quaternion } from "three";
import { DIRECTION } from "../../constants";

import Emitter from '@3emitter'

import Events from '@3events'
import Players from "@components/_3DExhibit-v2/three/factory/player";

// import Camera from '@3camera'

import { AIR_CONTROL } from "./groundMotion";

export class PlayerState {
    // params to be set on each frame
    speed = 0;
    jump = 0;
    isJoystick = false;

    veclocity = new Vector3();
    direction = new Vector3();
    originalDirection = new Vector3();
    position = new Vector3();
    spherical = new Spherical();
    keyStates = {};
    joystickStates = {};
    joystickState = {
        pan: new Vector3()
    }
    playerOnFloor = false;
    isJumping     = false;
    jumpCount = 0;
    jumpHeld = false;
    isFirstPerson = IS_FIRST_PERSON;
    rotation = new Euler();
    tempRotation = 0
    rotateAngle = new Vector3(0, 1, 0)
    rotateQuarternion = new Quaternion()

    quaternion = new Quaternion
    currentSpeed = 0;

    constructor(opts = {}){

        this.updateEvent = this.update.bind(this)

        this.opts = opts

        this.flyMode = false
        this.quidditch = false;

        Emitter.on(Events.PRE_UPDATE, this.updateEvent )
    }

    /**
     *
     * @param { PlayerState } state
     * @returns
     */
    copyFrom(state) {
        // this.veclocity.copy(state.veclocity)
        // this.speed = state.speed

        this.originalDirection.copy(state.originalDirection)
        this.direction.copy(state.direction)
        // this.position = state.position
        this.rotation.copy(state.rotation)
        this.spherical.copy(state.spherical)
        this.keyStates = { ...state.keyStates }
        this.joystickStates = { ...state.joystickStates }
        this.joystickState.pan.copy(state.joystickState.pan)
        this.playerOnFloor = state.playerOnFloor
        this.jumpCount = state.jumpCount
        this.jumpHeld = state.jumpHeld
        this.isJumping = state.isJumping
        this.isFirstPerson = state.isFirstPerson
    }

    reset() {
        this.originalDirection.set(0, 0, 0);
        this.veclocity = new Vector3();
        this.direction = new Vector3();
        this.spherical = new Spherical();
        this.keyStates = {};
        this.joystickStates = {};
        this.joystickState.pan = new Vector3()
        this.playerOnFloor = false;
        this.jumpCount = 0;
        this.jumpHeld = false;
        this.isJumping = false;
        this.rotation = new Euler();
    }

    setFloorContact(grounded) {
        this.playerOnFloor = grounded;
        if (grounded && this.veclocity.y <= 0) {
            this.jumpCount = 0;
            this.isJumping = false;
        }
    }

    joystickControls(deltaTime, camera) {

        if (Players.main.deactivated) return;

        this.direction.set(0, 0, 0);

        this.originalDirection.set(0, 0, 0);

        this.veclocity.add(
            this.getForwardVector(camera).multiplyScalar(
                (this.joystickState.pan.z * this.speed / 2) * deltaTime
            )
        )

        this.veclocity.add(
            this.getSideVector(camera).multiplyScalar(
                (this.joystickState.pan.x * this.speed / 2) * deltaTime
            )
        )

    }


    keyControls(deltaTime, camera) {

        if (Players.main.deactivated) return;

        const jumpDown = this.keyStates["Space"] === true;
        const jumpPressed = jumpDown && !this.jumpHeld;
        this.jumpHeld = jumpDown;
        this.currentSpeed = this.speed;

        this.direction.set(0, 0, 0);

        this.originalDirection.set(0, 0, 0);

        // Shift sprints at 1.5x, like the lobby's run-to-sprint step. Mobile
        // portrait keeps its existing always-on boost.
        if (this.keyStates["ShiftLeft"] || this.keyStates["ShiftRight"]) {
            this.currentSpeed *= 1.5
        }
        else if (IS_MOBILE && ORIENTATION === PORTRAIT) {
            this.currentSpeed *= 2
        }

        if (
            this.keyStates["KeyW"] ||
            this.keyStates["ArrowUp"]
        ) {
            this.direction.add(DIRECTION.FORWARD);
        }

        if (
            this.keyStates["KeyS"] ||
            this.keyStates["ArrowDown"]
        ) {
            this.direction.add(DIRECTION.BACKWARD);
        }

        if (
            this.keyStates["KeyA"]
        ) {
            this.direction.add(DIRECTION.LEFT)
        }

        if (
            this.keyStates["KeyD"]
        ) {
            this.direction.add(DIRECTION.RIGHT)
        }

        if (IS_MOBILE && ORIENTATION === PORTRAIT && this.joystickStates["ANGLE"]) {
            const angle = this.joystickStates["ANGLE"]

            const radians = angle * (Math.PI / 180);

            // angle to direction vector
            this.direction.set(
                -Math.cos(radians),
                0,
                Math.sin(radians)
            );
        }

        this.direction.normalize();

        this.originalDirection.copy(this.direction);

        // If player is moving
        if (this.direction.length() !== 0) {

            const rotation = this.spherical.setFromVector3(this.direction);

            this.tempRotation = rotation.theta + camera.rotation.y;

        }

        // Air control follows the space's own speed (the default 100 keeps 20).
        const speed =  this.playerOnFloor ? this.currentSpeed : this.speed * AIR_CONTROL


        // console.log(speed)
        // if (this.playerOnFloor) {

        if (
            this.keyStates["KeyW"] ||
            this.keyStates["ArrowUp"]
        ) {
            this.veclocity.add(
                this.getForwardVector(camera).multiplyScalar(
                    speed * deltaTime
                )
            );
        }

        if (
            this.keyStates["KeyS"] ||
            this.keyStates["ArrowDown"]
        ) {
            this.veclocity.add(
                this.getForwardVector(camera).multiplyScalar(
                    -speed * deltaTime
                )
            );
        }

        if (
            this.keyStates["KeyA"]
        ) {
            this.veclocity.add(
                this.getSideVector(camera).multiplyScalar(
                    -(speed / 1.2) * deltaTime
                )
            );
        }

        if (
            this.keyStates["KeyD"]
        ) {
            this.veclocity.add(
                this.getSideVector(camera).multiplyScalar(
                    (speed / 1.2) * deltaTime
                )
            );
        }

        if(this.flyMode) {

            if(this.keyStates["KeyE"]) {
                this.veclocity.y = this.speed * deltaTime * 4;
            }

            if (this.keyStates["KeyQ"]) {

                this.veclocity.y = -this.speed * deltaTime * 4;
            }

        }

        else {

            // Two deliberate presses, like the lobby. Holding a key cannot
            // spend the second jump or start another jump after landing.
            // Preserve authored editor/quidditch flight behavior.
            const authoredFlight = this.quidditch || this.opts.editMode;
            const canJump = this.playerOnFloor || this.jumpCount < 2;
            if (this.jump > 0 && (
                (authoredFlight && jumpDown) || (jumpPressed && canJump)
            )) {
                this.veclocity.y = this.jump;
                this.jumpCount = this.playerOnFloor ? 1 : this.jumpCount + 1;
                this.isJumping = true;
            }

        }


        // }

        // console.log(this.currentSpeed)

    }



    update(){

        this.rotateQuarternion.setFromAxisAngle(this.rotateAngle,  this.tempRotation)

        this.quaternion.rotateTowards(this.rotateQuarternion, 0.16)

        this.rotation.setFromQuaternion ( this.quaternion, 'YXZ' )

        if( this.isJumping && this.playerOnFloor == true ) {

            this.isJumping = false
        }
    }

    mod(n, m) {
      return ((n % m) + m) % m;
    }

    getForwardVector(camera) {

        const dir = this.direction.setFromMatrixColumn(camera.matrixWorld, 2)

        if(!this.flyMode) {

            dir.setY(0)
        }

        return dir.negate().normalize()
    }

    getSideVector(camera) {

        return this.direction
                .setFromMatrixColumn(camera.matrixWorld, 0)
                .setY(0)
                .normalize()

    }

    dispose(){


        Emitter.off(Events.PRE_UPDATE, this.updateEvent )

        this.updateEvent = null
    }
}
