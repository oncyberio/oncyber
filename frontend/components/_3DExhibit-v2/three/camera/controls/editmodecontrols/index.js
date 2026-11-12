// @ts-check

import CameraControls from "camera-controls"

// import Scene from "@3scene"

import * as THREE from "three"

import {

    CANVAS, IS_MOBILE, USER_HEIGHT

}  from "@3constants"

import Emitter from "@3emitter"

import Events from "@3events"

import { AbstractControls } from "../abstract"
import { Euler, Spherical, Vector3 } from "three"
import { getUserInitialPositions } from "@components/_3DExhibit-v2/three/utils/camera"
import { getDistanceToFitBox, lookAtDistance } from "@components/_3DExhibit-v2/three/utils/three"

const obj = new THREE.PerspectiveCamera()
obj.rotation.order = "YXZ"

const UP_VECTOR = new Vector3(0, 1, 0)

export function getEulerFromLookat(position, target) {

    obj.position.copy(position)

    obj.rotation.set(0,0,0)

    obj.lookAt(target)

    return obj.rotation.clone()
}

CameraControls.install({ THREE: THREE });

const EPS = 1e-5;


const TARGET = new Vector3(-10.502310085718126, 0.581587538499533,  0.7745837808404059)

const zoomOutPos = new Vector3(-300, 90, 100)


export class EditModeControls extends AbstractControls {


    /**
     * @param { import("@gltypes").ControlsOptions } opts
     */
    constructor(opts) {

        super()

        this.type = "editmode"

        this.name = 'EditModeControls'

        this.isMapView = false

        opts.camera.position.set(0, 0, EPS)


        this.keyStates = {}

        this.cameraControls = new CameraControls(opts.camera, CANVAS)

        this.updateControls()

        // this.cameraControls.enabled = false

        // this.enabled = false

        // this._enabled = false

        this.enabled = false

        // We'll need to clean up this when we pause normally
        this.point = null

        this.isDragging = false

        this.setSpace(opts.space, opts.roomParameters)

        this.touchTimeout = null

        this.prevClickTime = 0
    }

    set enabled( val ){

        const lazy = true

        if( val == true ) {

            this.addEvents( lazy )
        }

        else {

            this.removeEvents( lazy )
        }

        this.cameraControls.enabled  = val

        this._enabled = val
    }

    get enabled(){

        return this._enabled
    }

    get playerSpeed() {

        return this._playerSpeed * (this.isMapView ? 10 : 1)
    }

    setSpace(space, roomParameters) {

        this.currentSpace = space

        this.roomParameters = roomParameters

        this._playerSpeed = roomParameters?.playerSpeed * 0.25;

        this.cameraControls.azimuthRotateSpeed = -0.5; // negative value to invert rotation direction
        this.cameraControls.polarRotateSpeed = -0.1; // negative value to invert rotation direction
        // this.cameraControls.truckSpeed;
        // this.cameraControls.mouseButtons.wheel = CameraControls.ACTION.ZOOM;
        // this.cameraControls.touches.two = CameraControls.ACTION.TOUCH_ZOOM_TRUCK;

        // this.cameraControls.moveTo(0, USER_HEIGHT, 0);

        // // camera.position.set(0, opts.roomParameters, 0);


        // if (roomParameters?.mobile_initialPlayerPosition) {
        //     this.cameraControls.moveTo(
        //         roomParameters?.mobile_initialPlayerPosition.x,
        //         USER_HEIGHT,
        //         roomParameters?.mobile_initialPlayerPosition.z,
        //         false
        //     );
        // }

        // if (roomParameters?.mobile_initialPlayerRotation) {
        //     this.cameraControls.rotateTo(
        //         roomParameters?.mobile_initialPlayerRotation.azimuthAngle,
        //         roomParameters?.mobile_initialPlayerRotation?.polarAngle
        //     );
        // }


        const opts = getUserInitialPositions(roomParameters)

        this.setCoords(opts.cameraPos, opts.cameraRot)

        this.cameraControls.saveState()

        this.cameraControls.update(0)
    }

