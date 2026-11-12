// @ts-check


import Emitter from '@3emitter'

import Events from '@3events'

import gsap from 'gsap'

import DAT from 'dat.gui'

import conf from "@3gl/utils/params"

// import Events from "@3/three/events/events";

import { Euler, PerspectiveCamera, Quaternion, Ray, Vector3 } from "three";


import {

    IS_MOBILE,

    IS_POINTER_LOCK,

    IS_TOUCH,

    DEBUG,

    ORIENTATION,

    PORTRAIT,

    IS_FIRST_PERSON,

    DOWN_VECTOR,

    USER_HEIGHT,
} from "@3constants";


import Smoothstep from '@3utils/math/smoothstep'

import {

    DIRECTION, IS_FLY, JOYSTICK_DIRECTIONS,

} from "../../constants";

import { AbstractControls } from "../abstract";
import { applyKeyboardTurn } from "../keyboardTurn";

import { Physics } from '../physics';

import clamp from "@3utils/math/clamp"

import Players from '@components/_3DExhibit-v2/three/factory/player'



const dirUpEvent = { type: "dir:up" }

const dirDownEvent = { type: "dir:down" }

const dirEndEvent = { type: "end" }


const DEFAULT_MOBILE_PAN_SPEED = 100

const FAST_MOBILE_PAN_SPEED = 200

export default class PlayerControls extends AbstractControls {

    /**
     * @param { import("@gltypes").ControlsOptions } opts
     */
    constructor(opts) {

        super()

        this._enabled = false

        this.name = 'PlayerControls'

        /** @type { PerspectiveCamera } */
        this.camera = opts.camera;

        this.mobilePanSpeed = DEFAULT_MOBILE_PAN_SPEED;

        this.currentSpace = opts.space

        // this.camera.rotation.order = "YXZ";

        /** @type { import("@uitypes/roomParameters").RoomParameters } */
        this.roomParameters = opts.roomParameters

        this.isPlaying = false

        this.wasStoppingRotation = false

        this.trackingPoints = []

        this.accuRotation = 0
        // compute on Resize
        this.rotationConversion = {
            dxToRad: 1,
            dyToRad: 1
        }

        this.minRatioToRotateY = Math.tan(Math.PI / 6)


        this.rotateVelocity = {
            active: false,
            x: 0,
            y: 0
        }

        this.intertialRotationParams = {

            dampingFactor: conf.rdamp || 0.05,

            multiplier: conf.rmul || 1,

            lerp: conf.rlerp || 0.1
        }


        this.pinchTreshhold = 5

        this.trackingPinchs = []

        this.pinchVelocity = {
            active: false,
            value: 0
        }


        this.intertialPinchParams = {

            dampingFactor: conf.pdamp || 0.05,

            multiplier: conf.pmul || 10
        }



        this.velocityStopTreshhold = 0.3

        this.velocityLooseTreshhold = 0.3

        this.euler = new Euler( 0, 0, 0, 'YXZ');

        this.pinchs = 0

        this.maxRatio = 0

        this.maxAccurotation = 0

        this.world = new Physics(opts)

        this.playerState = this.world.playerState

        this.isPressing = false

        this.isPressingThreshold = 0.12

        this.rotateThreshold = 0.5

        this.isPressingTimer = -Infinity

        this.isJumping = false

        this.dragMode = IS_FLY

    }

