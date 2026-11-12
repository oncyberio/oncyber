// @ts-check

import { CURRENT_SPACE, UPLOADER_MODE, UPLOADER_TYPES } from "@3constants";
import root from "@3gl/root";
import { Component3D } from '@3factory/space/kits/abstract'
import { getCameraDataFromRoom, getDefaultCameraData, updateRoomParamsFromCameraData } from "./data";



export class CameraComponent  extends Component3D {

    static getInfo() {
        return {
            type: "camera",
            title: "Camera",
            help: {
                desc: "Determine how far Visitors can see in your World.", 
                tip: "Tip: Shorter distance will improve perfromance. ",
            },
            image: "/components/camera.png",
        }
    }

    static getDefaultData() {

        return getDefaultCameraData()
    }

    static getDataFromRoom(room) {

        return getCameraDataFromRoom(room)
    }

    static isSingleton() {
        return true
    }

    static isRequired() {
        return true
    }


    constructor(opts = {}) {

        super(opts)

        this.opts = opts

        this.data = opts.data


        
        const meta = {
            far: {
                type: "number",
                value: [this.data, "far"],
                label: "Far",
                min: 10,
                max: 2000,
                step: 1,
            }
        }

        this.setProps(meta)
    }

    async init() {

        this.update3D()
    }

    update3D() {

        const params = this.opts.roomParameters

        updateRoomParamsFromCameraData(params, this.data)

        root.uploaderSetRoomParameters({
            type: UPLOADER_TYPES.FAR,
            roomParameters: params,
            exhibit: this.opts.exhibit,
            space: this.opts.space,
        });
    }

    getGUI() {

        return {
            type: "group",
            children: this.props.meta,
        }
    }
}
