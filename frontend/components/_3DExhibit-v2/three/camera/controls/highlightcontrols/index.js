// @ts-check



import * as THREE from "three"

import {

    CANVAS, USER_HEIGHT, VIEW

}  from "@3constants"

import Emitter from "@3emitter"

import Events from "@3events"

import { AbstractControls } from "../abstract"

import clamp from "@3utils/math/clamp"

import conf from "@3gl/utils/params"
import { Camera, Spherical, Vector3 } from "three"


export class HiglightControls extends AbstractControls {


    constructor() {

        super()

        this.name = 'HiglightControls'

        /** @type { Camera } */
        this.camera = null

        this.rotationConversion = {
            dxToRad: +conf.drx || 0.1,
            dyToRad: +conf.dry || 0.05
        }


        this.dampingFactor = +conf.df || 0.05;

        this.target = new Vector3()

        this.pos = new Vector3()

        this.initSph = new Spherical()

        this.taregtSph = new Spherical()

        this.targetPos = new Vector3()
    }

    /**
     *
     * @param { Camera } camera
     */
    setCamera( camera ) {

        this.camera = camera

        if(camera != null) {

            this.initSph.setFromVector3(this.pos.subVectors(camera.position, this.target))

            this.taregtSph.copy(this.initSph)

            // @ts-ignore
            this.onMouseMove({clientX: VIEW.w * 0.5, clientY: VIEW.h * 0.5})
        }

    }



    addEvents() {

        if(this.enabled) return

        this.enabled = true

        window.addEventListener("mousedown", this.onMouseDown)

        window.addEventListener("mousemove", this.onMouseMove)

        window.addEventListener("mouseup", this.onMouseUp)

        if(this.dampingFactor < 1) {

            Emitter.on(Events.PRE_UPDATE, this.update)
        }


    }


    removeEvents() {

        if(!this.enabled) return

        this.enabled = false

        window.removeEventListener("mousedown", this.onMouseDown)

        window.removeEventListener("mousemove", this.onMouseMove)

        window.removeEventListener("mouseup", this.onMouseUp)

        if(this.dampingFactor < 1) {

            Emitter.off(Events.PRE_UPDATE, this.update)
        }


    }

    onMouseDown = (e) => {
        this.isDragging = true
    }

    onMouseUp = (e) => {
        this.isDragging = false
    }



    /**
     *
     * @param { MouseEvent } e
     * @returns
     */
    onMouseMove = (e) => {

        if(this.isDragging) return;

        let radPerPixelX = Math.PI / VIEW.w

        let radPerPixelY = Math.PI / VIEW.h

        const mouseX = e.clientX - VIEW.w / 2

        const mouseY = e.clientY - VIEW.h / 2

        let deltaX = -mouseX * radPerPixelX * this.rotationConversion.dxToRad

        let deltaY = -mouseY * radPerPixelY * this.rotationConversion.dyToRad


        this.taregtSph.set(
            this.initSph.radius,
            this.initSph.phi + deltaY,
            this.initSph.theta + deltaX
        )

        this.targetPos.setFromSpherical(this.taregtSph).add(this.target)

        if(this.dampingFactor === 1) {

            this.camera.position.copy(this.targetPos)

            this.camera.lookAt(this.target)
        }

        // console.log(this.targetPos)
    }

    update = () => {

        this.camera.position.lerp(this.targetPos, this.dampingFactor)

        this.camera.lookAt(this.target)
    }


    dispose = () => {
        //
        this.removeEvents()

    }

}


export default new HiglightControls()
