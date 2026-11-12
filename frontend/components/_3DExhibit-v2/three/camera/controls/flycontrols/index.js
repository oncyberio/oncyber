// @ts-check


import Emitter from '@3emitter'

import Events from '@3events'


import DAT from 'dat.gui'

import conf from "@3gl/utils/params"

// import Events from "@3/three/events/events";

import { Euler, PerspectiveCamera, Quaternion } from "three";


import {
    IS_MOBILE,
    IS_POINTER_LOCK,
    IS_TOUCH,
    ORIENTATION,
    PORTRAIT,
    FLY_MODE_ROTATION
 } from "@3constants";


import Smoothstep from '@3utils/math/smoothstep'

import { AbstractControls } from "../abstract";
import { applyKeyboardTurn } from "../keyboardTurn";

import { Physics } from '../physics';

import clamp from "@3utils/math/clamp"




export default class FlyControls extends AbstractControls {

    /**
     * @param { import("@gltypes").ControlsOptions & { world: Physics } } opts
     */
    constructor(opts) {

        super()

        this.enabled = false

        this.name = 'FlyControls'

        /** @type { PerspectiveCamera } */
        this.camera = opts.camera;

        this.currentSpace = opts.space

        /** @type { import("@uitypes/roomParameters").RoomParameters } */
        this.roomParameters = opts.roomParameters

        this.isPlaying = false

        this.rotationConversion = {

            dxToRad: 1,

            dyToRad: 1
        }

        this.params = {

            lerp: conf.rlerp || 0.02,

            plerp: conf.plerp || 0.7,

            moveSpeed: conf.speed || 1,

            rotateSpeed: conf.rotateSpeed || 1.2,

            rotateCZSpeed: conf.rotateCZSpeed || 30

        }

        console.log("this.params", this.params)

        this.euler = new Euler( 0, 0, 0, 'YXZ');

        this.world = opts.world

        this.playerState = this.world.playerState

        this.dragMode = false
    }

    async init() {

        this.handleResize()

        if(conf.debugfly) {

            this.addDebug()

        }
    }

    reset() {

        this.playerState.reset()
    }

    addDebug(){

        let GUI = DAT.GUI

	    this.gui  = new GUI()

        this.gui.folders = {}

		this.gui.folders = this.gui.addFolder('FlyControls')

        // this.gui.folders.add( this.params, 'autoMode')

        this.gui.folders.add( this.params, 'moveSpeed', 0, 10)

        this.gui.folders.add( this.params, 'rotateSpeed', 0, 10)

		this.gui.folders.add( this.params, 'lerp', 0, 1)

        this.gui.folders.add( this.params, 'plerp', 0, 1)

        this.gui.folders.add( this.params, 'rotateCZSpeed', 50, 500)


	}

    setLerp(val) {

        this.params.lerp = val;

    }

    setPlerp(val) {

        this.params.plerp = val;

    }

    setSpeed(val) {

        this.params.moveSpeed = val;

    }

    setCamera(camera) {

        // Target can be either camera or player

        this.camera = camera

        this.world.setCamera(camera)
    }

    copyState(otherControls) {

        this.world.copyState(otherControls.world)
    }


    addEvents = () => {

        if ( this.enabled == false ) {

            this.enabled = true

            Emitter.on(Events.UPDATE, this.update)
            Emitter.on(Events.KEY_DOWN, this._handleKeyDown);
            Emitter.on(Events.KEY_UP, this._handleKeyUp);
            Emitter.on(Events.MOUSE_DOWN, this._handleMouseDown);
            Emitter.on(Events.MOUSE_UP, this._handleMouseUp);
            Emitter.on(Events.MOUSE_MOVE, this._handleMouseMove);
            Emitter.on(Events.PAUSE, this.handlePause)

        }
    }

    removeEvents = () => {
        if ( this.enabled == true ) {

            Emitter.off(Events.UPDATE, this.update)
            Emitter.off(Events.KEY_DOWN, this._handleKeyDown);
            Emitter.off(Events.KEY_UP, this._handleKeyUp);
            Emitter.off(Events.MOUSE_DOWN, this._handleMouseDown);
            Emitter.off(Events.MOUSE_MOVE, this._handleMouseMove);
            Emitter.off(Events.MOUSE_UP, this._handleMouseUp);
            Emitter.off(Events.PAUSE, this.handlePause)

            this.targetQuat = null

            this.playerState.keyStates = {};

            this.enabled = false
        }
    }

    handlePause = () => {
        this.playerState.keyStates = {};
    }


    _handleKeyDown = (event) => {

        event.preventDefault?.()
        event.stopPropagation?.()

        if (event.key === "Enter") {
            this.playerState.keyStates = {}
            return;
        }

        if(event.code === "KeyZ") {
            this.setRotationFromMouseMovement(-this.params.rotateCZSpeed, 0)

        }

        if(event.code === "KeyC") {
            this.setRotationFromMouseMovement(this.params.rotateCZSpeed, 0)
        }

        if (IS_MOBILE) {
            if (event.type === "end") {
                this.playerState.keyStates["KeyW"] = false;
                this.playerState.keyStates["KeyS"] = false;
                this.playerState.keyStates["KeyA"] = false;
                this.playerState.keyStates["KeyD"] = false;
            }

            this.playerState.keyStates["KeyW"] = event.type === "dir:up";
            this.playerState.keyStates["KeyS"] = event.type === "dir:down";
            this.playerState.keyStates["KeyA"] = event.type === "dir:left";
            this.playerState.keyStates["KeyD"] = event.type === "dir:right";

            return;
        }

        this.playerState.keyStates[event.code] = true;

        this.prevKeyPressTimestamp = 0;
    };

