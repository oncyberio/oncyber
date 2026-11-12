// @ts-check

import { Component3D } from '@3factory/space/kits/abstract'

import root from "@3gl/root"

import { CURRENT_SPACE, UPLOADER_TYPES } from "@3constants";
import { getDefaultWaterData, getWaterDataFromRoom, updateRoomParamsFromWaterData } from './data';



export class WaterComponent  extends Component3D {

    static getInfo() {
        return {
            type: "water",
            title: "Water",
            image: "/components/water.png",
        }
    }

    static getDataFromRoom(room) {

        return getWaterDataFromRoom(room)
    }

    static getDefaultData() {

        return getDefaultWaterData()
    }

    static validateCreation(config) {

        const res = super.validateCreation(config)

        if(!res.success) return res

        if( config?.reflector != null ) {

            return {
                success: false,
                message: "You have already selected a reflector for your world."
            }
        }

        return res
    }

    static isSingleton() {
        return true
    }

    constructor(opts = {}) {

        super(opts)

        this.opts = opts

        this.data = opts.data

        const meta = {
            color: {
                type: "color",
                value: [this.data, "color"],
            },
            opacity: {
                type: "number",
                value: [this.data, "opacity"],
                min: 0,
                max: 1,
                step: 0.01,
            },
            scale: {
                type: "xyz",
                value: [this.data, "scale"],
                min: 1,
                max: 5000,
                step: 0.1,
            },
            position: {
                type: "xyz",
                value: [this.data, "position"],
                step: 0.01,
            },
            collision : {
                type: "checkbox",
                value: [this.data, "collision"],
            }
        }

        this.setProps(meta)
    }

    async init() {

        this.setCollisionMesh(this.opts.space.scene.water)

        this.update3D()
    }

    update3D() {

        const params = this.opts.roomParameters

        updateRoomParamsFromWaterData(params, this.data)

        root.uploaderSetRoomParameters({
            type: UPLOADER_TYPES.FLOOR_ENABLE_WATER,
            roomParameters: params,
            exhibit: this.opts.exhibit,
            space: this.opts.space,
        })

        if( this.selectionMesh == null ) {
            // @ts-ignore
            this.selectionMesh = this.opts.space.scene.water
        }

        if (this.collisionMesh) {

            this.collisionMesh.userData._disabled = !this.data.collision
        }
    }

    getGUI() {

        return {
            type: "group",
            children: this.props.meta,
        }
    }

    onDispose() {

        const params = this.opts.roomParameters

        params.enableWater = false

        root.uploaderSetRoomParameters({
            type: UPLOADER_TYPES.FLOOR_ENABLE_WATER,
            roomParameters: params,
            exhibit: this.opts.exhibit,
            space: this.opts.space,
        })
    }
}