    updateControls() {

        if (this.isMapView) {

            this.cameraControls.mouseButtons.left = CameraControls.ACTION.TRUCK
            
            this.cameraControls.mouseButtons.shiftLeft = CameraControls.ACTION.ROTATE
        }
        else {

            this.cameraControls.mouseButtons.left = CameraControls.ACTION.ROTATE   

            this.cameraControls.mouseButtons.shiftLeft = CameraControls.ACTION.TRUCK
        }

        this.cameraControls.mouseButtons.right = CameraControls.ACTION.ROTATE

        this.cameraControls.mouseButtons.middle = CameraControls.ACTION.ROTATE
    }


    tmpPos = new Vector3()
    tmpLookat = new Vector3()
    tmpEuler = new Euler(0, 0, 0, "YXZ")
    sph = new Spherical()

    async setCoords(pos, rot, trans = false) {
        //
        this.tmpPos.set(pos.x, pos.y, pos.z)

        if(rot.isEuler) {

            this.tmpEuler.set(rot.x, rot.y, rot.z)

            this.tmpLookat.set(0, 0, -1).applyEuler(this.tmpEuler) .add(this.tmpPos)
        }
        else {

            this.tmpLookat.set(rot.x, rot.y, rot.z)
        }

        await this.cameraControls.setLookAt(
            this.tmpPos.x, this.tmpPos.y, this.tmpPos.z,
            this.tmpLookat.x, this.tmpLookat.y, this.tmpLookat.z,
            trans
        )

        if (!trans) this.cameraControls.update(0)

        // setTimeout(() => {
        //     //
        //     const cam = this.cameraControls.camera

        //     console.log("Pos Eq?", pos.equals(cam.position), pos, cam.position)

        //     console.log("Rot Eq?", rot.equals(cam.rotation), rot, cam.rotation)

        //     //
        // }, 1000)
    }

    setPointerLocked( val ) {

        super.setPointerLocked( val )

        this.cameraControls.enabled = !val
    }


    applyState(state, transition) {

        return this.setCoords(state.position, state.rotation, transition)
    }

    async toggleMapView(opts = {}) {

        if (this.isMapView == opts.enabled) return;

        this.isMapView = opts.enabled

        let dampingFactor = this.cameraControls.dampingFactor

        try {

            this.updateControls()

            this.cameraControls.dampingFactor = 0.1

            await this._toggleMapView(opts)

        }
        finally {

            this.cameraControls.dampingFactor = dampingFactor
        }
    }


    async _toggleMapView(opts = {}) {

        const { enabled, transition = false, target, frontDir = false } = opts

        /** @type { THREE.PerspectiveCamera }  */
        // @ts-ignore
        const camera = this.cameraControls.camera

        if (target) {

            await this.setTarget({ target, transition, frontDir }, {
                position: enabled ? zoomOutPos.clone() : camera.position.clone(),
            })

            return
        }

        if(enabled) {

            const pos = zoomOutPos

            const t = TARGET

            await Promise.all([
                this.cameraControls.moveTo(pos.x, pos.y, pos.z, transition),
                this.cameraControls.setTarget(t.x, t.y, t.z, transition)
            ])
        }
        else {

            await Promise.all([
                this.cameraControls.setTarget(TARGET.x, TARGET.y, TARGET.z, transition),
                this.cameraControls.dollyTo(USER_HEIGHT, transition)
            ])
        }


        if(!transition) {

            this.cameraControls.update(0)
        }
    }

    focusOn(opts) {

        return this.setTarget(opts)
    }

