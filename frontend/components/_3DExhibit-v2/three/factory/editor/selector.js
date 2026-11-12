// @ts-check

import AugmentedGroup from '../../abstract/augmentedgroup'

import { SelectorObjectState } from './states/objectstate'

import { SelectorDragState } from './states/dragstate'

import Events from '@3events'

import { SelectorDragKitbashState } from './states/dragkitbashstate'

import { DRAG_MIMES } from '@3constants'

import { EditorEvents } from './utils'



/**
 *
 * @typedef {import('@uitypes/Asset').Asset} Asset
 * @typedef {import('@uitypes/experience.js').ArtworkData} ArtworkData
 * @typedef { import('@3constants').EDIT_ACTIONS } EDIT_ACTIONS
 * @typedef {import('@3constants').EDIT_ACTION_TYPE} EDIT_ACTION_TYPE
 * @typedef {import('@gltypes').XYZ} XYZ
 *
 * @typedef { "content" | "kitbash" } SelectionMode
 */




export class Selector extends AugmentedGroup {

    /**
     *
     * @param { import('@gltypes').ItemFactoryOptions } opts
     */
	constructor(opts){

        super()

        this.opts = opts

        if(process.env.NODE_ENV === "development") {

            // @ts-ignore
            window.$$ed = this
        }

        this.objectState = new SelectorObjectState({
            ...opts,
            selector: this
        })

        this.dragState = new SelectorDragState({
            ...opts,
            selector: this
        })

        this.dragKitbashState = new SelectorDragKitbashState({
            ...opts,
            selector: this
        })

        this.states = {

            OBJECT: this.objectState,

            DRAG: this.dragState,

            DRAG_KITBASH: this.dragKitbashState
        }

        for (let key in this.states) {

            this.add( this.states[key] )
        }

        this.currentState = this.objectState
	}

    _enabled = false

    get enabled() {

        return this._enabled
    }

    set enabled(isEnabled) {

        if(isEnabled === this._enabled) return

        this._enabled = isEnabled

        this.visible = isEnabled

        this.currentState.enabled = isEnabled
    }

    get currentState() {

        return this._currentState
    }

    set currentState(state) {

        console.log("selector currentState", state)

        if(this._currentState === state) return

        this._currentState?.exit()

        this._currentState = state
    }

    syncLockState() {

        this. currentState.syncLockState?.()

    }

    get selectedItem() {

        return this.objectState.selectedItem
    }

    setSelection(items) {

        this.objectState.setSelection(items)
    }

    toggleSelection(items, val) {
        // console.log("selector toggleSelection", items, val)
        this.objectState.toggleItems(items, val)
    }

    hideTransforms() {

        this.objectState.hideTransforms?.()
    }

    changeTransformControls(mode) {

        this.objectState.changeTransformControls?.(mode)
    }

    changeTransformMode(mode) {

        this.objectState.changeTransformMode?.(mode)
    }

    handleDragStart(opts) {

        // console.log("3D drag start", opts)

        if(this.currentState !== this.objectState) {

            console.error("invalid state")

            return
        }

        const prevState = this.currentState

        const isKitbash = opts.data.mime === DRAG_MIMES.KITBASH

        this.currentState = isKitbash ? this.dragKitbashState :  this.dragState

        this.currentState.once(

            EditorEvents.DRAG_ENTER,

            () => {

                this.setSelection([])
            }
        )


        this.currentState.once(

            EditorEvents.DRAG_END,

            data => {

                console.log("selector DRAG_END", data)

                this.currentState = prevState

                this.currentState?.enter()

                if (data) {

                    this.emit(

                        Events.EDITOR_DROP,
    
                        data
                    )
                }
            }
        )

        this.currentState.enter(opts)

    }

    handleDragEnd() {

        if(this.currentState === this.objectState) {

            return
        }

        this.currentState.exit()

        this.currentState = this.objectState

        this.currentState.enter()
    }


    dispose() {

        if (this.wasDisposed) return

        this.setSelection([])

        this.wasDisposed = true

        for (let key in this.states) {

            this.states[key].dispose()
        }
    }
}
