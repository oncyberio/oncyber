// @ts-check


import Events from '@3events'

import Camera from '@3camera'

import AugmentedGroup from '@3abstract/augmentedgroup.js'

import { CAMERA_LAYERS, SET_SHADOW_NEEDS_UPDATE } from '@3constants'

import { disposeObject3D, getSelectionHandle } from '@3utils/three'

import { Color, Matrix4, Object3D } from 'three'

import Scene from '@3scene'

//
const EVENTS = {

    MATRIX_CHANGED: '@@SpaceComponent/matrix_changed',

    SELECTION_STATE_CHANGED: '@@SpaceComponent/selection_state_changed',

    COLLISON_CHANGED: '@@SpaceComponent/collision_changed',

    PREF_TRANSFORM_CONTROL_CHANGED: '@@SpaceComponent/pref_transform_control_changed',

    DISPOSED: '@@SpaceComponent/disposed',
}

export class SpaceComponent extends AugmentedGroup {

    constructor(opts){

		super()

        this.EVENTS = EVENTS

        this.isPlaceholder = false

        this.isArtwork = false

        this.isPortal = false

        this.isKitBash = false

        this.isComponent3D = false

        this.isLabel = false

        this.setRaycastMesh(opts.raycastMesh)

        this.raycastOptions = {

            notifyOnlyIfChanged: true
        }

        this.callbackOptions = {

            type   : Events.RAYCAST,

            value: {

                active : false,

                mesh   : this,
            }
        }

        this.isScriptInteracting = false

        /** @type { import('@3constants').EDIT_TRANSFORM_CONTROL } */
        this._prefTransformControl = null
	}

    setCollisionMesh(mesh) {

        this.collisionMesh = mesh

        if (mesh) {

            this.collisionMesh.userData.component = this
        }
    }

    setRaycastMesh(mesh) {

        this.raycastMesh = mesh

        if (mesh) {

            this.raycastMesh.userData.spaceItem = this
        }
    }

    maxLookatDistance() {

        return Infinity
    }

    get isVisibleToCamera() {


        // This thing doesn't work in some destinations like Brute
        // cf https://linear.app/oncyber/issue/PROD-514/videos-freeze-when-user-approaches
        // The renderer can call istself recursively during rendering and uses a currentRenerStack
        // to maintain the currentRenderList, at the end of `render()` the currentRenderList isn't guaranteed
        // to be the one containing the main scene and the artworks. In case of the above issue, the
        // currentRenderList was from the water object.
        // For now we'll revert to the frustum test until we figure out the solution to this

        // return this.isVisible(this.raycastMesh)

        return this.raycastMesh != null && Camera.isObjectVisible(this.raycastMesh)
    }


    /***
     * @param { import('@gltypes').RaycastEvent } e
     */
	raycastCallBack(e){

        // this.callbackOptions.value.active = e.active

        // Emitter.emit(Events.CUSTOM, this.callbackOptions )

	}

    _active = true

    get active() {

        return this._active
    }

    set active(v) {

        if(this._active == v) return

        this._active = v

        if(!v) {

            this._rcmask = this.raycastMesh.layers.mask

            this.raycastMesh.layers.mask = 0
        }
        else {

            this.raycastMesh.layers.mask = this._rcmask
        }
    }

    _locked = {}

    lock(locks) {

        Object.keys(locks).forEach(key => {
            //
            const val = locks[key]

            if(val?.value) {

                this._locked[key] = val
            }
            else {

                delete this._locked[key]
            }
        })
    }

    isLocked(key) {

        return this._locked[key]?.value
    }

    get isTransformLocked() {

        return this.isLocked('transform')
    }

    set transformLocked(v) {

        this.lock({ transform: v })
    }

    _prevMatrix = new Matrix4()

    updateMatrixWorld(force) {

        super.updateMatrixWorld(force)

        if (this.matrixWorld.equals(this._prevMatrix) === false) {

            this._prevMatrix.copy(this.matrixWorld)

            this.emit(EVENTS.MATRIX_CHANGED, this)

            if( !this.isModelSpaceArtwork && !this.isScriptInteracting ) {

                SET_SHADOW_NEEDS_UPDATE(true)

            }

            // console.log('matrix changed', this)
        }

        if (this.selectionBox && !Camera.isEditing) {

            this.selectionBox.visible = false
        }
    }

    _hasMatrixListeners = false

    onMatrixChanged(cb) {

        this.on(EVENTS.MATRIX_CHANGED, cb)

        this._hasMatrixListeners = true
    }

    offMatrixChanged(cb) {

        this.off(EVENTS.MATRIX_CHANGED, cb)

        this._hasMatrixListeners = this.hasListeners(EVENTS.MATRIX_CHANGED)
    }


    setSelected(isSelected) {

        if(this.isSelected === isSelected) return

        this.isSelected = isSelected

        this.emit(EVENTS.SELECTION_STATE_CHANGED, { isSelected })
    }

    onSelect(cb) {

        this.on(EVENTS.SELECTION_STATE_CHANGED, cb)
    }

    offSelect(cb) {

        this.off(EVENTS.SELECTION_STATE_CHANGED, cb)
    }

    /**
     *
     * @param { boolean } isSelected
     */
    showSelected(isSelected) {

        if (this.prefTransformControls == null) return

        if(this.selectionBox == null) {

            this.selectionBox = getSelectionHandle(
                this.raycastMesh,
                new Color("#0466c8")
            );

            this.selectionBox.name = "selectionBox"

            this.selectionBox.scale.copy(this.raycastMesh.scale)

            this.selectionBox.layers.set( CAMERA_LAYERS.SITTING_ZONE)

            this.add(this.selectionBox)
        }

        this.selectionBox.visible = isSelected
    }

   
    get prefTransformControls() {

        return this._prefTransformControl
    }

    set prefTransformControls(value) {

        if(this._prefTransformControl === value) return

        this._prefTransformControl = value

        this.emit(EVENTS.PREF_TRANSFORM_CONTROL_CHANGED, { value })
    }
}
