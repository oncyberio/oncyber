// @ts-check

import * as Three from "three"
import Scene from "@3scene"
import { Vector3, Camera, Matrix4, Box3, Group, Euler, Raycaster, Object3D, BufferGeometry, Plane, PlaneHelper, SphereGeometry, CircleGeometry, Mesh, MeshBasicMaterial, DoubleSide, Quaternion, Matrix3, Line, LineBasicMaterial, ArrowHelper, Material } from 'three'

import { AxisArrow } from './axisarrow'
import { PlaneSlider } from './planeslider'
import { AxisRotator } from './axisrotator'
import { ControlsLabel } from "./label"
import { sRGBToLinear, xDir, yDir, zDir } from "./shared"
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants"

import { TYPES } from '@3artwork/constants'

import Events from "@3events"

import Emitter from "@3emitter"
import { BoxSlider } from "./boxslider"


if (process.env.NODE_ENV === "development") window.THREE = Three



const mL0 = new Matrix4()
const mW0 = new Matrix4()
const mP = new Matrix4()
const mPInv = new Matrix4()
const mW = new Matrix4()
const mL = new Matrix4()
const mL0Inv = new Matrix4()
const mdL = new Matrix4()

const bb = new Box3()
const bbObj = new Box3()
const vCenter = new Vector3()
const vSize = new Vector3()
const vAnchorOffset = new Vector3()
const vPosition = new Vector3()



const tmpVec = new Vector3()


const X = 0
const Y = 1
const Z = 2


const normalsByAxis = [
    new Vector3(0, 0, 1), // XY plane
    new Vector3(0, 0, 1), // XY plane
    new Vector3(1, 0, 0), // YZ plane
]

const unitsByAxis = [
    new Vector3(1, 0, 0), // X
    new Vector3(0, 1, 0), // Y
    new Vector3(0, 0, 1), // Z
]


const tmpWPosition = new Vector3()
const tmpWQuaternion = new Quaternion()
const tmpNormal = new Vector3()

const tmpNormalMatrix = new Matrix3()

const raycaster = new Raycaster();

/**
 *
 * @param {PointerEvent} event
 * @param {HTMLElement} domElement
 * @returns
 */
function getPointer(event, domElement) {
    if (domElement.ownerDocument.pointerLockElement) {
        return {
            x: 0,
            y: 0,
            button: event.button,
        };
    } else {
        const rect = domElement.getBoundingClientRect();
        return {
            x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
            y: (-(event.clientY - rect.top) / rect.height) * 2 + 1,
            button: event.button,
        };
    }
}

/**
 * @typedef {Object3D & { geometry: BufferGeometry }} Renderable
 */

/**
 * @param {Object3D} obj
 * @returns { obj is Renderable }
 */
function hasGeometry(obj) {
    // @ts-ignore
    return obj.geometry != null
}

export class PivotControls extends Group {


    planeIntersect = new Vector3()

    positionStart = new Vector3()
    quaternionStart = new Quaternion()
    scaleStart = new Vector3()

    worldPositionStart = new Vector3()
    worldQuaternionStart = new Quaternion()
    worldQuaternionStartInv = new Quaternion()
    worldScaleStart = new Vector3()

    pointStart = new Vector3()
    pointEnd = new Vector3()
    offset = new Vector3()


    parentPosition = new Vector3()
    parentQuaternion = new Quaternion()
    parentQuaternionInv = new Quaternion()
    parentScale = new Vector3()

    worldPosition = new Vector3()
    worldQuaternion = new Quaternion()
    worldQuaternionInv = new Quaternion()
    worldScale = new Vector3()
    worldDirection = new Vector3()

    cameraPosition = new Vector3()
    cameraQuaternion = new Quaternion()
    cameraScale = new Vector3()

    eye = new Vector3()

