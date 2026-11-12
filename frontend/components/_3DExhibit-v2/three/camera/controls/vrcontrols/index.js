
// @ts-check

import { Group, Matrix4, PerspectiveCamera, Vector3 } from 'three'

import Events from '@3events'

import Emitter from '@3emitter'





import mediator from '@3mediator'

import DiskCursor from '@3factory/cursor/diskcursor'


import { AbstractControls } from '../abstract'


import { Physics } from '../physics';

import { TWO_PI } from '@utils/js'



import XRControllerFactory from "./xrcontrollerfactory"




export class VRControls extends AbstractControls {


    /**
     * @param { import("@gltypes").ControlsOptions } opts
     */
    constructor(opts) {

        super()

        this.BUTTONS = {
            A: 4,
            B: 5
        }

        this.name = 'VRControls'

        this.currentSpace = opts.space

        this.roomParameters = opts.roomParameters

        this.cameraWrapper = new Group()

        this.cameraWrapper.rotation.order = "YXZ"

        this.currentSpace.scene.add(this.cameraWrapper)

        this.setCamera(opts.camera)

        /** @type { Group } */
        this.controller1 = null

        /** @type { Group } */
        this.controller2 = null

        this.matrix1 = new Matrix4()

        /** @type { Group } */
        this.controllerGrip1 = null

        /** @type { Group } */
        this.controllerGrip2 = null

        this.speed = this.roomParameters?.playerSpeed || 100;

        // 360deg in 8s
        this.angularSpeed = 8

        // Move if the angle ove joystick is 60deg (30deg from vertical axis)
        this.minRatioToMove = Math.tan(Math.PI / 6)

        // Move if the angle ove joystick is 30deg from horizontal axis
        this.minRatioToRotate = Math.tan(Math.PI / 3)

        this.initCamera()

        this.world = new Physics(opts)

        this.playerState = this.world.playerState

    }

    async init() {

        await this.world.init()
    }

    reset() {

        this.playerState.reset()
    }

    copyState(otherControls) {

        this.world.copyState(otherControls.world)
    }

    initCamera() {

        this.cameraWrapper.position.copy(this.camera.position)

        this.cameraWrapper.rotation.copy(this.camera.rotation)

        this.camera.position.set(0,0,0)

        this.camera.rotation.set(0,0,0)

        this.cameraWrapper.updateMatrixWorld(true)

        this.camera.updateMatrixWorld(true)
    }


    initVRControllers() {

        if(this.controller1 != null) return

        const { controller1, controller2, controllerGrip1, controllerGrip2 } = XRControllerFactory.getControllers()


        this.controller1 = controller1

        this.controller2 = controller2

        this.controllerGrip1 = controllerGrip1

        this.controllerGrip2 = controllerGrip2

        this.payload1 = {
            isVR: true,
            index: 1,
            controller: this.controller1
        }


        this.mouseCursor = DiskCursor.get({ roomParameters: this.roomParameters })

        this.currentSpace.scene.add(this.mouseCursor)
    }

    /** @param { PerspectiveCamera } camera */
    setCamera(camera) {

        if(this.camera) {

            this.cameraWrapper.remove(this.camera)
        }

        this.camera = camera

        this.cameraWrapper.add(camera)

        this.world?.setCamera(camera)
    }



    onSelectStart1 = () => {

        mediator.mousedown(this.payload1)
    }

    onSelectEnd1 = () =>  {

        mediator.mouseup(this.payload1)

        setTimeout(() => {

            if(this.cursorPosition) {

                const user = this.camera.parent

                user.position.set(
                    this.cursorPosition.x,
                    user.position.y,
                    this.cursorPosition.z,
                )
            }
        })
    }

    onSelectStart2 = () => {}

    onSelectEnd2 = () =>  {}

    onRaycast = (e) => {

        // console.log("onRaycast", e)

        this.cursorPosition = e.point
    }

    get gamepad1() {
        return this.controller1?.userData?.gamepad
    }

    get gamepad2() {
        return this.controller2?.userData?.gamepad
    }

