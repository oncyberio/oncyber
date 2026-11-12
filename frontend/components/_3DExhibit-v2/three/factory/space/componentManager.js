// @ts-check




import { APP_STATES } from '@3constants'

import Camera from '@3camera'

import Emitter from '@3emitter'

import Events from '@3events'

import { CyberKitWrapper } from './kits/cyber/cyberkitwrapper'

import { Component3D } from './kits/abstract'

import { KitbashWrapper } from './kits/kitbash/kitbashwrapper'





export default class ComponentManager {

    constructor( opts = {} ) {

		this.opts = opts

		this.data = opts.data

        this.collisions = opts.kitbashWrapper.collisions

        this.raycastMeshes = opts.kitbashWrapper.raycastMeshes

        const kitOpts = {
            ... opts,
            collisions: this.collisions,
            raycastMeshes: this.raycastMeshes,
        }

        /** @type { KitbashWrapper } */
        this.kitbashWrapper = opts.kitbashWrapper

        this.cyberkitWrapper = new CyberKitWrapper(kitOpts)

        opts.space.scene.add(this.cyberkitWrapper)

        this._isEditMode = undefined
	}

    get isEditMode() {

        return this._isEditMode
    }

    set isEditMode(isEditMode) {

        if(isEditMode === this._isEditMode) return

        this._isEditMode = isEditMode

        this.cyberkitWrapper.isEditMode = isEditMode
    }

    getDefaultData() {

        const kitbashData = this.kitbashWrapper.getDefaultData()

        const componentData = this.cyberkitWrapper.getDefaultData()

        return structuredClone({
            ... componentData,
            ... kitbashData,
        })
    }

    getCurrentData() {

        const kitbashData = this.kitbashWrapper.getCurrentData()

        const componentData = this.cyberkitWrapper.getCurrentData()

        return structuredClone({
            ... kitbashData,
            ... componentData,
        })
    }

    loadScripts() {

        this.kitbashWrapper.elements.forEach((el) => {

            this.opts.space.scriptContainer?.addComponentScript(el)
        })
    }

    setState(STATE, opts) {

        switch (STATE) {

            case APP_STATES.SPACE:
                //
                this.loadScripts()

                break

        }
    }

    updateState(STATE) {

        this.isEditMode = Camera.isEditing && STATE !== APP_STATES.CINEMATIC
    }

    getFactoryOptions() {

        return this.cyberkitWrapper.getFactoryOptions()
    }

    getComponentTypes() {

        return this.cyberkitWrapper.getComponentTypes()
    }

    getComponentById(id) {

        let cdata = this.data[id]

        if(cdata == null) {

            throw new Error("Can't find component " + id)
        }

        if (this.cyberkitWrapper.isCyberkitComponent(cdata)) {

            return this.cyberkitWrapper.getComponentById(id)
        }
        else {

            return this.kitbashWrapper.getElementById(id)
        }
    }

    getComponentsByType(type) {

        return this.cyberkitWrapper.getComponentsByType(type)
                .concat(this.kitbashWrapper.getElementsByType(type))
    }

    createDefaultComponents() {

        this.cyberkitWrapper.createDefaultComponents()
    }

    get components() {

        return this.cyberkitWrapper.components
    }

    get kitbashes() {

        return this.kitbashWrapper.elements
    }

	async build() {

        await Promise.all(
            Object.values(this.data).map((data) => {

                if (this.cyberkitWrapper.isValidComponent(data) == true && this.cyberkitWrapper.isCyberkitComponent(data)) {

                    if(data.kit !== "cyber") {

                        data.kit = "cyber"
                    }

                    return this.cyberkitWrapper.addComponent(data)
                }
            })
        )
	}



	reset(){

        this.kitbashWrapper.reset()

        this.cyberkitWrapper.reset()
	}

    createComponent(data) {

        if(this.cyberkitWrapper.isCyberkitComponent(data)) {

            return this.cyberkitWrapper.createComponent(data)
        }
        else {

            return this.kitbashWrapper.createElement(data)
        }
    }


    /**
     * @typedef {{ kit: string, preset?:any, ctype: string, payload?: any, id: string, duplicate?: boolean }} AddTypeOpts
     *
     *
     * @param {AddTypeOpts} opts
     * @returns {Promise<any>}
     */
    async handleAddType(opts) {

        let res

        if(opts.kit == "cyber") {

            res = await this.cyberkitWrapper.handleAddType(opts, this.data)
        }
        else {

            res = await this.kitbashWrapper.handleAddType(opts)
        }

        return res
    }


     /**
     * @typedef {{ id: string }} RemoveElementOpts
     *
     *
     * @param {RemoveElementOpts} opts
     */
    handleRemoveElement({ id }) {

        let data = this.data[id]

        if (data == null) {

            throw new Error("Can't find component " + id)
        }

        let res

        if (this.cyberkitWrapper.isCyberkitComponent(data)) {

            res = this.cyberkitWrapper.handleRemoveComponent({ id })
        }
        else {

            res = this.kitbashWrapper.handleRemoveElement({ id })
        }

        return res
    }


    /**
     * @typedef {{ id: string, payload: any }} UpdateElementOpts
     *
     *
     * @param {UpdateElementOpts} opts
     */
    handleUpdateElement({ id, payload }) {

        /** @type { Component3D } */
        let el = this.kitbashes.find(it => it.data.id === id)

        if(el == null) {

            el = this.cyberkitWrapper.getComponentById(id)
        }

        if(el == null) {

            throw new Error("Can't find component " + id)
        }

        el.onData(payload)

        return el.data
    }



    handleReset(data) {

        this.reset()

        this.data = data

        this.kitbashWrapper.data = this.data

        this.cyberkitWrapper.data = this.data

        this.build()

        return this.data

    }

    dispose() {

        this.kitbashWrapper.dispose()

        this.cyberkitWrapper.dispose()
    }
}