    constructor(opts) {

        super()

        this.opts = {
            autoTransform: true,
            disableAxes: false,
            disableSliders: false,
            disableRotations: false,
            activeAxes: [true, true, true],
            anchor: new Vector3(0, 0, 1),
            offset: new Vector3(0, 0, 0),
            rotation: new Euler(0, 0, 0),

            //styling
            axisLineWidth: 7,
            lineWidth: 5,
            axisColors: [0xFB3939, 0x00FF85, 0x00A3FF].map(sRGBToLinear),
            hoveredColor: sRGBToLinear(0xffff40),
            lineHelperColor: sRGBToLinear(0xdedede),
            angleHelperColor: sRGBToLinear(0xff0000),


            rotationLimits: {
                min: -90,
                max: 90,
            },
            ...opts
        }

        /** @type { Camera } */
        this.camera = opts.camera

        this.isYRotOnly = false

        this.root = new Group()

        this.gizmo = new Group()

        this.add(this.root)

        this.root.add(this.gizmo)

        this.raycastMeshes = []

        const handleOpts = {
            ...this.opts,
            ctx: this,
            onDragStart: this.onDragStart.bind(this),
            onDrag: this.onDrag.bind(this),
            onDragEnd: this.onDragEnd.bind(this)
        }

        this.axisArrows = [xDir, yDir, zDir].map((direction, axis) => {

            return new AxisArrow({
                ...handleOpts,
                axis,
                direction,
                normal: normalsByAxis[axis]
            })
        })

        // this.planeSliders = [[yDir, zDir], [zDir, xDir], [xDir, yDir]].map(([dir1, dir2], axis) => {

        //     return new PlaneSlider({
        //         ...handleOpts,
        //         axis,
        //         dir1,
        //         dir2,
        //         normal: unitsByAxis[axis]

        //     })
        // })

        this.axisRotators = [[yDir, zDir], [zDir, xDir], [xDir, yDir]].map(([dir1, dir2], axis) => {

            return new AxisRotator({
                ...handleOpts,
                axis,
                dir1,
                dir2,
                normal: unitsByAxis[axis]
            })
        })

        this.boxSlider = new BoxSlider(handleOpts)

        Scene.add(this.boxSlider)

        /** @type { import('./shared').Handle[] } */
        this.handles = []


        /** @type { Object3D } */
        this.object = null

        /** @type { import('./shared').Handle } */
        this.currentHandle = null

        this.visible = false

        /** @type { HTMLElement } */
        this.domElement = this.opts.domElement

        this.domElement.style.touchAction = "none";

        this.setMode("all")

        this.setSpace("world")



        // this.planeHelper = new PlaneHelper(this.handlePlane, 100)
        // if(!Array.isArray(this.planeHelper.material)) {
        //     //this.planeHelper.material.depthTest = false
        //     this.planeHelper.material.side = DoubleSide
        // }

        this.label = new ControlsLabel()
        this.label.visible = false

        this.add(this.label)

        // this.hitHelper = new Mesh(
        //     new SphereGeometry(0.05, 10, 10),
        //     new MeshBasicMaterial({
        //         side: DoubleSide,
        //         color: 0xff0000,
        //         depthTest: false
        //     })
        // )
        // this.hitHelper.renderOrder = 2000

    }

    attachLabel(mesh) {

        this.label.attachTo(mesh)
    }

    setLabelText(txt) {

        this.label.set(txt)

        this.label.visible = true
    }

    clearLabel() {

        this.label.mesh = null

        this.label.visible = false
    }

    getPlane() {

        if(this.currentHandle == null) return null

        this.raycastPlane = this.currentHandle.getRaycastPlane()

        return this.raycastPlane

    }


    addEvents() {

        if(this.enabled) return

        this.enabled = true

        this.domElement.addEventListener("pointerdown", this.onPointerDown);

        if(!IS_MOBILE) {
            this.domElement.addEventListener("pointermove", this.onPointerHover)
        }

        this.domElement.addEventListener("pointerup", this.onPointerUp);

        this.domElement.addEventListener("keydown", this.onKeyDown)

        Emitter.on(Events.PRE_UPDATE, this.update)
    }



