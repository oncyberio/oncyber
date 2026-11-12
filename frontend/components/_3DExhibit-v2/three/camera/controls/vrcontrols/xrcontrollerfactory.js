
// @ts-check

import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory'

import Renderer from "@3renderer"

import { GamePadController } from "./gamepadcontroller"
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, RingGeometry } from 'three'


class XRControllerFactory {

    constructor() {

        this.controllers = null

    }

    buildControllers() {

        this.controllers = {

            controller1: this.buildXRController(1),

            controller2: this.buildXRController(2)
        }

        // The XRControllerModelFactory will automatically fetch controller models
        // that match what the user is holding as closely as possible. The models
        // should be attached to the object returned from getControllerGrip in
        // order to match the orientation of the held device.

        const controllerModelFactory = new XRControllerModelFactory()

        this.controllers.controllerGrip1 = Renderer.xr.getControllerGrip(0)

        this.controllers.controllerGrip1.add(
            controllerModelFactory.createControllerModel(this.controllers.controllerGrip1)
        )

        this.controllers.controllerGrip2 = Renderer.xr.getControllerGrip(1)

        this.controllers.controllerGrip2.add(
            controllerModelFactory.createControllerModel(this.controllers.controllerGrip2)
        )


    }


    buildXRController(index) {

        const self = this

        const controller = Renderer.xr.getController(index - 1)

        controller.addEventListener("connected", function (event) {

            controller.userData.connected = true

            console.log(`controller ${index} connected`, event)
            if(event.data.gamepad) {
                console.log("detected gamedpad on controller ", index)
                const gamedpadController = new GamePadController(event.data.gamepad)
                // setTimeout(() => {
                //     gamedpadController.pulse()
                // }, 1000)
                controller.userData.gamepad = gamedpadController
            }
            else {
                console.log("No gamedpad on controller ", index)
            }
            this.add(self.buildGamepadController(event.data));
        })

        controller.addEventListener("disconnected", function () {

            console.log("controller disconnected", index)

            controller.userData.connected = false

            if(controller.userData.gamepad) {
                controller.userData.gamepad.dispose()
            }
            this.remove(this.children[0]);
        })

        return controller
    }

    buildGamepadController(data) {

        let geometry, material;

        switch (data.targetRayMode) {

            case "tracked-pointer":

                geometry = new BufferGeometry()

                geometry.setAttribute(
                    "position",
                    new Float32BufferAttribute([0, 0, 0, 0, 0, -100], 3)
                )

                geometry.setAttribute(
                    "color",
                    new Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3)
                )

                material = new LineBasicMaterial({
                    vertexColors: true,
                    blending: AdditiveBlending,
                })

                return new Line(geometry, material)

            case "gaze":

                geometry = new RingGeometry(0.02, 0.04, 32).translate(
                    0,
                    0,
                    -1
                )

                material = new MeshBasicMaterial({
                    opacity: 0.5,
                    transparent: true,
                })

                return new Mesh(geometry, material)
        }
    }

    getControllers() {

        if(this.controllers == null) {

            this.buildControllers()
        }

        return this.controllers
    }
}


export default new XRControllerFactory()