    async init() {

        this.handleResize()

        await this.world.init()

        // const dist = this.distanceToFloor(this.camera.position)

        // if(dist >= 0) {

        //     this.camera.position.y += USER_HEIGHT - ( dist == Infinity ? 0 : dist )
        // }

        this.update(0, 0);

        if(conf.debugwasd) {

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

		this.gui.folders.rotation = this.gui.addFolder('inertial rotation')

		this.gui.folders.rotation.add( this.intertialRotationParams, 'lerp', 0, 1)

        this.gui.folders.rotation.add( this.intertialRotationParams, 'multiplier', 1, 30)

        this.gui.folders.rotation.add( this.intertialRotationParams, 'dampingFactor', 0, 1, 0.01)


        // pinch zoom

        this.gui.folders.rotation = this.gui.addFolder('inertial pinchzoom')


        this.gui.folders.rotation.add( this.intertialPinchParams, 'multiplier', 1, 30)

        this.gui.folders.rotation.add( this.intertialPinchParams, 'dampingFactor', 0, 1, 0.01)

	}

    setCamera(camera) {

        // Target can be either camera or player

        this.camera = camera

        this.world.setCamera(camera)
    }

    copyState(otherControls) {

        this.world.copyState(otherControls.world)
    }

    get enabled() {

        return this._enabled
    }

    set enabled(value) {

        if (value == true) {

            this.addEvents()

        }
        else {

            this.removeEvents()

        }
    }

    addEvents = () => {

        if ( this._enabled == false ) {

            this._enabled = true

            Emitter.on(Events.KEY_DOWN, this._handleKeyDown);
            Emitter.on(Events.KEY_UP, this._handleKeyUp);
            Emitter.on(Events.WHEEL, this._handleMouseWheel)
            Emitter.on(Events.UPDATE, this.update)
            Emitter.on(Events.MOUSE_MOVE, this._handleMouseMove);
            Emitter.on(Events.PAUSE, this.handlePause)

            Emitter.on(Events.MOUSE_UP, this._handleMouseUp);

            Emitter.on(Events.MOUSE_DOWN, this._handleMouseDown);

            if(IS_TOUCH) {
                Emitter.on(Events.RESIZE, this.handleResize);
                // Emitter.on(Events.PINCH_ZOOM, this.handlePinchZoom);
                // Emitter.on(Events.PINCH_END, this.handlePinchEnd);
                Emitter.on(Events.CLICK, this.handleClick);

                // if(this.currentSpace) {

                //     this.currentSpace.floors.forEach(floor => {

                //         floor.on(Events.FLOOR_INTERSECTED, this.onRaycast)
                //     })
                // }
            }
        }
    }

    removeEvents = () => {
        if ( this._enabled == true ) {

            Emitter.off(Events.KEY_DOWN, this._handleKeyDown);
            Emitter.off(Events.KEY_UP, this._handleKeyUp);
            Emitter.off(Events.WHEEL, this._handleMouseWheel)
            Emitter.off(Events.UPDATE, this.update)
            Emitter.off(Events.MOUSE_MOVE, this._handleMouseMove);
            Emitter.off(Events.PAUSE, this.handlePause)

            Emitter.off(Events.MOUSE_UP, this._handleMouseUp);

            Emitter.off(Events.MOUSE_DOWN, this._handleMouseDown);
            // Emitter.off(Events.PINCH_ZOOM, this.handlePinchZoom);
            // Emitter.off(Events.PINCH_END, this.handlePinchEnd);
            Emitter.off(Events.CLICK, this.handleClick);

            // if(this.currentSpace) {

            //     this.currentSpace.floors.forEach(floor => {

            //         floor.off(Events.FLOOR_INTERSECTED, this.onRaycast)
            //     })
            // }

            this.world.playerState.keyStates = {}
            this.world.playerState.jumpHeld = false

            this.resetInertialRotation()

            this.resetTrackingPinch()

            this.trackingPoints.length = 0

            this.trackingPinchs.length = 0

            this.targetQuat = null

            this._enabled = false
        }
    }

    onRaycast = (e) => {

        // console.log("onRaycast", e)
        this.cursorPosition = e.point
    }

    handlePause = () => {
        this.playerState.keyStates = {};
        this.playerState.jumpHeld = false;
    }

    isDecelerating = () => {
        return this.rotateVelocity.active
    }

    //#region event handlers
    _handleMouseWheel = event => {
        
        // this.playerCamera.handleMouseWheel(event);
    }

    getUp = () => {

        if ( Players.main?.isSitting && (
            this.playerState.keyStates["KeyW"] ||
            this.playerState.keyStates["KeyS"] ||
            this.playerState.keyStates["KeyA"] ||
            this.playerState.keyStates["KeyD"] ||
            this.playerState.keyStates["ArrowUp"] ||
            this.playerState.keyStates["ArrowDown"] ||
            this.playerState.keyStates["Space"]
        )) Players.main.getUp();

    }

    /**
     * 
     * @param {KeyboardEvent} event
     **/
    _handleKeyDown = (event) => {

        if(event.ctrlKey ||  event.metaKey) return 

        event.preventDefault?.()
        event.stopPropagation?.()

        if (event.key === "Enter") {
            this.playerState.keyStates = {}
            this.playerState.jumpHeld = false
            return;
        }

        if (IS_MOBILE) {
            if (event.type === "end") {
                this.playerState.keyStates["KeyW"] = false;
                this.playerState.keyStates["KeyS"] = false;
                this.playerState.keyStates["KeyA"] = false;
                this.playerState.keyStates["KeyD"] = false;
                this.playerState.joystickStates["Left"] = false;
                this.playerState.joystickStates["Right"] = false;
                this.playerState.joystickStates["ANGLE"] = false;
                this.playerState.joystickStates["DIRECTION"] = false;
            }

            this.playerState.keyStates["KeyW"] = JOYSTICK_DIRECTIONS["UP"].includes(event.direction);
            this.playerState.keyStates["KeyS"] = JOYSTICK_DIRECTIONS["DOWN"].includes(event.direction);

            if (IS_FIRST_PERSON && ORIENTATION === PORTRAIT) {
                this.playerState.joystickStates["Left"] = JOYSTICK_DIRECTIONS["LEFT"].includes(event.direction);

                this.playerState.joystickStates["Right"] = JOYSTICK_DIRECTIONS["RIGHT"].includes(event.direction);

                if (
                    JOYSTICK_DIRECTIONS["RIGHT_OR_LEFT_ONLY"].includes(event.direction)
                 ) {
                    this.mobilePanSpeed = FAST_MOBILE_PAN_SPEED;
                } else {
                    this.mobilePanSpeed = DEFAULT_MOBILE_PAN_SPEED;
                }
            } else {
                this.playerState.joystickStates["DIRECTION"] = event.direction;

                if (event.angle<105 && event.angle > 85) {
                    event.angle = 90;
                }

                this.playerState.joystickStates["ANGLE"] = event.angle;
                this.playerState.keyStates["KeyA"] = JOYSTICK_DIRECTIONS["LEFT"].includes(event.direction);
                this.playerState.keyStates["KeyD"] = JOYSTICK_DIRECTIONS["RIGHT"].includes(event.direction);
            }

        } else {

            this.playerState.keyStates[event.code] = true;
        }

        if ( Players.main?.isSitting && (
            this.playerState.keyStates["KeyW"] ||
            this.playerState.keyStates["KeyS"] ||
            this.playerState.keyStates["KeyA"] ||
            this.playerState.keyStates["KeyD"] ||
            this.playerState.keyStates["ArrowUp"] ||
            this.playerState.keyStates["ArrowDown"] ||
            this.playerState.keyStates["Space"]
        )) Players.main.getUp();


        if (event.code === "KeyR") {

            if (new Date().getTime() - (this.prevKeyPressTimestamp || 0) < 200) {

                this.world.reset();
            }

            this.prevKeyPressTimestamp = new Date().getTime();
        } else {

            this.prevKeyPressTimestamp = 0;
        }
    };

    _handleKeyUp = (event) => {
        this.playerState.keyStates[event.code] = false;
    };

    _handleMouseUp = (event) => {

        if (this.pointerLocked) return;

        this._isDragging = false;

        if (IS_TOUCH) {

            if( this.isJumping ) {

                this.isJumping = false

                return
            }

            this.isPressing = false

            this.accuRotation = 0
        }


        return

        let lastPoint = this.trackingPoints[this.trackingPoints.length - 1]

        if(lastPoint) {
            this.addTrackingPoint(
                lastPoint.x,
                lastPoint.y
            )
        }

         // Update velocity
         if(this.trackingPoints.length > 1) {


            const lastPoint = this.trackingPoints[this.trackingPoints.length - 1]
            const firstPoint = this.trackingPoints[0]

            const xOffset = lastPoint.x - firstPoint.x
            const yOffset = lastPoint.y - firstPoint.y;

            const timeOffset = (lastPoint.time - firstPoint.time) / 1000

            var D = timeOffset * this.intertialRotationParams.multiplier

            const vx = (xOffset / D) || 0; // prevent NaN
            const vy = (yOffset / D) || 0;

            if(Math.abs(vx) > 1 || Math.abs(vy) > 1) {
                this.rotateVelocity.x = vx
                this.rotateVelocity.y = vy
                this.rotateVelocity.active = true
            }

        }
        else {

            this.resetInertialRotation()
        }

        // We need to delay this until after click is handled
        setTimeout(() => {

            this.wasStoppingRotation = false
        })
    }

    _handleMouseDown = (event) => {

        if (this.pointerLocked) return;

        this._isDragging = true;

        if(IS_TOUCH) {

            if( this.isPressing == true ) {

                this.isJumping = true

                return
            }

            this.accuRotation = 0

            this.mouseXtouch =  event.normalized.x

            this.isPressing = true

            this.isPressingTimer = 0
        }


    }

    _handleMouseMove = (event) => {

        if (this.pointerLocked) return;

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

            if( this.isPressingTimer < this.isPressingThreshold  && Math.abs(movementX) > this.rotateThreshold )  {

                this.isPressing = false
            }

        }



        this.setRotationFromMouseMovement(movementX, movementY)

        // console.log( this.mouseXtouch )

        // if(IS_TOUCH) {

        //     const lastEvent = event.mousemovePackets[event.mousemovePackets.length - 1]

        //    // this.addTrackingPoint(lastEvent.raw.screenX, lastEvent.raw.screenY)
        // }

    }

