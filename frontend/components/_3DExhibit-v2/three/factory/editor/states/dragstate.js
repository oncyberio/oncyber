// @ts-check

import { Vector3, Raycaster as ThreeRaycaster, Matrix3, Object3D, Plane, Box3 } from 'three'

import Emitter from '@3emitter'

import Events from '@3events'

import Camera from '@3camera'

import Raycaster from "@3raycaster"

import { CANVAS, DRAG_MIMES, CURRENT_SPACE } from '@3constants'

import { ModelSpaceArtwork } from '@3artwork/meshes/model/modelspaceartwork'

import { artworkDepth } from '@3utils/spaceutils'

import { getMediaType, MODEL_MEDIA } from '@3utils/mediatype'

import { EditorDragMesh } from './dragmesh'

import PipeLineMesh from '@3abstract/pipelinemesh'

import { SpaceItem } from '@3factory/abstract/spaceitem'

import AugmentedGroup from '@3abstract/augmentedgroup'

import { EditorEvents, getEmptyDragPreview } from '../utils'
import { DropPlaceholder } from './dropplaceholder'
import { isAvatarAsset } from '../../artwork/meshes/model/avatarAnimations'
import { findGroundHit, placeFeetOnGround } from './groundPlacement'




export class SelectorDragState extends AugmentedGroup {

    constructor(opts){

        super()

        this.opts = opts

        this.perfs = {
            dragHitTests: 0,
            dragHitNbs: 0,
        }

        this.selector = opts.selector

        this.dragMesh = new EditorDragMesh(opts)
        this.dragMesh.onPreviewChange = () => {
            this.dragFootOffset = null
            if (this.dragData?.isAvatar && this.groundPoint) this.dragFootOffset = placeFeetOnGround(this.dragMesh, this.groundPoint)
        }

        this.dragMesh.visible = false

        this.add(this.dragMesh)

        this.walls = []

        this.floors = []

        this.otherMeshes = []

        // this.arrowHelper = new ArrowHelper()

        // this.add(this.arrowHelper)

        if(!opts.roomParameters.isFuture)  {

            opts.space.scene.spaceScene.traverse(obj => {

                if(this.isValidDropSceneMesh(obj)) {

                    if(obj.name.toLowerCase().includes("wall")) {

                        this.walls.push(obj)
                    }
                    else if(obj.name.toLowerCase().includes("floor")) {

                        this.floors.push(obj)
                    }
                    else {

                        this.otherMeshes.push(obj)
                    }
                }
            })
        }


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

        console.log("dragstate/state enter", e)

        this.enabled = true

        this.dragData = data;
        this.dragData.isAvatar = isAvatarAsset(data.asset)
        this.groundPoint = null

        this.dragData.is2D = false

        const assum3D = this.dragData.isFileSystem && !this.dragData.mime_type

        if ( !assum3D ) {

            const assetMedia = getMediaType(this.dragData.mime_type)

            this.dragData.is2D = assetMedia !== MODEL_MEDIA
        }

        let blankCanvas = getEmptyDragPreview()

        e.dataTransfer.setDragImage(blankCanvas, 0, 0);

        e.dataTransfer.effectAllowed = "move";

        this.dragMesh.enter(this.dragData)

    }

    exit() {

        console.log("dragstate/state leave")

        this.enabled = false
    }

    /**
     *
     * @param {Object3D} obj
     */
    isValidDropSceneMesh(obj) {

        return obj.visible &&
                // @ts-ignore
                obj.isMesh &&
                obj !== this.opts.space.scene.background
    }


    /**
     *
     * @param {DragEvent} e
     */
    onDragEnter = (e) => {


        console.log("dragstate/drag enter", e)

        this._dragging = true

        if(this.dragData == null) return

        e.preventDefault()

        let preview = this.dragData.previewUrl

        this.lastDragX = e.clientX
        this.lastDragY = e.clientY

        // console.log("preview", preview)

        this.dragMesh.onDragStart(this.dragData)

        e.dataTransfer.dropEffect = "move"

        this.emit(EditorEvents.DRAG_ENTER, e)
    }

    onDragLeave = () => {

        console.log("dragstate/drag leave")

        this._dragging = false

        if(this.dragData == null) return

        this.dragData = null

        this.dragEvent = null

        this.dragMesh.visible = false

        this.dragMesh.onDragLeave()

        this.hightlightDrag(this.dragSpaceItem, false)

        this.dragSpaceItem = null

        this.emit(EditorEvents.DRAG_END)
    }


