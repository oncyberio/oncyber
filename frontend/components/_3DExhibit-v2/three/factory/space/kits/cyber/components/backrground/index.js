// @ts-check

import { CURRENT_SPACE, UPLOADER_TYPES } from "@3constants";

import root from "@3gl/root";

import { presetImages, getDefaultBackgroundData, getBackgroundDataFromRoom, updateRoomParamsFromBackgroundData  } from "./data"

import { Component3D } from '@3factory/space/kits/abstract'

import { deepEqual } from "@utils/js";



const imagesOpts = Object.values(presetImages)


const backgroundPresets = [
    {
        name: "Space",
        image: presetImages.space.image,
        data: {
            backgroundType: "Texture",
            textureOpts: {
                textureType: "Image",
                imageOpts: {
                    image: presetImages.space,
                },
            },
        },
    },
    {
        name: "Day",
        image: presetImages.day.image,
        data: {
            backgroundType: "Texture",
            textureOpts: {
                textureType: "Image",
                imageOpts: {
                    image: presetImages.day,
                },
            },
        },
    },
    {
        name: "Day 2",
        image: presetImages.day2.image,
        data: {
            backgroundType: "Texture",
            textureOpts: {
                textureType: "Image",
                imageOpts: {
                    image: presetImages.day2,
                },
            },
        },
    },
    {
        name: "Orbit",
        image: presetImages.orbit.image,
        data: {
            backgroundType: "Texture",
            textureOpts: {
                textureType: "Image",
                imageOpts: {
                    image: presetImages.orbit,
                },
            },
        },
    },
    {
        name: "Orbit 2",
        image: presetImages.orbit2.image,
        data: {
            backgroundType: "Texture",
            textureOpts: {
                textureType: "Image",
                imageOpts: {
                    image: presetImages.orbit2,
                },
            },
        },
    },
    {
        name: "Mountains",
        image: presetImages.moutains.image,
        data: {
            backgroundType: "Texture",
            textureOpts: {
                textureType: "Image",
                imageOpts: {
                    image: presetImages.moutains,
                },
            },
        },
    },
    {
        name: "Mud Road",
        image: presetImages.mud_road.image,
        data: {
            backgroundType: "Texture",
            textureOpts: {
                textureType: "Image",
                imageOpts: {
                    image: presetImages.mud_road,
                },
            },
        },
    },
    {
        name: "Night",
        image: presetImages.night.image,
        data: {
            backgroundType: "Texture",
            textureOpts: {
                textureType: "Image",
                imageOpts: {
                    image: presetImages.night,
                },
            },
        },
    },
    {
        name: "Morning",
        image: "https://cyber.mypinata.cloud/ipfs/QmfAauFSAcR3nXoNMKCuJoyTVLyPeNBZPnyVsuzQTatuBj?filename=Sky_Shader_iewsbp.jpg",
        data: {
            backgroundType: "Texture",
            textureOpts: {
                textureType: "Sky",
                skyOpts: {
                    turbidity: 4,
                    rayleigh: 3,
                    mieCoefficient: 0.005,
                    mieDirectionalG: 0.07,
                    azimuth: 180,
                    elevation: 2,
                },
            },
        },
    },
    {
        name: "Black",
        image: "https://cyber.mypinata.cloud/ipfs/QmRcoNnV7aRZdstD2wi2MJCYmGGwUwd125BNf4WBCLy88W?filename=image_2023-08-01_092335040_vvlgct.png",
        data: {
            backgroundType: "Color",
            colorOpts: {
                color: "#000000",
            },
        },
    },
];


export class BackgroundComponent  extends Component3D {

    static getInfo() {
        return {
            type: "background",
            title: "Background",
            image: "https://cyber.mypinata.cloud/ipfs/QmXDFKUJvDFgCKumJDhPXBPBupuJKSgxSfV6odV4qaD96U?filename=background_xr8gr1.webp",
            help: {
                desc: "Set the Background as one of our presets or upload your own.",
            }
        }
    }

    static getDataFromRoom(room) {

        return getBackgroundDataFromRoom(room)
    }

    static getDefaultData() {

        return getDefaultBackgroundData()
    }

    static isSingleton() {
        return true
    }

    static isRequired() {
        return true
    }

    static getPresets() {

        return backgroundPresets
    }