    addTrackingPoint(x, y, time = performance.now()) {

        while (this.trackingPoints.length > 0) {

            if (time - this.trackingPoints[0].time <= 100) {
                break
            }

            this.trackingPoints.shift()
        }

        this.trackingPoints.push({x, y, time})
    }

    addTrackingPinch(pinchDistance, time = performance.now()) {

        while (this.trackingPinchs.length > 0) {

            if (time - this.trackingPinchs[0].time <= 100) {
                break
            }

            this.trackingPinchs.shift()
        }

        this.trackingPinchs.push({pinchDistance, time})
    }

    resetInertialRotation = () => {
        this.rotateVelocity.x = 0
        this.rotateVelocity.y = 0
        this.rotateVelocity.active = false
    }

    resetTrackingPinch = () => {
        // console.log("deceleratePinch, endddddddddddddddddd")
        this.pinchs = 0
        this.pinchVelocity.active = false
        this._handleKeyDown(dirEndEvent)

    }

    setRotationFromMouseMovement = (movementX, movementY) => {


        let ratioXY = Math.abs(movementY / movementX)

        let factorX = 1

        let factorY = 1

        if(ratioXY < this.minRatioToRotateY) {

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

        // this.movementX = movementX

        if (!IS_FIRST_PERSON) {

            if( IS_MOBILE ) {

                movementY = -movementY
            }

            // @ts-ignore

            if( this.camera && this.camera.move ) {

                if( IS_MOBILE ) {

                    this.movements = {
                        x: -movementX,
                        y: movementY
                    }

                    if( this.isPressing == true ) {

                        this.camera.move( this.movements.x, this.movements.y )
                    }

                }
                else {

                    this.camera.move( movementX, movementY)
                }

            }

            return
        }



        this.euler.setFromQuaternion(this.camera.quaternion )

        if(this.targetQuat == null) {

            this.targetQuat = new Quaternion()

            this.targetQuat.copy(this.camera.quaternion)
        }

        this.euler.setFromQuaternion(this.targetQuat)

        // console.log('right there', movementX)

        this.euler.y -= movementX * this.rotationConversion.dxToRad

        this.euler.x -= movementY * this.rotationConversion.dyToRad

        this.euler.x = clamp( -Math.PI / 2, Math.PI / 2, this.euler.x  )

        this.targetQuat.setFromEuler(this.euler)

        // this.camera.quaternion.setFromEuler(this.euler)
    }


    handlePinchZoom = (ev) => {

        if(ORIENTATION === PORTRAIT) {

            // console.log("Pinch zoooooooooooooooom")

            if(Math.sign(this.pinchs) !== ev.direction) {

                this.pinchs = ev.pinchDelta
            }
            else {

                this.pinchs += ev.pinchDelta
            }

            this.doPinch()

            this.addTrackingPinch(ev.pinchDistance)

        }
    }

    handlePinchEnd = ev => {

        if (ORIENTATION !== PORTRAIT) return;
        this.pinchs = 0

        if(this.trackingPinchs.length > 1) {

            // console.log("Pinch enddddddddddddddddddddddddddd")

            let lastPinch = this.trackingPinchs[this.trackingPinchs.length - 1]


            this.addTrackingPinch(
                lastPinch.pinchDistance
            )

            lastPinch = this.trackingPinchs[this.trackingPinchs.length - 1]

            const firstPinch = this.trackingPinchs[0]

            const offset = lastPinch.pinchDistance - firstPinch.pinchDistance

            const timeOffset = (lastPinch.time - firstPinch.time) / 1000

            var D = timeOffset * this.intertialPinchParams.multiplier


            const velocity = (offset / D) || 0; // prevent NaN


            if(Math.abs(velocity) > 1) {
                this.pinchVelocity.value = velocity
                this.pinchVelocity.active = true
            }
            else {
                this._handleKeyDown(dirEndEvent)
            }

        }
        else {
            this._handleKeyDown(dirEndEvent)
        }
    }

    doPinch = () => {

        if(Math.abs(this.pinchs) >= this.pinchTreshhold) {

            if(this.pinchs < 0) this._handleKeyDown(dirDownEvent)

            else if(this.pinchs > 0) this._handleKeyDown(dirUpEvent)
        }
    }

    tmpDirection = new Vector3()

    handleClick = ev => {

        if(ORIENTATION === PORTRAIT && this.cursorPosition) {


            if(!this.wasStoppingRotation) {

                this.tmpDirection.copy(this.cursorPosition).sub(this.camera.position)

                this.tmpDirection.normalize()

                const result = this.world.rayIntersect(this.camera.position, this.tmpDirection)

                // console.log("click on floor", result, this.cursorPosition)


                if(result) {

                    const diff = this.cursorPosition.distanceTo(result.position)

                    if(diff > 1) {

                        return
                    }
                }

                const targetPos = this.cursorPosition.clone()

                this.moveToPosition(targetPos)
            }
        }
    }

    handleResize = () => {
        this.pinchs = 0

        // Update rotation speed
        if(!IS_TOUCH) {

            const SPEED = 0.0018;

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

        if (!IS_MOBILE) applyKeyboardTurn(this, deltaTime, !IS_FIRST_PERSON);

        if (IS_FIRST_PERSON && this.playerState.joystickStates["Left"] ) {
            this.setRotationFromMouseMovement(deltaTime * -this.mobilePanSpeed, 0);
        } else if (this.playerState.joystickStates["Right"] ) {
            this.setRotationFromMouseMovement(deltaTime * this.mobilePanSpeed, 0);
        }

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

        // add additional rotation at the edge of the screen

        if(!IS_FIRST_PERSON && IS_MOBILE  ) {

            if( this.isPressing == false && this.movements != null ) {

                this.movements.x *= 0.9
                this.movements.y *= 0.9

                this?.camera?.move?.(  this.movements.x , this.movements.y )

            }

            this?.camera?.move?.( this.accuRotation * 180.0,0)
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

        //     let touchGo = false

        //     if( this.isPressing ) {

        //         this.isPressingTimer += deltaTime


        //         if( this.isPressingTimer > this.isPressingThreshold ) {

        //             touchGo = true

        //         }

                // if( this.isJumping ) {

                //     this.playerState.keyStates["Space"] = true

                // }

                // else {

                //     this.playerState.keyStates["Space"] = false
                // }
            // }

        //     if( touchGo ){

        //         speedFactor = 1

        //         this.playerState.keyStates["KeyW"] = true

        //     }

        //     else{

        //         speedFactor = 0

        //         this.playerState.keyStates["KeyW"] = false
        //     }

        }


        if( this.targetQuat ) {

            if( IS_MOBILE ) {

                this.camera.quaternion.slerp(this.targetQuat,( this.isPressing ? 1 : 0.1 ) )

            }
            else {

                this.camera.quaternion.copy(this.targetQuat)
            }
        }

        if(speedFactor == null) {

            speedFactor = 1
        }

        const result = this.world.update(deltaTime, elapsedTime, speedFactor)

        if(result?.intersectedMeshes) {

            this.emit(Events.COLLISION, result.intersectedMeshes)
        }

        return result
    }

    decelerateRotation = (deltaTime) => {

        this.rotateVelocity.x *= 1 - this.intertialRotationParams.dampingFactor
        this.rotateVelocity.y *= 1 - this.intertialRotationParams.dampingFactor

        if( Math.abs(this.rotateVelocity.x) > this.velocityStopTreshhold ||
            Math.abs(this.rotateVelocity.y) > this.velocityStopTreshhold
        ) {

            this.setRotationFromMouseMovement(
                this.rotateVelocity.x * deltaTime,
                this.rotateVelocity.y * deltaTime,
            )

        }
        else {

            this.resetInertialRotation()
        }
    }

    deceleratePinch = (deltaTime) => {

        this.pinchVelocity.value *= 1 - this.intertialPinchParams.dampingFactor

        // console.log("deceleratePinch", this.pinchVelocity.value)

        if( Math.abs(this.pinchVelocity.value) > this.velocityStopTreshhold ) {

            this.pinchs = 10

            this.doPinch()

            return this.pinchVelocity.value / this.world.speed
        }
        else {
            this.resetTrackingPinch()
        }
    }

    updatePlayer(deltaTime, elapsedTime) {

        this.world.updatePlayer(deltaTime, elapsedTime)
    }

    /** @param { Vector3 } targetPos */
    async moveToPosition (targetPos) {

		var ease = "power2.Out"

		this.tweenPos?.kill()

		this.tweenPos = null


	    const animationSpeed = 16; // speed per milliseconds

	    let duration = Math.min( Math.max((targetPos.distanceTo(this.world.target) / animationSpeed), 0.8), 2 );

	    // moveTween = new TWEEN.Group();

	    // this.controls.isPlaying = true

	    const pos = this.world.target.clone()

        if (this.world.shouldUseFirsPerson()) {

            targetPos.y += this.world.collisions.collider_height + this.world.collisions.capsuleRadius;

            let currentHeight = this.world.rayIntersect(this.world.target, DOWN_VECTOR)?.distance || -1

            console.log("current height", currentHeight)

            let targetHeight = this.distanceToFloor(targetPos)

            console.log("target height", targetHeight)

            if(currentHeight !== targetHeight) {

                targetPos.y -= targetHeight - currentHeight

                // Check final Y position
                this.targetCollitions(targetPos)

                console.log("Correcting final Y", targetHeight, "current height", currentHeight, "target height", targetHeight)
            }

        }

	    const animPos = new Promise(resolve => {
	        this.tweenPos = gsap.to(pos, {
	            ...targetPos,
	            duration,
	            ease,
	            onUpdate: (e)=> {
	                this.world.target.copy(pos)
	            },
	            onComplete: resolve
	        })
	    })


	    await animPos.then(()=>{

	    	this.tweenPos  = null
	    })
	    // this.controls.isPlaying = false
	}

    /**
     *
     * @param { Vector3 } point
     * @returns
     */
    distanceToFloor(point) {

        return this.world.distanceToFloor(point)
    }

    targetCollitions(target) {

        let result = this.world?.playerCollitions(target)

        if(result?.result) {

            target.copy(result.endPosition)

            return result.result
        }
    }

    /**
     *
     * @param { Vector3 } position
     * @param { Euler | Vector3 } rotation
     */
     goto(position, rotation = null) {

        if(IS_FIRST_PERSON) {

            this.camera.position.copy(position)

            if(rotation instanceof Euler) {

                this.camera.rotation.copy(rotation)
            }
            else if(rotation instanceof Vector3) {

                this.camera.lookAt(rotation)
            }

            this.targetQuat?.copy(this.camera.quaternion)
        }
        // else {

        //     this.world.collisions.moveCapsule(position)
        // }
    }

    isClickLocked() {

        return this.dragMode
    }

    dispose() {

        this.removeEvents()

        this.world.dispose()
    }
}
