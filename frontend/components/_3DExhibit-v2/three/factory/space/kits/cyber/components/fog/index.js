// @ts-check

import { CURRENT_SPACE, UPLOADER_TYPES } from "@3constants";
import root from "@3gl/root";
import { Component3D } from '@3factory/space/kits/abstract'
import { fogPresets, getDefaultFogData, getFogDataFromRoom, updateRoomParamsFromFogData } from "./data";






export class FogComponent extends Component3D {
    static getInfo() {
        return {
            type: "fog",
            title: "Fog",
            image: "/components/fog.png",
            help: {
                tip: "Tip: Fog can soften the hard edge of your World",
            },
        };
    }

    static getDefaultData() {
        return getDefaultFogData();
    }

    static getDataFromRoom(room) {
        return getFogDataFromRoom(room);
    }

    static isSingleton() {
        return true;
    }

    static getPresets() {
        return fogPresets;
    }

    constructor(opts = {}) {
        super(opts);

        this.opts = opts;

        this.data = opts.data;

        const meta = {
            enabled: {
                type: "checkbox",
                value: [this.data, "enabled"],
            },
            fogOpts: {
                type: "group",
                visible: () => this.data.enabled,
                children: {
                    near: {
                        type: "number",
                        value: [this.data, "near"],
                        min: -100,
                        max: 1300,
                        step: 1,
                    },
                    far: {
                        type: "number",
                        value: [this.data, "far"],
                        min: 0,
                        max: 1400,
                        step: 1,
                    },
                },
            },
        };

        this.setProps(meta);

        this.presets = this.props.getPresets(fogPresets);
    }

    async init() {
        this.update3D();
    }

    update3D() {
        const params = this.opts.roomParameters;

        updateRoomParamsFromFogData(params, this.data);

        root.uploaderSetRoomParameters({
            type: UPLOADER_TYPES.FAR_FOG,
            roomParameters: params,
            exhibit: this.opts.exhibit,
            space: this.opts.space,
        })
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

        if (params.fog) {
            params.fog.enabled = false;
        }

        root.uploaderSetRoomParameters({
            type: UPLOADER_TYPES.FAR_FOG,
            roomParameters: params,
            exhibit: this.opts.exhibit,
            space: this.opts.space,
        })
    }
}
