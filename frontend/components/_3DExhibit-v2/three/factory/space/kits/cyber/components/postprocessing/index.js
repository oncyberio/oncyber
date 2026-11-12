// @ts-check

import { CURRENT_SPACE, UPLOADER_MODE, UPLOADER_TYPES } from "@3constants";
import root from "@3gl/root";
import { Component3D, DefaultScope } from '@3factory/space/kits/abstract'
import {
    postprocessingPresets,
    LUTMAPS,
    POST_PROCESSINGS,
    POST_TYPES,
    getDefaultPostProcessingData,
    getPostProcessingDataFromRoom,
    updateRoomParamsFromPostProcessingData,
} from "./data";
import { asConst } from "@utils/js";


const { CyberCity, ...postPro } = POST_PROCESSINGS

const postproOpts = Object.values(postPro).map(it => it.name)

const cybercityOpt = POST_PROCESSINGS.CyberCity.name

const lutmapOpts = Object.values(LUTMAPS)



const scope = structuredClone(DefaultScope)

scope.space.classic = false




export class PostProcessingComponent extends Component3D {
    static getInfo() {
        return {
            type: "postprocessing",
            title: "Filters",
            image: "/components/postprocessing.png",
            help: {
                desc: "Add a filter to your entire world.  Choose between one of our presets or upload your own.",
            },
        };
    }

    static getScope() {
        return scope;
    }

    static getDefaultData() {
        return getDefaultPostProcessingData();
    }

    static getDataFromRoom(room) {
        return getPostProcessingDataFromRoom(room);
    }

    static isSingleton() {
        return true;
    }

    static getPresets() {
        return postprocessingPresets;
    }

    constructor(opts = {}) {
        super(opts);

        this.opts = opts;

        this.data = opts.data;

        let bloomMeta = {};

        Object.keys(POST_PROCESSINGS.Bloom.opts).forEach((key) => {
            if (key == "color") {
                bloomMeta[key] = {
                    type: "color",
                    value: [this.data, "bloomOpts", key],
                };
            } else {
                bloomMeta[key] = {
                    type: "number",
                    value: [this.data, "bloomOpts", key],
                    min: 0,
                    max: 1,
                    step: 0.01,
                };
            }
        });

        const meta = {
            enabled: {
                type: "checkbox",
                value: [this.data, "enabled"],
            },
            opts: {
                type: "group",
                visible: () => this.data.enabled,
                children: {
                    postProType: {
                        type: "select",
                        label: "Effect",
                        items: () => {
                            let items = postproOpts;
                            // @ts-ignore

                            if (CURRENT_SPACE?.roomParameters.cybercity) {
                                items = items.concat([cybercityOpt]);
                            }

                            return items;
                        },
                        value: [this.data, "postProType"],
                    },
                    bloomOpts: {
                        type: "group",
                        visible: () =>
                            this.data.postProType == POST_TYPES.BLOOM,
                        children: bloomMeta,
                    },
                    lutOpts: {
                        type: "group",
                        visible: () =>
                            this.data.postProType == POST_TYPES.LOOK_UP_TABLE,
                        children: {
                            texture: {
                                type: "select",
                                items: lutmapOpts,
                                label: "Texture",
                                value: [this.data, "lutOpts", "image"],
                            },
                            customImage: {
                                visible: () =>
                                    this.data.lutOpts.image.id == "custom",
                                type: "image",
                                label: "Custom Image",
                                value: [this.data, "lutOpts", "image"],
                                action: "upload",
                                accept: "image/png",
                            },
                        },
                    },

                    trippyOpts : {

                        type: "group",
                        visible: () => this.data.postProType == POST_TYPES.TRIPPY,
                        children: {
                            speed: {
                                type: "number",
                                value: [this.data,"trippyOpts","speed"],
                                min: 0,
                                max: 1,
                                step: 0.01,
                            }
                        }
                    }
                }
            }
        };

        this.setProps(meta);

        this.presets = this.props.getPresets(postprocessingPresets);
    }

    async init() {
        this.update3D();
    }

    update3D() {
        const params = this.opts.roomParameters;

        updateRoomParamsFromPostProcessingData(params, this.data);
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

        if (params.usePostProcessing) {
            params.usePostProcessing.enabled = false;
        }
    }
}
