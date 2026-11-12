
// @ts-check

import { BoxGeometry, Group, MeshBasicMaterial, Plane, Vector3 } from 'three'
import { PivotControls } from '.'
import { SnapBox } from '../snapbox'
import PipeLineMesh from '@components/_3DExhibit-v2/three/abstract/pipelinemesh'
import { disposeObject3D } from '@components/_3DExhibit-v2/three/utils/three'


const tmpNormal = new Vector3()


export class BoxSlider extends Group {


    constructor(opts) {

        super()

        this.opts = opts

        /** @type { PivotControls } */
        this.ctx = this.opts.ctx

        this.snapBox = new SnapBox()

        this.isHovered = false

        this.geometry = new BoxGeometry(1, 1, 1)

        this.raycastMesh = new PipeLineMesh(
            this.geometry,
            new MeshBasicMaterial({ transparent: true, opacity: 0.1, color: 0x0466c8, depthTest: false }),
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

        this.eyePlane = new Plane()

        this.raycastMesh.name = "boxSlider"

        this.raycastMesh.userData.handle = this

        this.add(this.raycastMesh)

        this.enabled = false

        this.visible = false

        /** @type { { clickPoint: Vector3, dir: Vector3  } } */
        this.clickInfo = null
    }

    setObject(object) {

        let mesh = object?.raycastMesh

        if (mesh == null) {

            this.enabled = false

            this.visible = false

            return
        }

        this.raycastMesh.geometry.dispose()

        if (mesh.geometry instanceof BoxGeometry) {

            this.raycastMesh.geometry = mesh.geometry    
        }
        else {

            if(mesh.geometry.boundingBox == null) {

                mesh.geometry.computeBoundingBox()
            }
        
            const box = mesh.geometry.boundingBox;

            const boxGeo = new BoxGeometry(
                box.max.x - box.min.x,
                box.max.y - box.min.y,
                box.max.z - box.min.z
            );
        
            boxGeo.translate(
                (box.max.x + box.min.x) / 2,
                (box.max.y + box.min.y) / 2,
                (box.max.z + box.min.z) / 2
            );

            this.raycastMesh.geometry = boxGeo
        }

        this.raycastMesh.position.copy(mesh.position)

        this.raycastMesh.quaternion.copy(mesh.quaternion)

        this.raycastMesh.scale.copy(mesh.scale)
        
        this.enabled = true

        this.visible = true

        this.syncCoords()

        this.snapBox.setCurrentObject(object)
    }

    syncCoords = () => {

        this.position.copy(this.ctx.object.position)

        this.quaternion.copy(this.ctx.object.quaternion)

        this.scale.copy(this.ctx.object.scale)
    }

    setHovered(isHovered) {

        this.isHovered = isHovered

        // this.raycastMesh.material.visible = isHovered
    }

    updateMatrixWorld (force) {

        if (!this.enabled) return

        this.syncCoords()

        super.updateMatrixWorld(force)
    }

    getRaycastPlane() {

        tmpNormal.copy(this.ctx.eye)

        this.eyePlane.setFromNormalAndCoplanarPoint(tmpNormal, this.ctx.worldPosition)

        return this.eyePlane
    }

    getColor() {
        return this.isHovered ? this.opts.hoveredColor : this.opts.axisColors[this.opts.axis]
    }

    getCursor() {
        return "move"
    }

    /**
     *
     * @param { import('./shared').CPointerEvent } e
     */
    onPointerDown = (e) => {

        if (!this.enabled) return

        console.log("box Slider down", e.raw)

        this.opts.onDragStart?.()

        this.snapBox.onMouseDown(e.raw)
    }

    _offset = new Vector3()

     /**
     *
     * @param { import('./shared').CPointerEvent } e
     */
    onPointerMove = (e) => {

        if (!this.enabled) return

        const ctx = this.ctx

        this.setHovered(true)

        // console.log("box Slider hovered", e.raw, ctx.dragging)

        if(!ctx.dragging) return

        // @ts-ignore
        this.snapBox.onMouseMove(e.raw)

    }

    onPointerUp = () => {

        if (!this.enabled) return

        this.setHovered(false)

        this.opts.onDragEnd?.()
    }

    onPointerOut = () => {

        if (!this.enabled) return

        this.setHovered(false)
    }

    dispose() {

        disposeObject3D(this)
    }
}