    async setTarget( { target, transition = true, frontDir = false }, state = {} ) {

        const camera = this.cameraControls.camera

        const bbox = new THREE.Box3().setFromObject(target)

        const targetPos = target.getWorldPosition(new Vector3())

        targetPos.y = bbox.min.y + (bbox.max.y - bbox.min.y) * 0.5


        if (this.isMapView) {

            state.position ??= camera.position.clone()

            state.rotation = targetPos

            await this.applyState(state, transition)
        }
        else {

            // @ts-ignore
            const dist = Math.max(lookAtDistance(target, camera), 4.5)

            // Hack for large objects like reflector/water
            // TODO: Fix this properly
            if(dist > 200) {

                await Promise.all([
                    this.cameraControls.setTarget(TARGET.x, TARGET.y, TARGET.z, transition),
                    this.cameraControls.dollyTo(USER_HEIGHT, transition)
                ])

                return
            }

            let position

            if(frontDir) {

                const dir = target.getWorldDirection(new Vector3())

                if ( Math.abs(dir.dot(UP_VECTOR)) < 0.9 ) {

                    //
                    position = targetPos.clone().add(dir.multiplyScalar(dist))
                }
            }

            if (position == null) {

                position = camera.position
                    .clone()
                    .sub(targetPos)
                    .normalize()
                    .multiplyScalar(dist)
                    .add(targetPos)
                    .setY(Math.max(targetPos.y, USER_HEIGHT) * 1.2)
            }


            state.position = position

            state.rotation = getEulerFromLookat(position, targetPos)

           await this.applyState(state, transition)
        }

    }

    /*
    saveCoords() {
        //
        this._sp = this.cameraControls.camera.position.clone()

        this._sr = this.cameraControls.camera.rotation.clone()
    }

    restoreCoords() {
        //
        this.setCoords(this._sp, this._sr)

        setTimeout(() => {
            //
            const cam = this.cameraControls.camera

            console.log("Pos Eq?", this._sp.equals(cam.position), this._sp, cam.position)

            console.log("Rot Eq?", this._sr.equals(cam.rotation), this._sr, cam.rotation)

            //
        }, 1000)
    }
    */

     /**
     *
     * @param { Vector3 } position
     * @param { Euler | Vector3 } rotation
     */
     goto(position, rotation = null) {

        const camera = this.cameraControls.camera

        camera.position.copy(position)

        if(rotation instanceof Euler) {

            camera.rotation.copy(rotation)
        }
        else if(rotation instanceof Vector3) {

            camera.lookAt(rotation)
        }

        this.setCoords(camera.position, camera.rotation)
    }

    addEvents( lazy = false ) {

        if( lazy == false ) {

            this.enabled = true

            return
        }

        if ( this._enabled == false ) {

            if(this.currentSpace) {

                this.currentSpace.floors.forEach(floor => {

                    floor.on(Events.FLOOR_INTERSECTED, this.onRaycast)
                })
            }

            Emitter.on(Events.UPDATE, this.update)

            Emitter.on(Events.MOUSE_DOWN, this.mouseDown)

            Emitter.on(Events.MOUSE_MOVE, this.mouseMove)

            Emitter.on(Events.MOUSE_UP, this.mouseUp)

            Emitter.on(Events.KEY_DOWN, this.handleKeyDown);

            Emitter.on(Events.KEY_UP, this.handleKeyUp);

        }
    }

    touchStart = (e) => {

        if (!IS_MOBILE) return;

        if (this.touchTimeout)  {
            clearTimeout(this.touchTimeout)
        }

        // if double click go down
        if (Date.now() - this.prevClickTime < 300) {

            this.touchTimeout = setTimeout(() => {
                this.keyStates["KeyB"] = true
            }, 300)

            return
        };

        this.prevClickTime = Date.now()

        this.touchTimeout = setTimeout(() => {
            this.keyStates["Space"] = true
        }, 300)
    }

    touchEnd = (e) => {

        if (!IS_MOBILE) return;

        // clear everything
        if (this.touchTimeout)  {
            clearTimeout(this.touchTimeout)
        }

        this.keyStates["Space"] = false
        this.keyStates["KeyB"] = false
    }