    get groundSurfaces() {
        return this.opts.roomParameters.isFuture
            ? CURRENT_SPACE.space.kitbash.raycastMeshes
            : [...this.floors, ...this.walls, ...this.otherMeshes]
    }

    findFloorBelow(position) {
        const down = new ThreeRaycaster(position, new Vector3(0, -1, 0))
        return findGroundHit(down.intersectObjects(this.groundSurfaces))
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

        if (this.dragData.isAvatar) {
            const surfaces = this.groundSurfaces
            const hits = this.raycaster.intersectObjects(surfaces)
            const ground = this.raycaster.ray.direction.y < 0 ? findGroundHit(hits) : null
            if (ground) return ground
            // A pointer over a wall still places the character on the floor below.
            if (hits[0]) {
                const down = new ThreeRaycaster(hits[0].point.clone().addScaledVector(this.raycaster.ray.direction, -0.05), new Vector3(0, -1, 0))
                return findGroundHit(down.intersectObjects(surfaces))
            }
            return null
        }

        let dragMime = this.dragData.mime

        let meshes

        let intersections

        if(dragMime === DRAG_MIMES.KITBASH) {

        }
        else {

            if(dragMime === DRAG_MIMES.PORTAL) {
    
                meshes = Raycaster.containerPortals
            }
            else {
    
                meshes = Raycaster.containerArtworks.filter(it => {
    
                    return this.validSpaceItemDropTarget(it.userData.spaceItem) != null
                })
            }
    
            meshes = meshes.concat(Raycaster.containerPlaceholders)
    
            // First try to hit artworks or placeholders
            intersections = this.raycaster.intersectObjects(meshes)
        }

        // Otherwise raycast on the scene
        if(intersections?.length) {

            let r = intersections[0]

            // @ts-ignore
            r.spaceItem = r.object.userData.spaceItem

            return r
        }

        if(this.opts.roomParameters.isFuture) {

            intersections = this.raycaster.intersectObjects(CURRENT_SPACE.space.kitbash.raycastMeshes)
        }
        else {

            // 1- Walls
            intersections = this.raycaster.intersectObjects(this.walls)
    
            if(intersections.length) return intersections[0]
    
    
            // 2- floors
            intersections = this.raycaster.intersectObjects(this.floors)
    
            if(intersections.length) return intersections[0]
    
            // 3- other space meshes
            intersections = this.raycaster.intersectObjects(this.otherMeshes)
        }


        if(intersections.length) return intersections[0]

        return null
    }


