// @ts-check

import { Vector3, Matrix3, Plane, BoxGeometry } from 'three'

import Emitter from '@3emitter'

import Events from '@3events'

import Camera from '@3camera'

import Raycaster from "@3raycaster"

import { CANVAS, EDITION_TYPES, IS_MOBILE, AUDIO_TYPES, IS_MAC } from '@3constants'

import { SpaceArtwork } from '@3artwork/abstract'

import { SpacePlaceholder } from '@3artwork/placeholders/spaceplaceholder'

import { PivotControls } from "@3factory/controls/pivotcontrols"

import { SnapTransformControls } from '@3artwork/artworkcontainer/transformcontrols/SnapTransformControls'

import { TYPES } from '@3artwork/constants'

import { Portal } from '@3factory/portal/portal'

import { Component3D } from '@3factory/space/kits/abstract'

import { TextSpaceArtwork } from '../../artwork/meshes/text/textspaceartwork'

import { SpaceComponent } from '@3factory/abstract/spacecomponent'

import AugmentedGroup from '@3abstract/augmentedgroup'
import { MODEL_MEDIA } from '@components/_3DExhibit-v2/three/utils/mediatype'

import { removeItem } from '@utils/js'

import { MultiSelectMesh } from './multiselectmesh'

import { toXYZ } from '@components/_3DExhibit-v2/three/utils/three'
import raycaster from '@3raycaster'




function createSelectionBox() {

    const selBox = document.createElement("div")

    selBox.style.position = "fixed"
    selBox.style.border = "1px solid #0466c8"
    selBox.style.background = "#0466c8"
    selBox.style.opacity = "0.5"
    selBox.style.pointerEvents = "none"
    selBox.style.zIndex = "10000"
    selBox.style.display = "none"

    document.body.appendChild(selBox)

    return selBox
}




export class SelectorObjectState extends AugmentedGroup {

