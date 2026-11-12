// @ts-check

import {
	Group,

} from 'three'


import { Component3D } from '@3factory/space/kits/abstract'

import { components, factoryOptions } from "./components"

import { isObject, removeItem } from '@utils/js'

import { EMPTY_ROOM } from '@utils/emptyRoom'

import { getDefaultCyberkitDataFromRoom, getDefaultEmptyRoomData } from '../../roomdatacompat'

import Emitter from '@3emitter'

import Events from '@3events'

import { nanoid } from 'nanoid'



export class CyberKitWrapper extends Group {


	constructor( opts = {} ) {

        super()

        this.opts = opts

        this.data = opts.data

        /** @type { Component3D[] } */
		this.components = []

        this.raycastMeshes = opts.raycastMeshes || []

        this.collisions = opts.collisions || []

        this._isEditMode = undefined

        this.buildComponentTypes()

    }


    get isEditMode() {

        return this._isEditMode
    }

    set isEditMode(isEditMode) {

        if(isEditMode === this._isEditMode) return

        this._isEditMode = isEditMode

        this.components.forEach((component) => {

            component.setEditMode(isEditMode)
        })
    }

    getFactoryOptions() {

        return factoryOptions
    }

    getComponentTypes() {

        return this.componentTypes
    }

    createDefaultComponents(opts) {
        //
        const defData = this.getDefaultData(opts)

        for (const key in defData) {

            const cdata = defData[key]

            this.data[ cdata.id ] = cdata

            this.addComponent(cdata)
        }
    }

    getDefaultData(opts) {
        //
        let room = this.opts.roomParameters

        if (opts?.applyStylekit && room.slug !== EMPTY_ROOM.slug) {

            return getDefaultCyberkitDataFromRoom(room, this.data)
        }
        else {

            return getDefaultEmptyRoomData()
        }
    }

    getCurrentData() {

        const data = {}

        this.components.forEach((component) => {

            data[component.data.id] = structuredClone(component.data)
        })

        return data
    }

    buildComponentTypes() {

        /**
         * @type { Record<string, typeof Component3D> }
         */
        this.componentTypes = {}

        components.forEach((c) => {

            const info = c.getInfo()

            this.componentTypes[info.type] = c
        })
    }

    isCyberkitComponent(data) {
            
        return data.kit === "cyber" || this.componentTypes[data.type] != null
    }

    getComponentById(id) {

        return this.components.find(it => it.data.id === id)
    }

    getComponentsByType(type) {

        return this.components.filter(it => it.data.type === type)
    }

    isValidComponent(data){

        return this.componentTypes[data?.type] != null
    }

    async createComponent(data = {}) {

        const type = this.componentTypes[data.type]

        if(type == null) {

            // throw new Error("type does not exists : " + data.type)
            console.log("type does not exists : " + data.type)

            return
        }

        let {preset, ...payload } = data

        data = {
            kit: this.opts.kit,
            id: data.id ?? `${data.type}-${nanoid()}`,
            ...type.getDefaultData(),
            ...payload
        }

        const instance = new type({ ...this.opts, container: this, isEditMode: this.isEditMode, data })

        await instance.init()

        return instance
    }

    async addComponent(data) {

        const instance = await this.createComponent(data)

        this.components.push(instance)

        this.add(instance)

        if ( instance.selectionMesh ) {

            this.raycastMeshes.push(instance.selectionMesh)
        }

        if ( instance.collisionMesh ) {

            this.collisions.push(instance.collisionMesh)
        }

        Emitter.emit(Events.COMPONENT_ADDED, instance)


        return instance
    }

    /**
     *
     * @param {Component3D} component
     * @returns
     */
    removeComponent (component) {

        const index = removeItem(this.components, component)

        if(index < 0) {

            console.error("Can't find element " + component.data.id)

            return null
        }

        this.remove(component)

        Emitter.emit(Events.COMPONENT_REMOVED, component)

        component.dispose()

        if (component.selectionMesh) {

            removeItem(this.raycastMeshes, component.selectionMesh)
        }

        // this.updateUI()

        return component
	}


    /**
     * @typedef {{ ctype: string, kit: string, preset?: import('../types').PresetData, payload?: any }} AddTypeOpts
     *
     *
     * @param {AddTypeOpts} opts
     * @returns {Promise<Component3D>}
     */
    handleAddType({ ctype: type, kit, preset, payload }, config) {

        const factory = this.componentTypes[ type ]

        if(factory == null) {

            throw new Error("Unkown component type " + type)
        }

        const res = factory.validateCreation(config)

        if(!res.success) {

            throw new Error("Can't create " + type)
        }

        let newData = payload;

        if(newData == null) {

            newData = factory.getDefaultData()

            newData.id = newData.id || `${type}-${nanoid()}`

            newData.kit = kit

            if(preset) {

                this.mergeData(newData, preset)
            }
        }

        this.data[ newData.id ] = newData

        return this.addComponent(newData)
    }

    mergeData(target, source) {
        //
        for (const key in source) {

            const value = source[key]

            if( isObject(value)) {

                if(target[key] == null) {

                    target[key] = {}
                }

                this.mergeData(target[key], value)
            }
            else {

                target[key] = value
            }
        }
    }


     /**
     * @typedef {{ id: string }} RemoveElementOpts
     *
     *
     * @param {RemoveElementOpts} opts
     */
      handleRemoveComponent({ id }) {

        const c = this.components.find(it => it.data.id === id)

        if(c == null) {

            throw new Error("Unkown Kitbsah element " + id)
        }

        if(c.isRequired) {

            throw new Error("Can't remove required element " + id)
        }

        const res = this.removeComponent(c)

        delete this.data[ id ]

        return res
    }


    reset() {

        this.components.slice().forEach((c) => {

            this.removeComponent(c)

            delete this.data[ c.data.id ]
        })

        this.components = []
    }


    dispose() {

        this.components.slice().forEach((c) => {

            this.removeComponent(c)
        })

        this.components = []
    }
}