    _handleKeyUp = (event) => {

        this.playerState.keyStates[event.code] = false;
    };

    _handleMouseUp = (event) => {

        this._isDragging = false

        if (IS_TOUCH) {

            this.isPressing = false

            this.accuRotation = 0
        }
    }

    _handleMouseDown = (event) => {

        this._isDragging = true

        if(IS_TOUCH) {

            if( this.isPressing == true ) {

                return
            }

            this.accuRotation = 0

            this.mouseXtouch =  event.normalized.x

            this.isPressing = true

            this.isPressingTimer = 0
        }


    }

    _handleMouseMove = (event) => {

        const enableMove = IS_TOUCH || (this.dragMode && this._isDragging) || (!this.dragMode && IS_POINTER_LOCK())

        if(!enableMove) return

        let movementX = 0

        let movementY = 0


        for (let i = 0; i < event.mousemovePackets.length; i++) {

            movementX += event.raw.dx

            movementY += event.raw.dy

        }

        if( IS_TOUCH ) {

            this.mouseXtouch =  event.normalized.x

            if( IS_MOBILE ) {

                this.mouseXtouch *= -1
            }

            if( this.isPressingTimer < this.params.isPressingThreshold  && Math.abs(movementX) > this.params.rotateThreshold )  {

                this.isPressing = false
            }

        }



        this.setRotationFromMouseMovement(movementX, movementY)
    }

    setRotationFromMouseMovement = (movementX, movementY) => {

        console.log(movementX, movementY)


        let ratioXY = Math.abs(movementY / movementX)

        let factorX = 1

        let factorY = 1

        if(ratioXY < this.params.minRatioToRotateY) {

            factorY = 0.5

        }
        else {

            factorX = 0.5
        }

         if(IS_TOUCH){

            factorY *= 2
            factorX *= 3
        }

        movementX *= factorX

        movementY *= factorY

        if(IS_MOBILE){

            movementX = -movementX
            movementY = -movementY
        }

        this.euler.setFromQuaternion(this.camera.quaternion )

        if(this.targetQuat == null) {

            this.targetQuat = new Quaternion()

            this.targetQuat.copy(this.camera.quaternion)
        }

        this.euler.setFromQuaternion(this.targetQuat)

        const dir = this.dragMode ? 1 : -1

        this.euler.y += dir * movementX * this.rotationConversion.dxToRad * this.params.rotateSpeed

        this.euler.x += dir * movementY * this.rotationConversion.dyToRad * this.params.rotateSpeed

        this.euler.x = clamp( -Math.PI / 2, Math.PI / 2, this.euler.x  )

        this.targetQuat.setFromEuler(this.euler)
    }



    handleResize = () => {

        // Update rotation speed
        if(!IS_TOUCH) {

            this.rotationConversion.dxToRad = Math.PI / window.innerWidth

            this.rotationConversion.dyToRad = Math.PI / window.innerHeight
        }
        else {

            const SPEED = -0.0043;

            const BASE_WIDTH = window.innerWidth / (ORIENTATION === PORTRAIT ? 390 : 844); // 390 dimensions of iphone 12 pro

            const BASE_HEIGHT = window.innerHeight / (ORIENTATION === PORTRAIT ? 844 : 390);

            this.rotationConversion.dxToRad = SPEED * BASE_WIDTH

            this.rotationConversion.dyToRad = (SPEED / (ORIENTATION === PORTRAIT ? 4 : 3)) * BASE_HEIGHT

        }
    }
    //#endregion



    update = (deltaTime, elapsedTime) => {


        if(this.isPlaying) return

        if (!IS_MOBILE) applyKeyboardTurn(this, deltaTime);

        if ( this.isPressing ) {

            const ratio = Smoothstep( 0.8, 1.0, Math.abs( this.mouseXtouch ) )

            this.accuRotation += -Math.sign(this.mouseXtouch) * ratio * 0.001

            this.accuRotation = Math.max( Math.min( this.accuRotation, 0.03 ), -0.03 )

            if( ratio == 0 ){

                this.accuRotation = 0

                this.maxRatio = 0
            }
        }

        else {

            this.mouseXtouch = 0

            this.accuRotation = 0

            this.maxRatio = 0
        }

        if( this.targetQuat ) {

            this.euler.setFromQuaternion(this.targetQuat)

            if ( this.isPressing ) {

                this.euler.setFromQuaternion(this.targetQuat)

                this.euler.y -=  this.accuRotation

                this.targetQuat.setFromEuler(this.euler)
            }
        }

        let speedFactor

        if( IS_TOUCH ) {

            let touchGo = false

            if( this.isPressing ) {

                this.isPressingTimer += deltaTime


                if( this.isPressingTimer > this.params.isPressingThreshold ) {

                    touchGo = true

                }
            }

            if( touchGo ){

                speedFactor = 1

                this.playerState.keyStates["KeyW"] = true

            }

            else{

                speedFactor = 0

                this.playerState.keyStates["KeyW"] = false
            }

        }


        if( this.targetQuat ) {

            if( IS_MOBILE ) {

                this.camera.quaternion.slerp(this.targetQuat,( this.isPressing ? 1 : 0.1 ) )

            }
            else {

                this.camera.quaternion.slerp(this.targetQuat, this.params.lerp)
            }
        }

        if(speedFactor == null) {

            speedFactor = 1
        }

        const result = this.world.update(deltaTime, elapsedTime, speedFactor * this.params.moveSpeed, this.params.plerp)

        if(result?.intersectedMeshes) {

            this.emit(Events.COLLISION, result.intersectedMeshes)
        }

        return result
    }

    isClickLocked() {

        return this.dragMode
    }

    dispose() {

        this.removeEvents()

        this.gui?.destroy()
    }
}