    tmpVec3 = new Vector3()

    state = {}


    update = (deltaTime, elapsedTime) => {

        if(!this.matrix1.equals(this.controller1.matrixWorld)) {

            this.matrix1.copy(this.controller1.matrixWorld)

            mediator.mousemove(this.payload1)
        }


        if(this.cursorPosition) {

            this.mouseCursor.visible = true

            this.mouseCursor.position.set(
                this.cursorPosition.x,
                this.cursorPosition.y + 0.01,
                this.cursorPosition.z
            );


        }
        else {

            this.mouseCursor.visible = false
        }

        this.state.keyStates = {}
        this.state.speed = 0
        this.state.rotationY = 0

        if(this.gamepad1) {

            this.updateGamepadState(this.gamepad1, this.state, deltaTime)
        }

        if(this.gamepad2) {

            this.updateGamepadState(this.gamepad2, this.state, deltaTime)
        }

        this.playerState.keyStates = this.state.keyStates

        this.playerState.speed = this.state.speed

        this.cameraWrapper.rotation.y += this.state.rotationY



        this.world.update(deltaTime, elapsedTime, 1)
    }


    updateGamepadState(gamepad, state, deltaTime) {

        gamepad.update()

        state.speed = this.speed

        // playerState.joystickState.pan.copy(gamepad1.pan)

        const ratioXY = Math.abs(gamepad.pan.z / gamepad.pan.x)

        if(ratioXY >= this.minRatioToMove) {

            const key = gamepad.pan.z < 0 ? "KeyS" : "KeyW"

            state.keyStates[key] = true
        }
        else if(ratioXY <= this.minRatioToRotate ) {

            const sense = -Math.sign(gamepad.pan.x)

            state.rotationY += (TWO_PI / this.angularSpeed) * deltaTime * sense

        }

        if(gamepad.buttons[this.BUTTONS.A]?.pressed) {

            state.keyStates["Space"] = true
        }

    }

    playFeedback() {
        this.gamepad1?.pulse?.()
    }


    addEvents() {

        this.initVRControllers()

        Emitter.on(Events.PRE_UPDATE, this.update)

        this.currentSpace?.floors.forEach(floor => {

            floor.on(Events.FLOOR_INTERSECTED, this.onRaycast)
        })

        this.connectControllers()
    }

    removeEvents() {

        Emitter.off(Events.PRE_UPDATE, this.update)

        this.currentSpace?.floors.forEach(floor => {

            floor.off(Events.FLOOR_INTERSECTED, this.onRaycast)
        })

        this.disconnectControllers()
    }

    connectControllers() {

        if(this.controller1 == null) return

        this.controller1.addEventListener("selectstart", this.onSelectStart1)

        this.controller1.addEventListener("selectend", this.onSelectEnd1)

        this.controller2.addEventListener("selectstart", this.onSelectStart2)

        this.controller2.addEventListener("selectend", this.onSelectEnd2)


        this.cameraWrapper.add(this.controller1)

        this.cameraWrapper.add(this.controller2)

        this.cameraWrapper.add(this.controllerGrip1)

        this.cameraWrapper.add(this.controllerGrip2);
    }

    disconnectControllers() {

        if(this.controller1 == null) return

        this.controller1.removeEventListener("selectstart", this.onSelectStart1)

        this.controller1.removeEventListener("selectend", this.onSelectEnd1)

        this.controller2.removeEventListener("selectstart", this.onSelectStart2)

        this.controller2.removeEventListener("selectend", this.onSelectEnd2)


        this.camera.parent.remove(this.controller1)

        this.camera.parent.remove(this.controller2)

        this.camera.parent.remove(this.controllerGrip1)

        this.camera.parent.remove(this.controllerGrip2);
    }

    dispose() {

        this.removeEvents()

        this.camera.parent.remove(this.camera)

        if(this.mouseCursor) {

            this.mouseCursor.dispose()

            this.currentSpace.scene.remove(this.mouseCursor)
        }
    }
}