    update = (force) => {

        if ( this.object == null || this.object.parent == null) return

        this.object.updateMatrixWorld();

        this.object.parent.matrixWorld.decompose( this.parentPosition, this.parentQuaternion, this.parentScale )

        this.object.matrixWorld.decompose( this.worldPosition, this.worldQuaternion, this.worldScale )

        this.object.getWorldDirection(this.worldDirection)

        this.parentQuaternionInv.copy( this.parentQuaternion ).invert()

        this.worldQuaternionInv.copy( this.worldQuaternion ).invert()

		this.camera.updateMatrixWorld()

		this.camera.matrixWorld.decompose( this.cameraPosition, this.cameraQuaternion, this.cameraScale )

		this.eye.copy( this.cameraPosition ).sub( this.worldPosition ).normalize()

        this.root.position.copy(this.object.position)

        this.root.quaternion.copy(this.object.quaternion)

        this.updateScale()

        // this.updateBBox()

		super.updateMatrixWorld( force )
    }

    removeEvents() {

        if(!this.enabled) return

        this.enabled = false

        this.domElement.removeEventListener("pointerdown", this.onPointerDown);
        this.domElement.removeEventListener("pointermove", this.onPointerHover)
        this.domElement.removeEventListener("pointerup", this.onPointerUp);
        this.domElement.removeEventListener("keydown", this.onKeyDown)

        Emitter.off(Events.PRE_UPDATE, this.update)
    }

    setTranslationSnap(nb) {}

    setScaleSnap(n) {}

    setRotationSnap(snap) {

        this.rotationSnap = snap
    }

    /**
     *
     * @param {"translate" | "rotate" | "scale" | "all"} mode
     */
    setMode(mode) {

        mode = "all"

        this.raycastMeshes = []

        this.handles = []

        this.gizmo.clear()

        const enableTranslate = true // mode === "translate" || mode === "all"
        const enableRotate = true // mode === "rotate" || mode === "all"

        if(enableTranslate) {

            this.axisArrows.forEach((it, i) => {

                this.gizmo.add(it)

                this.raycastMeshes.push(it.raycastMesh)

                this.handles.push(it)
            })

            // this.planeSliders.forEach(it => {

            //     this.gizmo.add(it)

            //     this.raycastMeshes.push(it.raycastMesh)

            //     this.handles.push(it)
            // })
        }
        if(enableRotate) {

            this.axisRotators.forEach(it => {

                this.gizmo.add(it)

                this.raycastMeshes.push(it.raycastMesh)

                this.handles.push(it)
            })
        }
    }

    /**
     *
     * @param { import("./shared").PivotSpace } space
     */
    setSpace(space) {

        this.space = space
    }

    /** 
     * @param { Object3D } object 
     * @param {{ snap3D: boolean }} [opts]
     * 
    */
    attach(object, opts) {
        //
        this.object = object
        this.addEvents()
        this.visible = true

        if (opts?.snap3D) {

            this.boxSlider.setObject(object)
        }

        // @ts-ignore
        this.isYRotOnly = this.object?.mediaType === TYPES.TRIGGER_ZONE

        if (this.isYRotOnly) {
            const [ x, y, z ] = this.axisRotators;

            x.visible = false;
            z.visible = false;
        }

        this.updateMatrixWorld(true)

        return this
    }


    detach() {

        this.boxSlider.setObject(null)

        this.object = null
        this.removeEvents()
        this.visible = false


        return
    }


    updateScale() {

        // @ts-ignore
        let factor = this.worldPosition.distanceTo( this.cameraPosition ) * Math.min( 1.9 * Math.tan( Math.PI * this.camera.fov / 360 ) / this.camera.zoom, 7 );

        this.gizmo.scale.set( 1, 1, 1 ).multiplyScalar( Math.max(factor * 1 / 8, 1 ));

        this.label.scale.copy(this.gizmo.scale)
    }