    removeEvents( lazy = false ) {

        if( lazy == false ) {

            this.enabled = false

            return
        }

        if ( this._enabled == true ) {

            Emitter.off(Events.UPDATE, this.update)

            if(this.currentSpace) {

                this.currentSpace.floors.forEach(floor => {

                    floor.off(Events.FLOOR_INTERSECTED, this.onRaycast)
                })
            }

            Emitter.off(Events.MOUSE_DOWN, this.mouseDown)

            Emitter.off(Events.MOUSE_MOVE, this.mouseMove)

            Emitter.off(Events.MOUSE_UP, this.mouseUp)

            Emitter.off(Events.KEY_DOWN, this.handleKeyDown);

            Emitter.off(Events.KEY_UP, this.handleKeyUp);

        }
    }


    handleKeyDown = (event) => {

        if(event.ctrlKey || event.metaKey) return

        if (event.source === "joystick" ) {
            this.keyStates["KeyW"] = false;
            this.keyStates["KeyS"] = false;
            this.keyStates["KeyA"] = false;
            this.keyStates["KeyD"] = false;

            if (event.code) {
                this.keyStates[event.code] = true;
            }

            return;
        }

        this.keyStates[event.code] = true;
        // console.log("edit/keydown", this.keyStates, event.code)
    };

    handleKeyUp = (event) => {

        if(event.ctrlKey || event.metaKey) return

        this.keyStates[event.code] = false;
        // console.log("edit/keyup", this.keyStates, event.code)
    };

    reset = () => {

        this.keyStates = {}
    }

    controls(delta) {

        if (
            this.keyStates["KeyW"] ||
            this.keyStates["ArrowUp"]
        ) {
            this.moveForward(delta)
        }

        if (
            this.keyStates["KeyS"] ||
            this.keyStates["ArrowDown"]
        ) {
            this.moveBackward(delta);
        }

        if (
            this.keyStates["KeyA"] ||
            this.keyStates["ArrowLeft"]
        ) {
            this.moveLeft(delta);
        }

        if (
            this.keyStates["KeyD"] ||
            this.keyStates["ArrowRight"]
        ) {
            this.moveRight(delta);
        }

        if (this.keyStates["Space"]) {
            this.moveUp(delta);
        }

        if (
            this.keyStates["KeyB"]
        ) {
            this.moveDown(delta);
        }
    }

    update = (delta) => {

        this.controls(delta);

        this.cameraControls.update(delta);

    }

    onRaycast = (e) => {

        // console.log(e)
        this.point = e.point;
    }

    cursorHandler() {

        if (this.isDragging) {

            CANVAS.style.cursor = "grab";

        } else if (this.point != null) {

            CANVAS.style.cursor = "pointer";
        }

    }

    mouseDown = (e) => {

        if (this.pointerLocked) return;

        this.touchStart(e)

        this.mouseDownEvent = e
    }

    mouseMove = (e) => {

        if (this.pointerLocked) return;

        if(this.mouseDownEvent) {

            this.touchEnd(e)

            this.isDragging = true
        }

        this.cursorHandler()
    }

    mouseUp = (e) => {


        if (this.pointerLocked || !this.mouseDownEvent) return;

        this.touchEnd(e)

        this.mouseDownEvent = null


        if (this.isDragging) {

            this.isDragging = false

            return
        }

        if(this.point) {

            this.cameraControls.dollyTo(0.00001, true);

            this.cameraControls.moveTo(
                this.point.x,
                this.point.y + USER_HEIGHT,
                this.point.z,
                true
            );
        }

    }

    moveLeft = (delta) => {
        this.cameraControls.truck(-this.playerSpeed * delta, 0, false);
    };

    moveRight = (delta) => {
        this.cameraControls.truck(this.playerSpeed * delta, 0, false);
    };

    moveForward = (delta) => {
        this.cameraControls.forward(this.playerSpeed * delta, false);
    };

    moveBackward = (delta) => {
        this.cameraControls.forward(-this.playerSpeed * delta, false);
    };


    moveUp = (delta) => {
        this.cameraControls.truck(0, -this.playerSpeed * delta, false);
    };


    moveDown = (delta) => {
        this.cameraControls.truck(0, this.playerSpeed * delta, false);
    };

    rotateAzimuth(angle) {
        this.cameraControls.rotateAzimuthTo(angle, true)
    }

    dispose = () => {
        this.removeEvents();
        this.point = null;
    }

}
