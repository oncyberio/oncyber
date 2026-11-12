// @ts-check

import { Vector3, Raycaster as ThreeRaycaster, Matrix3, Plane, Object3D, Group } from 'three'

import Emitter from '@3emitter'

import Events from '@3events'

import Camera from '@3camera'

import { CANVAS, CURRENT_SPACE, UPLOADER_MODE } from '@3constants'

import { SpaceItem } from '@3factory/abstract/spaceitem'

import AugmentedGroup from '@3abstract/augmentedgroup'

import { EditorEvents, getEmptyDragPreview } from '../utils'
import { disposeObject3D } from '@components/_3DExhibit-v2/three/utils/three'





export class SelectorDragKitbashState extends AugmentedGroup {

    constructor(opts){

        super()

        this.opts = opts

        this.selector = opts.selector

        this.kitbash = CURRENT_SPACE.space.kitbash

        /**
         * @type { import('../utils').EditorDragData }
         */
        this.dragData = null
	}


    _enabled = false

    get enabled() {

        return this._enabled
    }

    set enabled(isEnabled) {

        if(isEnabled === this._enabled) return

        this._enabled = isEnabled

        this.visible = isEnabled

        if(!isEnabled) {

            this.removeEvents()
        }
        else {

            this.addEvents()
        }
    }

    enter({ event: e, data }) {

        console.log("3D drag enter state", e)

        this.enabled = true

        this.dragData = data;

        let blankCanvas = getEmptyDragPreview()

        e.dataTransfer.setDragImage(blankCanvas, 0, 0);

        e.dataTransfer.effectAllowed = "move";
    }

    exit() {

        this.enabled = false
    }

    async addPreview() {

        this.preview = new Object3D()

        this.kitbashElement = await this.kitbash.createComponent(this.dragData.asset)

        if (this.dragData == null) return

        this.kitbashElement.position.copy(this.preview.position)

        this.kitbashElement.quaternion.copy(this.preview.quaternion)

        this.kitbashElement.updateCoords({ isProgress: true })

        this.preview = this.kitbashElement

        if(!this.kitbashElement.isKitBash) {

            this.add(this.kitbashElement)
        }
    }

    /**
     *
     * @param {DragEvent} e
     */
    onDragEnter = (e) => {

        console.log("3D drag onDragEnter", e)

        if(this.dragData == null) return

        e.preventDefault()

        this.lastDragX = e.clientX
        this.lastDragY = e.clientY

        e.dataTransfer.dropEffect = "move"

        this.addPreview()

        this.emit(EditorEvents.DRAG_ENTER, e)
    }

    onDragLeave = (e) => {

        console.log("drag leave", e)

        if(this.dragData == null) return

        e.preventDefault()

        this.dragEvent = null

        this.dragData = null

        if (this.preview) {

            if (this.kitbashElement) {

                if (!this.kitbashElement.isKitBash) {
    
                    this.remove(this.kitbashElement)
                }
        
                this.kitbashElement.dispose()
        
                this.kitbashElement = null
            }
            else {

                this.remove(this.preview)

                disposeObject3D(this.preview)
            }

            this.preview = null
        }

        this.emit(EditorEvents.DRAG_END)
    }


    raycaster = new ThreeRaycaster()

    mousevec = { x: 0, y: 0 }

    hitNormal = new Vector3()



    /**
     * @param { MouseEvent } e
     * @returns { import('three').Intersection & { spaceItem?: SpaceItem } }
     */
    hitTest(e, deltaAngle) {

        const rect = CANVAS.getBoundingClientRect();

        this.mousevec.x =  ((e.clientX - rect.left) / rect.width) * 2 - 1

        this.mousevec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

        this.raycaster.setFromCamera(this.mousevec, Camera.current)

        this.raycaster.ray.direction.applyAxisAngle(Camera.current.up, deltaAngle)

        let hitMeshes = CURRENT_SPACE.space.kitbash.raycastMeshes

        if (UPLOADER_MODE) {
            // @ts-ignore
            const floor = CURRENT_SPACE.space.scene.water || CURRENT_SPACE.space.scene.reflector

            if (floor) {

                hitMeshes = hitMeshes.concat([floor])
            }
        }

        let intersections = this.raycaster.intersectObjects(hitMeshes)

        if(intersections.length) return intersections[0]

        return null
    }