    updateBBox() {

        if (this.object == null || !this.opts.anchor) return

        mPInv.copy(this.object.matrixWorld).invert()

        bb.makeEmpty()

        this.object.traverse((obj) => {

            if (!hasGeometry(obj)) return


            if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox()

            mL.copy(obj.matrixWorld).premultiply(mPInv)

            bbObj.copy(obj.geometry.boundingBox)

            bbObj.applyMatrix4(mL)

            bb.union(bbObj)
        })

        vCenter.copy(bb.max).add(bb.min).multiplyScalar(0.5)

        vSize.copy(bb.max).sub(bb.min).multiplyScalar(0.5)

        vAnchorOffset
            .copy(vSize)
            .multiply(this.opts.anchor)
            .add(vCenter)

        vPosition.copy(this.opts.offset).add(vAnchorOffset)

        this.gizmo.position.copy(vPosition)
    }

     /**
     * @param { Vector3 } dir
     */
    turnAxisToEye(dir) {

        if(!this.dragging && !dir.equals(yDir) && this.eye.dot(dir) < 0) {

            dir.negate()
        }

 }

    _isDragging = false

    get dragging() {
        return this._isDragging;
    }

    /**
     * @param { boolean } value
     */
    set dragging(value) {
        let oldValue = this._isDragging;
        this._isDragging = value;
        if (oldValue !== value) {
            //
            this.dispatchEvent({
                type: "dragging-changed",
                value,
            });

            if(value) {
                this.object.dragStart?.()
            }
            else {
                this.object.dragEnd?.()
            }
        }
    }

    getCursor() {
        if (this.currentHandle == null || this.object == null) return null;

        if(this.locked) return "not-allowed"

        return this.currentHandle.getCursor?.() || "default"

    }

    onDragStart() {

        mL0.copy(this.root.matrix)

        mW0.copy(this.root.matrixWorld)

        this.opts.onDragStart?.()

    }

    /**
     *
     * @param { Matrix4 } mdW
     */
    onDrag (mdW) {

        mP.copy(this.object.parent.matrixWorld)

        mPInv.copy(mP).invert()

        // After applying the delta
        mW.copy(mW0).premultiply(mdW)

        mL.copy(mW).premultiply(mPInv)

        // mL0Inv.copy(mL0).invert()

        // mdL.copy(mL).multiply(mL0Inv)

        if (this.opts.autoTransform) {

            //this.matrix.copy(mL)

            mL.decompose(this.object.position, this.object.quaternion, tmpVec)

        }

        // this.opts.onDrag?.(mL, mdL, mW, mdW)
    }

    onDragEnd() {

        this.opts.onDragEnd?.()
    }

    /**
     * @param {PointerEvent} event
     */
    hitTestHandle(event) {

        let point = getPointer(event, this.domElement);

        raycaster.setFromCamera(point, this.camera);

        let result =  raycaster.intersectObjects(this.raycastMeshes, false);

        if (!result?.length && this.boxSlider.raycastMesh) {

            result = raycaster.intersectObjects([this.boxSlider.raycastMesh], false);
        }

        return result
    }

    /**
     * @param {PointerEvent} event
     */
    hitTestPlane(event) {

        let point = getPointer(event, this.domElement);

        // console.log("intersect", event.clientX, event.clientY, point)

        raycaster.setFromCamera(point, this.camera);

        const plane = this.getPlane()

        if(plane == null) return


        /** @type {Vector3} */
        let intersect

        intersect = raycaster.ray.intersectPlane(plane, this.planeIntersect);


        // if(intersect) {

        //     this.hitHelper.position.copy(intersect)

        //     this.hitHelper.visible = true
        // }
        // else {

        //     this.hitHelper.visible = false
        // }

        return intersect
    }

    _locked = false

    get locked() {

        return this._locked
    }

    set locked(val) {

        this._locked = val
    }

    /**
     *
     * @param { PointerEvent } event
     */
    onPointerHover = (event) => {

        if (!this.enabled || this.object == null || this.dragging) return;

        const intersects = this.hitTestHandle(event)

        let handle = intersects.length ? this.getHandleFromIntersect(intersects[0]) : null

        if(handle != null && intersects.length) {

            this.hitPoint = intersects[0].point
        }

        if(handle !== this.currentHandle) {

            this.currentHandle?.onPointerOut()

            this.currentHandle = handle;

            if(!this.locked) {

                this.currentHandle?.onPointerMove({
                    intersect: intersects[0]?.point,
                    ray: raycaster.ray,
                    raw: event
                })
            }
        }

    }