    constructor(opts){

        super()

        this.opts = opts

        this.selector = opts.selector

        /** @type { SpaceComponent[] } */
        this.selectedItems = []

        /** @type { SpaceComponent } */
        this.selectedItem = null

        this.selectedTransformObject = null

        this.snapControls = new SnapTransformControls(
            Camera.current,
            CANVAS,
            opts.space.artworkContainer,
            opts.roomParameters
        )

        this.add(this.snapControls)

        const rect = CANVAS.getBoundingClientRect()

        this.transformControls = new PivotControls({
            camera: Camera.current,
            domElement: CANVAS,
            size: {
                with: rect.width,
                heigt: rect.height
            }
        });

        this.transformControls.setRotationSnap(5 * Math.PI / 180)

        this.transformControls.rotationSnap = Math.PI / 36

        this.add(this.transformControls)

        this.multiSelectMesh = new MultiSelectMesh()

        this.add(this.multiSelectMesh)

        this.selectionBox = createSelectionBox()

        // this.transformControls.enabled = false
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

    enter() {

        this.enabled = true
    }

    exit() {

        this.enabled = false
    }

    showTransforms () {

        // console.log("select", object)

        if(this.selectedItems.length === 0) return;

        let show = false

        this.selectedItems.forEach(item => {
            //
            show = show || (item?.prefTransformControls != null)
        })

        if(!show) return;

        if (this.selectedItems.length > 1) {

            this.multiSelectMesh.setAttachedObjects(this.selectedItems)

            this.transformControls.attach(this.multiSelectMesh)
        }
        else {

            const object = this.selectedItems[0]

            const controls = object.prefTransformControls

            // @ts-ignore
            if (
                // !(object instanceof SpaceArtwork) || 
                // object.mediaType === TYPES.MODEL || 
                // object.mediaType ===  TYPES.TRIGGER_ZONE ||
                // (object.mediaType === TYPES.AUDIO && object.raycastMesh.geometry instanceof BoxGeometry) ||
                // (object instanceof Component3D && object.isPlaceholder)
                controls == EDITION_TYPES.TRANSFORM_3D || 
                (!object.isComponent3D && this.mode === EDITION_TYPES.TRANSFORM_3D)
            ) {

                // @ts-ignore
                const snap3D = object.isKitBash || object.mediaType === TYPES.MODEL

                this.transformControls.attach(object, { snap3D })
            }
            else if (controls == EDITION_TYPES.TRANSFORM_SNAP) {

                this.snapControls.attach(object)
            }

            if (controls != null) {

                const changeHandler = (event) => {

                    this.changeTransformControls()
                }

                object.on(
                    object.EVENTS.PREF_TRANSFORM_CONTROL_CHANGED,
                    changeHandler
                )

                this._offChangeTransformControls = () => {

                    object.off(
                        object.EVENTS.PREF_TRANSFORM_CONTROL_CHANGED,
                        changeHandler
                    )

                    this._offChangeTransformControls = null
                }
            }
        }

        this.syncLockState()
    }


    hideTransforms () {

        this._offChangeTransformControls?.()

        this.multiSelectMesh.setAttachedObjects([])

        this.transformControls.detach()

        this.snapControls.detach()

        // reset snap control's axis
        this.snapControls.axis = "XY";

        this.cursorHandler();
    }

    changeTransformMode(mode) {

        switch (mode) {

            case EDITION_TYPES.POSITION:
                this.transformControls.setMode("translate")
                break

            case EDITION_TYPES.ROTATION:

                this.transformControls.setMode("rotate")
                break

            case EDITION_TYPES.SCALE:
                this.transformControls.setMode("scale")
                break
        }
    }

    /**
      *
      * @param {import('@3constants').EDIT_TRANSFORM_CONTROL} [mode]
      * */
    changeTransformControls = (mode) => {

        if (mode) {

            this.mode = mode
        }

        if(this.selectedItem == null || this.selectedItem.isPlaceholder) return

        const prefMode = this.selectedItem.prefTransformControls

        if (prefMode == null) {

            this.transformControls.detach()

            this.snapControls.detach()

            // reset snap control's axis
            this.snapControls.axis = "XY";

            this.cursorHandler();

            return
        }

        mode ??= prefMode

        if(mode === EDITION_TYPES.TRANSFORM_SNAP) {

            const canUseSnap = prefMode === EDITION_TYPES.TRANSFORM_SNAP

            if(canUseSnap) {

                this.transformControls.detach()

                this.snapControls.attach(this.selectedItem)

                this.syncLockState()

                return true

            }
        }
        else if(mode === EDITION_TYPES.TRANSFORM_3D) {

            this.snapControls.detach()

            this.transformControls.attach(this.selectedItem)

            this.syncLockState()

            return true
        }
    }

    syncLockState() {

        const isLocked = this.selectedItems.some(item => item.isTransformLocked)

        this.snapControls.locked = isLocked

        this.transformControls.locked = isLocked

    }

    cursorHandler(e) {

        if (this.isDragSelecting) {

            CANVAS.style.cursor = "crosshair"

            return;
        }

        if(e?.isDragging) return;

        let cursor = this.snapControls.getCursor() || this.transformControls.getCursor?.()

        if(cursor === "not-allowed") {

            cursor = 'url("/images/lock.png"), not-allowed'
        }

        // @ts-ignore
        if (cursor == null) {

            cursor = "pointer";
        }

        if(cursor != null) {

            CANVAS.style.cursor = cursor
        }
        else {
            CANVAS.style.cursor = "grab"
        }
    }

    updateControlsState() {

        Camera.currentControls?.setPointerLocked(this.isTransformControlLocked || this.isDragSelecting)
    }


    _dragSelectState = { 
        rect: null,
        raw: { x0 : 0, y0 : 0, x1: 0, y1: 0 },
        items: []
    }

    onMouseDown = (e) => {

        if (this.isTransformControlLocked) {

            return
        }

        this.isDragSelecting = IS_MAC ? e.raw.metaKey : e.raw.ctrlKey
        
        if (this.isDragSelecting) {

            const rect = this._dragSelectState.rect = CANVAS.getBoundingClientRect()

            const { raw } = this._dragSelectState
            
            raw.x0 = e.raw.x - rect.left + CANVAS.scrollLeft
            raw.y0 = e.raw.y - rect.top + CANVAS.scrollTop
            raw.x1 = raw.x0
            raw.y1 = raw.y0

            // console.log("edit/mouse down", this._dragSelectState)
    
            this.updateControlsState()
        }
        else {

            /**
             * This hack is because of timing issues, Raycaster won't be updated
             * until next update event (so even raycastCallback + mouseDown won't work)
             */
            if(IS_MOBILE) {

                Raycaster.mouseDown(e)

                Raycaster.update()

                this.updateHoverItem()
            }
        }

        this.cursorHandler(e)
        
    }

    onMouseUp = (e) => {

        if (this.isDragSelecting) {

            this.isDragSelecting = false

            this.selectionBox.style.display = "none"

            this.updateControlsState()

            this.toggleItems(this._dragSelectState.items, true)

            this._dragSelectState.items = []
        }
    }

    onMouseMove = (e) => {

        if ( this.isTransformControlLocked || IS_MOBILE) {

            return
        }

        if (this.isDragSelecting) {
            //
            const { raw, norm, rect } = this._dragSelectState

            raw.x1 = e.raw.x - rect.left + CANVAS.scrollLeft
            raw.y1 = e.raw.y - rect.top + CANVAS.scrollTop

            // console.log("edit/mouse move", this._dragSelectState)

            this.updateSelectionBox(e)
        }
        else {

            this.updateHoverItem()
        }


        // console.log("edit/mouse overrrrrrrr", current)
        this.cursorHandler(e)
    }

    updateHoverItem() {

        const current = Raycaster.currentSpaceItem

        this.hoveredItem = null

        if(current) {

            if(current.isArtwork || current.isPortal || current.isComponent3D || current.isPlaceholder) {

                this.hoveredItem = current
            }
        }

    }

    updateSelectionBox(e) {

        const { raw, norm, rect, items } = this._dragSelectState

        const { x0, y0, x1, y1 } = raw
        
        let left = Math.min(x0, x1);
        let top = Math.min(y0, y1);
        let right = Math.max(x0, x1);
        let bottom = Math.max(y0, y1);

        const width = right - left;
        const height = bottom - top;

        this.selectionBox.style.display = "block"
        this.selectionBox.style.left = left + "px"
        this.selectionBox.style.top = top + "px"
        this.selectionBox.style.width = width + "px"
        this.selectionBox.style.height = height + "px"

        if(width < 1 || height < 1) return;

        const newItems = raycaster.intersectScreenRect({ left, top, width, height }, rect)

        items.forEach(item => {
            //
            item.showSelected(false)
        })

        newItems.forEach(item => {
            //
            item.showSelected(true)
        })

        this._dragSelectState.items = newItems
    }

    onClick = (e) => {

        // console.log("edit/mouse click", e.raw)

        const isCmd = IS_MAC ? e.raw.metaKey : e.raw.ctrlKey

        if (this.isTransformControlLocked || e.raw.button !== 0 || isCmd) {

            return
        }

        this.handleSelect( this.hoveredItem, e.raw.shiftKey )
        
        this.cursorHandler(e)
    }


    handleSelect = (item, isMulti) => {

        let selectedItems;

        // @ts-ignore
        if(item?.loading) return

        if (isMulti) {

            if (item == null || item.isPlaceholder || this.selectedItem?.isPlaceholder) {

                return;
            }

            if (item.isSelected) {

                selectedItems = this.selectedItems.filter(it => it !== item)
            }
            else {

                selectedItems =  this.selectedItems.concat([item])
            }
        }
        else {

            selectedItems = item !== null ? [item] : []
        }

        this.setSelection(selectedItems)
        
    }

    /**
     * @param { SpaceComponent } item
     * @param { boolean } [val]
     **/
    toggleSelection(item, val) {

        if(item == null) return;

        item.setSelected(val)

        item.showSelected(val)
    }

    onDblClick = (e) => {

        // console.log("edit/mouse dbl click", this.selectedItem)

        this.focus()
    }

    focus = (e) => {

        if(
            this.selectedItem == null ||
            (this.transformControls.object == null && this.snapControls.object == null) ||
            this.selectedItem?.raycastMesh == null
        ) return;

        const frontDir = 
        // @ts-ignore
            (this.selectedItem.isArtwork && this.selectedItem.mediaType !== MODEL_MEDIA) || 
            this.selectedItem.isPortal
        

        // @ts-ignore
        Camera.focusOn({ target: this.selectedItem.raycastMesh, frontDir })
    }

    /**
     *
     * @param { KeyboardEvent } event
     */
    onKeyDown = (event) => {

        // console.log("edit/keydown", event)

        if (event.repeat) return

        if (event.key === "x" || event.key === "X") {

            this.snapControls.axis = "X"

            // console.log("snap axis", this.snapControls.axis)
        }
        else if (event.key === "y" || event.key === "Y") {

            this.snapControls.axis = "Y"
        }
        else if (event.shiftKey && this.transformControls.object != null) {

            // this.transformControls.setTranslationSnap(SNAP_SIZE);

            // this.transformControls.setScaleSnap(SNAP_SIZE);

        }
        else if(event.key === "f" || event.key === "F") {

            this.focus()
        }

        this.cursorHandler(event)
    }

    /**
     * @param { KeyboardEvent } e
     */
     onKeyUp = (e) => {


    }

    setSelection(selectedItems = []) {
        //
        this.hideTransforms()
        
        const prev = this.selectedItems

        prev.forEach(item => {

            this.toggleSelection(item, false)
        })

        this.selectedItems = selectedItems

        this.selectedItems.forEach(item => {
                
            this.toggleSelection(item, true)
        })


        this.showTransforms()

        this.selectedItem = this.selectedItems.length == 1 ? this.selectedItems[0] : null

        const hasChanged = 
            prev.length !== this.selectedItems.length || 
            prev.some((item, index) => item !== this.selectedItems[index])

        if (hasChanged) {

            Promise.resolve().then(() => {

                Emitter.emit(Events.CUSTOM, {
    
                    type: Events.SELECTED_ARTWORK_CHANGED,
    
                    value: {
    
                        selectedItems: this.selectedItems,
                    }
                })
            })
        }
    }

    toggleItems(items, val) {

        if (items == null) return

        let selectedItems = new Set(this.selectedItems)

        items.forEach(item => {

            const state = val ?? !item.isSelected

            if(state) {

                selectedItems.add(item)
            }
            else {

                selectedItems.delete(item)
            }
        })

        this.setSelection(Array.from(selectedItems))
    }



    tmpNormal = new Vector3()

    tmpMat3 = new Matrix3()

    tmpIntersect = new Vector3()

    _dragPlane = new Plane()



    onUpdate = () => {

        if(Camera.current !== this.snapControls.camera) {

            this.snapControls.camera = Camera.current
        }

        if(Camera.current !== this.transformControls.camera) {

            this.transformControls.camera = Camera.current
        }
    }

    $$startCoords = null

    onTransformDraggingChanged = (event) => {

        // console.log("dragging-changed", event.value)

        this.isTransformControlLocked = !!event.value

        Camera.currentControls?.setPointerLocked(this.isTransformControlLocked)

        if(this.selectedItems.length > 1) return;

        if (!event.value) {

            // reset snap control's axis
            this.snapControls.axis = "XY"

            if(!this.selectedItem.isComponent3D) {

                let event = {

                    type: Events.ARTWORK_COORDS_CHANGED,

                    value: {

                        payload: {
                            targetMesh: this.selectedItem,

                            coords : {
                                position: toXYZ(this.selectedItem.position),
                                rotation: toXYZ(this.selectedItem.rotation),
                                scale: toXYZ(this.selectedItem.scale)                            
                            },

                            undo: this.$$startCoords,
                        },
                        
                        source: this.mode
                    }
                }

                this.$$startCoords = null

                Emitter.emit(Events.CUSTOM, event)

            }


            if(this.selectedItem instanceof TextSpaceArtwork && this.snapControls.object && this.snapControls.scaleMode === "FontWidth") {

                let event = {

                    type: Events.TEXT_ARTWORK_FONT_WIDTH_CHANGED,

                    value: {

                        artwork: this.selectedItem,

                        payload: {
                            id: this.selectedItem.userData.id,
                            width: this.selectedItem.font.options.width
                        }
                    }
                }

                Emitter.emit(Events.CUSTOM, event)
            }

        }
        else {
            //
            this.$$startCoords = {
                position: toXYZ(this.selectedItem.position),
                rotation: toXYZ(this.selectedItem.rotation),
                scale: toXYZ(this.selectedItem.scale)
            }
        }
    }


    addEvents() {

        Emitter.on( Events.MOUSE_DOWN, this.onMouseDown )

        Emitter.on( Events.MOUSE_MOVE, this.onMouseMove )

        Emitter.on( Events.MOUSE_UP, this.onMouseUp )

        Emitter.on( Events.CLICK, this.onClick )

        Emitter.on( Events.DBL_CLICK, this.onDblClick )

        Emitter.on(Events.KEY_DOWN, this.onKeyDown)

        Emitter.on(Events.KEY_UP, this.onKeyUp)

        Emitter.on(Events.PRE_UPDATE, this.onUpdate)


        this.transformControls.addEventListener(
            "dragging-changed",
            this.onTransformDraggingChanged
        )

        this.snapControls.addEventListener(
            "dragging-changed",
            this.onTransformDraggingChanged
        )

        this.snapControls.enabled = true

    }

    removeEvents() {

        Emitter.off( Events.MOUSE_DOWN, this.onMouseDown )

        Emitter.off( Events.MOUSE_MOVE, this.onMouseMove )

        Emitter.off( Events.MOUSE_UP, this.onMouseUp )


        Emitter.off( Events.CLICK, this.onClick )

        Emitter.off( Events.DBL_CLICK, this.onDblClick )

        Emitter.off(Events.KEY_DOWN, this.onKeyDown)

        Emitter.off(Events.KEY_UP, this.onKeyUp)

        Emitter.off(Events.PRE_UPDATE, this.onUpdate)


        this.transformControls.removeEventListener(
            "dragging-changed",
            this.onTransformDraggingChanged
        )

        this.snapControls.removeEventListener(
            "dragging-changed",
            this.onTransformDraggingChanged
        )

        this.snapControls.enabled = false
    }

    dispose() {

        if (this.wasDisposed) return

        this.wasDisposed = true

        this.removeEvents();

        this.remove(this.snapControls)

        this.remove(this.transformControls)

        this.transformControls.dispose()

        this.snapControls.dispose()
    }
}
