// @ts-check

import { CURRENT_SPACE, UPLOADER_TYPES } from "@3constants";
import root from "@3gl/root";
import { Component3D } from '@3factory/space/kits/abstract'
import { envmapPresets, getDefaultEnvmapData, getEnvmapDataFromRoom, envmaps, updateRoomParamsFromEnvmapData } from "./data";

import {

    Mesh, 

    MeshStandardMaterial,

    SphereGeometry,

    Vector3

} from 'three'

import Scene from '@3scene'

const envmapTypes = ["scene", "image"]

import Camera from '@3camera'

import Emitter from '@3emitter'

import Events from '@3events'

const envmapOpts = Object.values(envmaps)

var cwd = new Vector3();


export class EnvmapComponent  extends Component3D {

    static getInfo() {
        return {
            type: "envmap",
            title: "Environment",
            image: "/components/envmap.png",
        }
    }

    static getDefaultData() {

        return getDefaultEnvmapData()
    }

    static getDataFromRoom(room) {

        return getEnvmapDataFromRoom(room)
    }

    static isSingleton() {
        return true
    }

    static isRequired() {
        return true
    }

    static getPresets() {
        return envmapPresets
    }

    constructor(opts = {}) {

        super(opts)

        this.opts = opts

        this.data = opts.data

        this.envMap = null

        this.envMapMesh = null

        this._showHelper = false

        const meta = {
            envmapType: {
                type: "select",
                label: "Type",
                value: [this.data, "envmapType"],
                items: envmapTypes,
            },
            sceneOpts: {
                type: "group",
                visible: () => this.data.envmapType === "scene",
                children: {
                    position: {
                        type: "xyz",
                        label: "Position",
                        value: [this.data, "sceneOpts", "position"],
                    },
                },
            },
            imageOpts: {
                type: "group",
                visible: () => this.data.envmapType === "image",
                children: {
                    image: {
                        type: "select",
                        label: "Image",
                        value: [this.data, "imageOpts", "image"],
                        items: envmapOpts
                    },
                    customImage: {
                        visible: () => this.data.imageOpts.image.id === "custom",
                        type: "image",
                        label: "Custom Image",
                        value: [this.data, "imageOpts", "image"],
                        action: "upload",
                        accept: "image/png, image/jpeg, image/jpg, .hdr",
                    },
                },
            },
            helper: {
                type: "checkbox",
                label: "Show Helper",
                value: [this, "showHelper"],
            }
        }

        this.setProps(meta)

        this.presets = this.props.getPresets(envmapPresets)

        
    }

    async init() {

        this.update3D()

        this.updateEvent = this.updatePosition.bind(this)

        Emitter.on(Events.PRE_UPDATE, this.updateEvent )

        this.onSelect(async (e) => {

            if (this.data.envmapType === "scene") {

                await root.setEnvMap({
                    roomParameters: this.opts.roomParameters,
                })
            }

            this.showHelper = e.isSelected
        })
    }

    get showHelper() {

        return this._showHelper
    }

    set showHelper(value) {

        this._showHelper = value

        this.updateHelper()
    }

    update3D() {

        const params = this.opts.roomParameters

        updateRoomParamsFromEnvmapData(params, this.data)

        return root.uploaderSetRoomParameters({
            type: UPLOADER_TYPES.APPLY_ENV_MAP,
            roomParameters: params,
            exhibit: this.opts.exhibit,
            space: this.opts.space,

        }).then(( res )=>{

            // debugger

            if (res?.envMap) {
                
                this.envMap = res.envMap
                
                this.updateHelper()
            }
        })
        
    }

    updateHelper() {

        if (this.envMap == null) {

            this.envMap = CURRENT_SPACE?.space?.cubeMap
        }

        if( this.envMap == null ) return

        if( this.envMapMesh == null ) {

            this.envMapMesh = new Mesh(new SphereGeometry(3,32,32), new MeshStandardMaterial({metalness: 1, roughness: 0}))

            this.positionNeedsUpdate = false

            this.envMapMesh.frustumCulled  = false

            this.add(this.envMapMesh)
        }

        // @ts-ignore
        this.envMapMesh.material.envMap = this.envMap.texture ?? this.envMap

        this.envMapMesh.material.needsUpdate = true

        // this.envMapMesh.needsUpdate = true

        this.envMapMesh.visible = this.isEditMode && this.showHelper
    }

    updatePosition(){

        if( this.envMapMesh ) {

            Camera.current.getWorldDirection(cwd);
               
            cwd.multiplyScalar(20);

            cwd.add(Camera.current.position);
               
            this.envMapMesh.position.set(cwd.x, cwd.y, cwd.z);

        }

    }

    getGUI() {

        return {
            type: "group",
            children: {
                presets: {
                    type: "presets",
                    items: this.presets,
                },
                ...this.props.meta,
            },
        }
    }

    setEditMode(isEdit) {

        super.setEditMode(isEdit)

        this.updateHelper() 
    }

    onDispose(){

        super.dispose()

        this.data.helper = false

        Emitter.off(Events.PRE_UPDATE, this.updateEvent )

        this.updateEvent = null

        if( this.envMapMesh ) {


        }
    }
}
