
// @ts-check

import { disposeObject3D } from '@3utils/three'
import { Color, ConeGeometry, CylinderGeometry, Group, Matrix3, Matrix4, Mesh, MeshBasicMaterial, Plane, Quaternion, Ray, Raycaster, Vector3 } from 'three'
import { PivotControls } from '.'
import { Line } from './line'
import { getHandlePlane, xDir, zDir } from './shared'


const offsetMatrix = new Matrix4()



const tmpWPosition = new Vector3()
const tmpWQuaternion = new Quaternion()
const tmpNormal = new Vector3()

const tmpNormalMatrix = new Matrix3()

const upV = new Vector3(0, 1, 0)


let axisCursor = [
    "ew-resize",
    "ns-resize",
    "ew-resize",
]


import PipeLineMesh from '@3abstract/pipelinemesh'

export class AxisArrow extends Group {


    constructor(opts) {

        super()

        this.opts = opts

        /** @type { Vector3 } */
        this.normal = this.opts.normal

        /** @type { PivotControls } */
        this.ctx = this.opts.ctx

        this.raycastPlane = new Plane()

        const coneWidth = 1 / 15
        const coneLength = 1 / 5
        const cylinderLength = (1 - coneLength) * 1.5

        // Used for raycast
        this.cylinder = new PipeLineMesh(
            new CylinderGeometry(coneWidth * 1.4, coneWidth * 1.4, cylinderLength + coneLength, 8, ),{

                visibleOnOcclusion: false,
                visibleOnMirror : false
            }
        )
        this.cylinder.position.set(0, (cylinderLength + coneLength) / 2.0, 0)
        this.cylinder.visible = false

        this.raycastMesh = this.cylinder
        this.raycastMesh.userData = { handle: this }

        this.line = new Line(
            [
                new Vector3(0,0,0),
                new Vector3(0, cylinderLength, 0)
            ],
            {
                color: this.getColor(),
                depthTest: false,
                linewidth: opts.axisLineWidth,
                polygonOffset: true,
                polygonOffsetFactor: -10,
            }
        )
        this.line.renderOrder = 1

        this.cone = new PipeLineMesh(
            new ConeGeometry(coneWidth, coneLength, 24, 1),
            new MeshBasicMaterial({
                transparent: true,
                depthTest: false,
                color: this.getColor(),
                polygonOffset: true,
                polygonOffsetFactor: -10
            }),
            {

                visibleOnDiffuse   : true,
                visibleOnOcclusion : true,
                visibleOnMirror    : false,
                occlusionMaterial: new MeshBasicMaterial(
                    {
                        color:0x000000,
                        depthTest: false,
                        polygonOffset: true,
                        polygonOffsetFactor: -10,
                        transparent: true,
                    }
                )
            }
        )
        this.cone.position.set(0, cylinderLength + coneLength / 2.0, 0)
        this.cone.renderOrder = 500


        this.axisHelper = new Line(
            [
                new Vector3(0,-100,0),
                new Vector3(0, 100, 0)
            ],
            {
                color: opts.lineHelperColor,
                depthTest: true,
                linewidth: opts.lineWidth / 4,
                polygonOffset: true,
                polygonOffsetFactor: -10,
            }
        )

        this.axisHelper.visible = false


        /** @type { Vector3 } */
        this.direction = this.opts.direction.clone().normalize()

        this.root = new Group()

        this.root.add(this.cylinder)
        this.root.add(this.line)
        this.root.add(this.cone)
        this.root.add(this.axisHelper)

        this.add(this.root)


        this.isHovered = false

        /** @type { { clickPoint: Vector3, dir: Vector3  } } */
        this.clickInfo = null

        this.plane = new Plane()
    }


    updateMatrixWorld(force) {

        if(this.ctx.space === "world") {

            this.quaternion.copy(this.ctx.worldQuaternionInv)

            this.ctx.turnAxisToEye(this.direction)

            this.root.quaternion.setFromUnitVectors(upV, this.direction)

        }
        else {

            this.quaternion.identity()
        }

        super.updateMatrixWorld(force)
    }

    getRaycastPlane() {

        if(this.opts.axis === 1) {

            tmpNormal.copy(this.ctx.eye).setY(0).normalize()

            this.raycastPlane.setFromNormalAndCoplanarPoint(tmpNormal, this.ctx.worldPosition)

            return this.raycastPlane
        }

        return getHandlePlane(this, this.raycastPlane)
    }

    getColor() {
        return this.isHovered ? this.opts.hoveredColor : this.opts.axisColors[this.opts.axis]
    }

    getCursor() {
        return axisCursor[this.opts.axis]
    }

    setHovered(hovered) {

        this.isHovered = hovered

        const color = this.getColor()

        // @ts-ignore
        this.line.material.color.set(color)
        this.line.material.needsUpdate = true

        this.cone.material.color.set(color)
        this.cone.material.needsUpdate = true

        this.axisHelper.visible = this.isHovered
    }

    /**
     *
     * @param { import('./shared').CPointerEvent } e
     */
    onPointerDown = (e) => {

        this.opts.onDragStart?.()
    }

    _offset = new Vector3()

     /**
     *
     * @param { import('./shared').CPointerEvent } e
     */
    onPointerMove = (e) => {

        const ctx = this.ctx

        this.setHovered(true)

        if(!ctx.dragging) return

        const isLocal = this.ctx.space === "local"

        this._offset.copy(ctx.offset)

        if(isLocal) {

            this._offset.applyQuaternion( ctx.worldQuaternionInv )

        }

        this._offset.multiply(this.opts.direction)

        if(isLocal) {

            this._offset.applyQuaternion(ctx.quaternionStart)
        }

        this._offset.divide(ctx.parentScale)

        ctx.object.position.copy(ctx.positionStart).add(this._offset)

        ctx.object.updateMatrixWorld()

    }

    onPointerUp = () => {

        this.setHovered(false)

        this.opts.onDragEnd?.()
    }

    onPointerOut = () => {

        this.setHovered(false)

    }

    dispose() {

        disposeObject3D(this)
    }
}