    constructor(opts = {}) {

        super(opts)

        this.opts = opts

        this.data = opts.data

        const meta = {
            backgroundType: {
                type: "select",
                items: ["Color", "Texture"],
                mode: "buttons",
                label: null,
                value: [this.data, "backgroundType"],
            },
            colorOpts: {
                type: "group",
                visible: () => this.data.backgroundType == "Color",
                children: {
                    color: {
                        type: "color",
                        value: [this.data, "colorOpts", "color"],
                    },
                },
            },
            textureOpts: {
                type: "group",
                visible: () => this.data.backgroundType == "Texture",
                children: {
                    textureType: {
                        type: "select",
                        items: ["Sky", "Image"],
                        mode: "buttons",
                        label: "Texture Type",
                        value: [this.data, "textureOpts", "textureType"],
                    },
                    skyOpts: {
                        type: "group",
                        visible: () => this.data.textureOpts.textureType == "Sky",
                        children: {
                            turbidity: {
                                type: "number",
                                value: [this.data, "textureOpts", "skyOpts", "turbidity"],
                                min: 0,
                                max: 12,
                                step: 1,
                            },
                            rayleigh: {
                                type: "number",
                                value: [this.data, "textureOpts", "skyOpts", "rayleigh"],
                                min: 0,
                                max: 4,
                                step: 0.01,
                            },
                            mieCoefficient: {
                                type: "number",
                                value: [this.data, "textureOpts", "skyOpts", "mieCoefficient"],
                                min: 0,
                                max: 0.1,
                                step: 0.01,
                            },
                            mieDirectionalG: {
                                type: "number",
                                value: [this.data, "textureOpts", "skyOpts", "mieDirectionalG"],
                                min: 0,
                                max: 0.1,
                                step: 0.001,
                            },
                            azimuth: {
                                type: "number",
                                value: [this.data, "textureOpts", "skyOpts", "azimuth"],
                                min: -180,
                                max: 180,
                                step: 1,
                            },
                            elevation: {
                                type: "number",
                                value: [this.data, "textureOpts", "skyOpts", "elevation"],
                                min: 0,
                                max: 90,
                                step: 1,
                            },
                        },
                    },
                    imageOpts: {
                        type: "group",
                        visible: () => this.data.textureOpts.textureType == "Image",
                        children: {
                            image: {
                                type: "select",
                                items: imagesOpts,
                                label: "Preset Images",
                                value: [this.data, "textureOpts", "imageOpts", "image"],
                            },
                            customImage: {
                                visible: () => this.data.textureOpts.imageOpts.image.id == "custom",
                                type: "image",
                                label: "Custom Image",
                                value: [this.data, "textureOpts", "imageOpts", "image"],
                                action: "upload",
                                accept: "image/png, image/jpeg, image/jpg, .hdr",
                            },
                        },
                    },
                },
            },
        }

        this.setProps(meta)

        this.presets = this.props.getPresets(backgroundPresets)
    }

    async init() {

        this.update3D()
    }

    update3D () {

        // console.log("update background", this.frame++)

        const params = this.opts.roomParameters

        //
        let background_type = params.background_type
        let background = params.background
        let enableSky = params.enableSky
        let skyOptions = params.skyOptions
        let backgroundMap = params.backgroundMap

        updateRoomParamsFromBackgroundData(params, this.data)

        if (background_type != params.background_type ||
            background != params.background ||
            enableSky != params.enableSky ||
            !deepEqual(skyOptions, params.skyOptions) ||
            !deepEqual(backgroundMap, params.backgroundMap)) {

            return root.uploaderSetRoomParameters({
                type: UPLOADER_TYPES.BACKGROUND,
                roomParameters: params,
                exhibit: this.opts.exhibit,
                space: this.opts.space,
            })
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

    get hint() {

        if (this.data.backgroundType == "Color") {

            return "Solid Color"
        }
        else {
            //
            if (this.data.textureOpts.textureType == "Sky") {

                return "Sky"
            }
            else if (this.data.textureOpts.textureType == "Image") {

                if (this.data.textureOpts.imageOpts.image.id == "custom") {

                    return "Custom Image"
                }
                else {

                    return this.data.textureOpts.imageOpts.image.name
                }
            }
        }
    }
}