    /**
     * @param { DragEvent } e
     */
    onDragOver = (e) => {

        // console.log("dragstate/drag over", e)

        e.preventDefault()

        if(this.dragData == null && !this._dragging) {

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

        // console.log ("dragstate/do drag over", e)

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

        this.perfs.dragHitTests += performance.now() - then

        this.perfs.dragHitNbs++

        // console.log("hit test", result, result?.spaceItem)

        let prevSpaceItem = this.dragSpaceItem

        /** @type { SpaceItem } */
        this.dragSpaceItem = result?.spaceItem

        if(prevSpaceItem != this.dragSpaceItem) {

            this.hightlightDrag(prevSpaceItem, false)

            this.hightlightDrag(this.dragSpaceItem, true)
        }

        if(!this.dragMesh.visible) {

            this.dragMesh.visible = true

            this.dragMesh.position.copy(this.raycaster.ray.direction).setLength(10).add(this.raycaster.ray.origin)

            this.dragMesh.rotation.set(
                0, 
                // round to 90 degrees
                Math.round(Camera.current.rotation.y / (Math.PI / 2)) * (Math.PI / 2), 
                0
            )
            
        }

        let distToPos = this.dragMesh.position.distanceTo(Camera.current.position)

        // if(result) {

        //     if(result.distance > distToPos + 10) {

        //         // console.log("distance to hit too big", distToPos, result.distance, this.dragMesh.position)

        //         result = null

        //     }
        // }

        //

        // this.planHelper.visible = false

        if(result == null) {

            this.groundPoint = null

            // console.log("no hit")

            this._dragPlane.setFromNormalAndCoplanarPoint(
                this.dragMesh.getWorldDirection(this.tmpNormal),
                this.dragMesh.position
            )

            // this.planHelper.visible = true

            // if(!this.planHelper.parent) {

            //     this.add(this.planHelper)
            // }

            // test intersection of line from camera with the drag plane
            let hit = this.raycaster.ray.intersectPlane(this._dragPlane, this.tmpIntersect)

            if(hit == null) {

                this.dragMesh.position
                        .copy(this.raycaster.ray.direction)
                        .multiplyScalar(distToPos)
                        .add(this.raycaster.ray.origin)

                if (this.dragData.is2D) {

                    this.dragMesh.lookAt(Camera.current.position)
                }
            }
            else {

                this.dragMesh.position.copy(hit)
            }


            return
        }

        // console.log("hit test", result, isModel, spaceItem)



        this.dragMesh.position.copy(result.point)

        if (this.dragData.isAvatar) {
            this.groundPoint = result.point.clone()
            this.dragFootOffset = placeFeetOnGround(this.dragMesh, this.groundPoint, this.dragFootOffset)
            return
        }

        if(this.dragData.is2D) {

            if(this.dragSpaceItem != null) {

                this.dragMesh.quaternion.copy(this.dragSpaceItem.quaternion)
            }

            else if(result.face?.normal) {

                this.tmpNormal.copy(result.face.normal).applyNormalMatrix(this.tmpMat3.getNormalMatrix(result.object.matrixWorld)).normalize()

                this.dragMesh.lookAt(this.tmpNormal.add(result.point))

                // this.arrowHelper.position.copy(result.point)

                // this.arrowHelper.setDirection(this.tmpNormal)

            }
            else {

                this.tmpNormal.copy(Camera.current.position).setY(result.point.y).sub(result.point).normalize()

                this.dragMesh.lookAt(this.tmpNormal.add(result.point))
            }

            const depth = artworkDepth(this.opts.roomParameters)

            this.dragMesh.translateZ(depth / 2)
        }
        else {

            let size = this.dragMesh.preview.userData._size

            if (size == null) {

                let box = new Box3()

                box.setFromObject(this.dragMesh.preview)

                size = box.getSize(new Vector3())

                this.dragMesh.preview.userData._size = size
            } 

            // translates the 3D mesh so that the front face is at the hit point
            
            this.dragMesh.translateY(size.y / 2)
        }
    }


    /**
     *
     * @param { SpaceItem } spaceItem
     * @param { boolean } isOver
     */
    hightlightDrag(spaceItem, isOver) {

        spaceItem?.showSelected(isOver)
    }

    /**
     *
     * @param { SpaceItem } spaceItem
     */
    validSpaceItemDropTarget(spaceItem) {

        if(spaceItem == null) return null

        if(!spaceItem.isArtwork && !spaceItem.isPlaceholder) return null

        if(spaceItem instanceof ModelSpaceArtwork) return null

        return spaceItem
    }

    /**
     * @param { DragEvent } e
     */
    onDrop = (e) => {

        // console.log("drag/drop")

        if(this.dragData == null) return

        this.doDragOver(e)

        e.preventDefault()

        // this.dropPlaceholder.visible = false


        const data = {
            // @ts-ignore
            ...this.dragData.asset,
            hasBorder: false,
        }

        const mime = this.dragData.mime

        const permissionless = this.dragData.permissionless;

        /**  */
       

        const target = this.dragSpaceItem

        let drop = new DropPlaceholder({
            position: target?.position ?? this.dragMesh.position,
            quaternion: target?.quaternion ?? this.dragMesh.quaternion,
            preview: this.dragMesh.preview,
            groundPoint: this.dragData.isAvatar ? this.groundPoint : null,
        })

        this.dragData = null

        this.dragMesh.visible = false

        this.dragMesh.onDragEnd()

        this.dragSpaceItem = null

        this.emit(

            EditorEvents.DRAG_END,

            {

                drop,

                target,

                mime,

                data,

                event: e,

                permissionless,

                keepPlaceholder : e.shiftKey && target != null
            }
        )
    }

    onUpdate = () => {

        if(this.dragEvent) {

            try {

                if(this.dragData == null) return

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

        this.remove(this.dragMesh)

        this.dragMesh.dispose()
    }
}