    /**
     * @param { DragEvent } e
     */
    onDragOver = (e) => {

        // console.log("drag over", e)

        e.preventDefault()

        if(this.dragData == null) {

            e.dataTransfer.dropEffect = "none"

            e.dataTransfer.effectAllowed = "none"

            return
        }


        this.dragEvent = e

    }

    tmpNormal = new Vector3()

    tmpMat3 = new Matrix3()

    tmpIntersect = new Vector3()

    _dragPlane = new Plane()

    // planHelper = new PlaneHelper(this._dragPlane, 100, 0xff0000)

    /**
     * @param { DragEvent } e
     */
    doDragOver(e) {

        if(this.dragData == null) return

        // console.log ("do drag over", e)

        let deltaX = e.clientX - this.lastDragX
        let deltaY = e.clientY - this.lastDragY

        this.lastDragX = e.clientX
        this.lastDragY = e.clientY

        let deltaAngle = 0

        if(deltaX >= 0 && deltaY && e.clientX > window.innerWidth - 5) {

            deltaAngle = -1
        }
        else if(deltaX <= 0 && deltaY && e.clientX < 5) {

            deltaAngle = 1

        }

        deltaAngle *= Math.PI / 180

        // Camera.currentControls.rotateAzimuth(deltaAngle)

        let then = performance.now()

        let result = this.hitTest(e, -deltaAngle)

        // console.log("hit test", result)

        this.preview.visible = true

        // this.planHelper.visible = false

        if(result == null) {

            // console.log("no hit")

            this._dragPlane.setFromNormalAndCoplanarPoint(
                this.preview.getWorldDirection(this.tmpNormal),
                this.preview.position
            )


            // test intersection of line from camera with the drag plane
            let hit = this.raycaster.ray.intersectPlane(this._dragPlane, this.tmpIntersect)

            if(hit == null) {
                //
                hit = this.tmpNormal.copy(this.raycaster.ray.direction)
                        .setLength(10)
                        .add(this.raycaster.ray.origin)
            }

            this.preview.position.copy(hit)

            this.preview.updateCoords?.({ isProgress: true })

            return
        }

        // console.log("hit test", result, isModel, spaceItem)



        this.preview.position.copy(result.point)

        this.preview.updateCoords({ isProgress: true })
    }

    /**
     * @param { DragEvent } e
     */
    onDrop = (e) => {

        // console.log("drag/drop")

        if(this.dragData == null || this.kitbashElement == null) return

        if(this.dragEvent) {

            this.onUpdate()
        }

        e.preventDefault()

        // this.dropPlaceholder.visible = false

        const data = this.kitbashElement.data

        const payload = {

            target: this.kitbashElement,

            mime: this.dragData.mime,

            data: {

                kit: data.kit,

                ctype: data.type,

                payload: data
            },

            event: e,
        }

        this.dragData = null

        this.dragEvent = null

        if (!this.kitbashElement.isKitBash) {

            this.remove(this.kitbashElement)
        }

        this.kitbashElement.dispose()

        this.kitbashElement = null

        this.emit(

            EditorEvents.DRAG_END,

            payload
        )
    }

    onUpdate = () => {

        if(this.dragEvent) {

            try {

                this.doDragOver(this.dragEvent)
            }
            finally {

                this.dragEvent = null
            }
        }
    }

    addEvents() {

        Emitter.on(Events.PRE_UPDATE, this.onUpdate)

        CANVAS.addEventListener("dragenter", this.onDragEnter)

        CANVAS.addEventListener("dragleave", this.onDragLeave)

        CANVAS.addEventListener("dragover", this.onDragOver)

        CANVAS.addEventListener("drop", this.onDrop)
    }

    removeEvents() {

        Emitter.off(Events.PRE_UPDATE, this.onUpdate)

        CANVAS.removeEventListener("dragenter", this.onDragEnter)

        CANVAS.removeEventListener("dragleave", this.onDragLeave)

        CANVAS.removeEventListener("dragover", this.onDragOver)

        CANVAS.removeEventListener("drop", this.onDrop)

    }

    dispose() {

        if(this.wasDisposed) return

        this.wasDisposed = true

        this.removeEvents();
    }
}