    /**
     *
     * @param { PointerEvent } event
     */
     onPointerDown = (event) => {


        if (
            !this.enabled ||
            this.locked ||
            this.object == null ||
            event.button !== 0
        )
            return;



        if(IS_MOBILE) {

            this.onPointerHover(event)

            // console.log("pointer over", this.currentHandle)
        }

        if(this.currentHandle == null) return

        this.dragging = true

        const isPlaneSlide = this.currentHandle instanceof PlaneSlider

        this.handles.forEach(it => {

            it.visible = it === this.currentHandle

            if(isPlaneSlide && it instanceof AxisArrow) {

                it.visible = it.opts.axis !== this.currentHandle.opts.axis
            }
        })

        const intersect = this.hitTestPlane(event);

        if(intersect == null) return

        event.stopPropagation()

        const cevent = {
            intersect,
            ray: raycaster.ray,
            raw: event
        }

        this.object.updateMatrixWorld();

        this.object.parent.updateMatrixWorld();

        this.positionStart.copy( this.object.position );

        this.quaternionStart.copy( this.object.quaternion );

        this.scaleStart.copy( this.object.scale );


        this.object.matrixWorld.decompose( this.worldPositionStart, this.worldQuaternionStart, this.worldScaleStart )

        this.worldQuaternionStartInv.copy(this.worldQuaternionStart).invert()

		this.pointStart.copy( intersect ).sub( this.worldPositionStart );

        this.currentHandle.onPointerDown(cevent)

        this.domElement.addEventListener("pointermove", this.onPointerMove);

        this.domElement.setPointerCapture(event.pointerId)

    }

    /**
     *
     * @param { PointerEvent } event
     */
    onPointerMove = (event) => {

        if (!this.enabled || this.object == null) return;


        if(!this._isDragging) {

        }
        else {

            // console.log("pointer drag", this.currentHandle)

            event.stopPropagation()

            const intersect = this.hitTestPlane(event);

            // console.log("intersect", intersect)

            if(intersect == null) return

            const cevent = {
                intersect,
                ray: raycaster.ray,
                raw: event
            }

            this.pointEnd.copy( intersect ).sub( this.worldPositionStart );

            this.offset.copy( this.pointEnd ).sub( this.pointStart );

            this.currentHandle.onPointerMove(cevent)

            // @ts-ignore
            this.object.updateCoords?.(true)

            this.updateMatrixWorld(true)
        }
    };

    /**
     *
     * @param { PointerEvent } event
     */
    onPointerUp = (event) => {

        if (!this.enabled || this.locked || !this._isDragging) return

        //this.pointStartLine.visible = false
        //this.pointEndLine.visible = false

        this.handles.forEach(it => {

            // @ts-ignore
            if (this.isYRotOnly) {

                if ( it.name === "AxisRotator-100" || it.name === "AxisRotator-001") {

                    return it.visible = false
                }
            }

            it.visible = true
        })

        this.currentHandle?.onPointerUp()

        this.domElement.releasePointerCapture(event.pointerId)

        this.domElement.removeEventListener("pointermove", this.onPointerMove);

        this.dragging = false
    };

    /**
     *
     * @param { KeyboardEvent } e
     */
    onKeyDown = e => {

        if(e.repeat) return

        if(e.shiftKey && (e.key === "l" || e.key === "L")) {

            this.setSpace (this.space === "world" ? "local" : "world")
        }
    }


    /**
     *
     * @param {import('three').Intersection} intersect
     * @returns { import('./shared').Handle }
     */
    getHandleFromIntersect(intersect) {

        // @ts-ignore
        return intersect?.object.userData.handle;
    }


    dispose() {

        this.removeEvents()
    }
}
