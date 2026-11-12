// @ts-check

import { Component3D } from '@3factory/space/kits/abstract'

import root from "@3gl/root"

import { CURRENT_SPACE, UPLOADER_TYPES } from "@3constants";

import { reflectorPresets, getDefaultReflectorData, getReflectorDataFromRoom, normalMaps, updateRoomParamsFromReflectorData } from './data';





const normalMapOpts = Object.values(normalMaps)






export class ReflectorComponent extends Component3D {
    static getInfo() {
        return {
            type: "reflector",
            title: "Reflector",
            image: "/components/reflector.png",
        };
    }

    static getDataFromRoom(room) {
        return getReflectorDataFromRoom(room);
    }

    static getDefaultData() {
        return getDefaultReflectorData();
    }

    static validateCreation(config) {
        const res = super.validateCreation(config);

        if (!res.success) return res;

        if (config?.water != null) {
            return {
                success: false,
                message:
                    "You have already selected a water surface your world.",
            };
        }

        return res;
    }

    static isSingleton() {
        return true;
    }

    static getPresets() {
        return reflectorPresets;
    }

    constructor(opts = {}) {
        super(opts);

        this.opts = opts;

        this.data = opts.data;

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
                max: 1000,
                step: 0.1,
            },
            position: {
                type: "xyz",
                value: [this.data, "position"],
                step: { x: 0.1, y: 0.1, z: 0.1 },
            },
            blur: {
                type: "checkbox",
                value: [this.data, "blur"],
            },
            normalMap: {
                type: "checkbox",
                value: [this.data, "normalmap", "enabled"],
            },
            normalMapOpts: {
                type: "group",
                visible: () => this.data.normalmap.enabled,
                children: {
                    strength: {
                        type: "number",
                        value: [this.data, "normalmap", "strength"],
                        min: 0.01,
                        max: 1,
                        step: 0.01,
                    },
                    tiles: {
                        type: "number",
                        value: [this.data, "normalmap", "tiles"],
                        min: 0.1,
                        max: 20,
                        step: 0.1,
                    },
                    image: {
                        type: "select",
                        items: normalMapOpts,
                        value: [this.data, "normalmap", "images"],
                    },
                    customImage: {
                        visible: () =>
                            this.data.normalmap.images.id == "custom",
                        type: "image",
                        value: [this.data, "normalmap", "customImage"],
                        action: "file",
                    },
                },
            },
            collision: {
                type: "checkbox",
                value: [this.data, "collision"],
            },
        };

        this.setProps(meta);

        this.presets = this.props.getPresets(reflectorPresets);

        if (this.data.collision) {
            this.setCollisionMesh(this.opts.space.scene.water);
        }

        this.setProps(meta)

        if( this.data.collision ){

            

        }

        this.presets = this.props.getPresets(reflectorPresets);
    }

    async init() {

        this.setCollisionMesh(this.opts.space.scene.reflector)
        
        this.update3D()
    }

    update3D() {
        const params = this.opts.roomParameters;

        updateRoomParamsFromReflectorData(params, this.data);

        root.uploaderSetRoomParameters({
            type: UPLOADER_TYPES.FLOOR_ENABLE_REFLECTOR,
            roomParameters: params,
            exhibit: this.opts.exhibit,
            space: this.opts.space,
        })

        if (this.selectionMesh == null) {
            // @ts-ignore
            this.selectionMesh = this.opts.space.scene.reflector;
        }

        if (this.collisionMesh) {

            this.collisionMesh.userData._disabled = !this.data.collision
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
        };
    }

    onDispose() {
        const params = this.opts.roomParameters;

        params.enableReflector = false;

        root.uploaderSetRoomParameters({
            type: UPLOADER_TYPES.FLOOR_ENABLE_REFLECTOR,
            roomParameters: params,
            exhibit: this.opts.exhibit,
            space: this.opts.space,
        })
    }
}
