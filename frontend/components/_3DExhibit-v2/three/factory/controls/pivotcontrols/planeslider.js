// @ts-check

import { Color, DoubleSide, Group, Matrix4, Mesh, MeshBasicMaterial, Plane, PlaneGeometry, Ray, Vector3 } from 'three'

import { disposeObject3D } from '@3utils/three'

import { Line } from './line'

import { getHandlePlane } from './shared'

import { PivotControls } from '.'








/**
 * @typedef { object } ClickInfo
 * @property {Vector3} clickPoint
 * @property {Plane} plane
 */

 export class PlaneSlider extends Group {

    constructor(opts) {

        super()

        this.opts = opts

        /** @type { Vector3 } */
        this.normal = this.opts.normal

        /** @type { PivotControls } */
        this.ctx = this.opts.ctx

        this.raycastPlane = new Plane()

        const pos1 = 1 / 7
        const length = 0.225

        // Used for raycast
        this.raycastMesh = new Mesh(
            new PlaneGeometry(),
            new MeshBasicMaterial({
                transparent: true,
                color: this.getColor(),
                depthTest: false,
                side: DoubleSide,
                polygonOffset: true,
                polygonOffsetFactor: -10,
            })
        )

        this.raycastMesh.userData = { handle: this }

        this.raycastMesh.scale.set(length, length, length)

        // this.planeHelper = new Mesh(
        //     new PlaneGeometry(1, 1),
        //     new MeshBasicMaterial({
        //         color: 0xff0000,
        //         transparent: true,
        //         opacity: 0.5,
        //         side: DoubleSide,
        //         depthTest: false,
        //         // wireframe: true
        //         // polygonOffset: true,
        //         // polygonOffsetFactor: -2.0,
        //         // polygonOffsetUnits: -8.0,
        //     })
        // )
        this.planeHelper = new PlaneHelper({
            size: 100, lineWidth: opts.lineWidth / 4,
            color: opts.lineHelperColor,
        })
        this.planeHelper.matrixAutoUpdate = false
        this.planeHelper.visible = false

        this.dirx = opts.dir1.clone().normalize()
        this.diry = opts.dir2.clone().normalize()
        this.dirz = new Vector3()

        this.root = new Group()
        this.root.matrixAutoUpdate = false


        this.gizmo = new Group()
        this.gizmo.position.set(pos1 * 1.7, pos1 * 1.7, 0)
        this.gizmo.add(this.raycastMesh)

        this.root.add(this.gizmo)
        this.root.add(this.planeHelper)
        this.add(this.root)



        this.isHovered = false

        this.angle = 0

        this.angle0 = 0

        /** @type { ClickInfo } */
        this.clickInfo = null

    }

    getRaycastPlane() {

        return getHandlePlane(this, this.raycastPlane)

    }

    updateMatrixWorld(force) {

        this.ctx.turnAxisToEye(this.dirx)
        this.ctx.turnAxisToEye(this.diry)

        this.dirz.crossVectors(this.dirx, this.diry)

        if(this.ctx.space === "world") {

            this.quaternion.copy(this.ctx.worldQuaternionInv)
        }
        else {

            this.quaternion.identity()
        }

        this.root.matrix.makeBasis(this.dirx, this.diry, this.dirz)


        super.updateMatrixWorld(force)
    }


    getColor() {
        return this.isHovered ? this.opts.hoveredColor : this.opts.axisColors[this.opts.axis]
    }

    getCursor() {
        return "move"
    }

    setHovered(hovered) {

        this.isHovered = hovered

        const color = this.getColor()

        this.raycastMesh.material.color.set(color)

        this.planeHelper.visible = this.isHovered
    }


    /**
     *
     * @param { import('./shared').CPointerEvent } e
     */
    onPointerDown = (e) => {

        // const clickPoint = e.intersect.clone()

        // const origin = new Vector3().setFromMatrixPosition(this.matrixWorld)

        // const normal = new Vector3().setFromMatrixColumn(this.matrixWorld, 2).normalize()

        // const plane = this._plane.setFromNormalAndCoplanarPoint(normal, origin)

        // this.clickInfo = { clickPoint, plane }

        // this.opts.onDragStart?.()

        this.updateHelpers()

    }

    phMatrix = new Matrix4()

    updateHelpers() {

        //this.planeHelper.matrix.copy(this.matrixWorld)

        this.planeHelper.visible = true
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

        this._offset
            .copy(ctx.offset)
            .divide(ctx.parentScale)

        ctx.object.position.copy(ctx.positionStart).add(this._offset)
    }

    onPointerUp = () => {

        this.angle0 = this.angle

        this.clickInfo = null

        this.planeHelper.visible = false

        this.opts.onDragEnd?.()
    }


    onPointerOut = () => {

        this.setHovered(false)

    }

    dispose() {

        disposeObject3D(this)
    }
}


class PlaneHelper extends Group {

	constructor( { lineWidth, size = 1, color } ) {

        super()

        this.size = size;

        this.root = new Group()
        this.root.scale.set(size * 0.5, size * 0.5, 1)
        this.add(this.root)

        this.vertLine = new Line(
            [
                new Vector3(0,-1,0),
                new Vector3(0, 1, 0)
            ],
            {
                color,
                linewidth: lineWidth,

            }
        )

		this.root.add(this.vertLine)


        this.horzLine = new Line(
            [
                new Vector3(-1,0,0),
                new Vector3(1,0, 0)
            ],
            {
                color,
                linewidth: lineWidth,

            }
        )
		this.root.add(this.horzLine)



		// const positions = [ 1, 1, 0, - 1, 1, 0, - 1, - 1, 0, 1, 1, 0, - 1, - 1, 0, 1, - 1, 0 ];

		// const geometry = new BufferGeometry();
		// geometry.setAttribute( 'position', new Float32BufferAttribute( positions, 3 ) );
		// geometry.computeBoundingSphere();

        // this.planeMesh = new Mesh(
        //     geometry,
        //     new MeshBasicMaterial({
        //         color: color,
        //         opacity: 0.5,
        //         side: DoubleSide,
        //         transparent: true,
        //         depthWrite: false,
        //         toneMapped: false
        //     } ) )

		// this.root.add( this.planeMesh );
	}
}
