// @ts-check

import { CURRENT_SPACE, UPLOADER_TYPES, SET_SHADOW_NEEDS_UPDATE, EDITION_TRANSFORM_CONTROL  } from "@3constants";
import root from "@3gl/root";
import { Component3D, DefaultScope } from '@3factory/space/kits/abstract'
import {
    lightPresets,
    getDefaultLightingData,
    getLightingDataFromRoom,
    updateRoomParamsFromLightingData,
} from "./data";
import { asConst } from "@utils/js";
import PipeLineMesh from "@components/_3DExhibit-v2/three/abstract/pipelinemesh";
import { BoxGeometry, MeshLambertMaterial, Vector3 } from "three";


const scope = structuredClone(DefaultScope)

scope.space.classic = false



export class LightingComponent extends Component3D {
    static getInfo() {
        return {
            type: "lighting",
            title: "Lighting",
            image: "/components/lighting.png",
            help: {
                desc: "Adjust the light’s position to change the shadows in your World.",
            },
        };
    }

    static getScope() {
        return scope;
    }

    static getDefaultData() {
        return getDefaultLightingData();
    }

    static getDataFromRoom(room) {
        return getLightingDataFromRoom(room);
    }

    static isSingleton() {
        return true;
    }

    static getPresets() {
        return lightPresets;
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
            lightingOpts: {
                type: "group",
                visible: () => this.data.enabled,
                children: {
                    position: {
                        type: "xyz",
                        value: [this.data, "lightPosition"],
                        step: 0.2,
                    },
                    direction: {
                        type: "xyz",
                        value: [this.data, "lightDirection"],
                        min: -1,
                        max: 1,
                        step: 0.01,
                    },
                    intensity: {
                        type: "number",
                        value: [this.data, "intensity"],
                        min: 0,
                        max: 1,
                        step: 0.01,
                    },
                    size: {
                        type: "number",
                        value: [this.data, "size"],
                        min: 500,
                        max: 4000,
                        step: 0.01,
                    },

                    bias: {
                        type: "number",
                        value: [this.data, "bias"],
                        min: -0.1,
                        max: 0.1,
                        step: 0.001,
                    },

                    near: {
                        type: "number",
                        value: [this.data, "near"],
                        min: 0,
                        max: 3000,
                        step: 1,
                    },
                    far: {
                        type: "number",
                        value: [this.data, "far"],
                        min: 0,
                        max: 3000,
                        step: 1,
                    },
                    helper: {
                        type: "checkbox",
                        label: "Show Helper",
                        value: [this, "showHelper"],
                    },
                },
            },
        };

        this.setProps(meta);

        this.presets = this.props.getPresets(lightPresets);
    }

    async init() {

        this.selectionMesh = new PipeLineMesh(
            new BoxGeometry(1, 1, 1),
            new MeshLambertMaterial({ color: 0xff0000, wireframe: true })
        )

        this.selectionMesh.visible = false;

        this.update3D();

        this.onSelect((e) => {
            this.showHelper = e.isSelected;
        });

        this.add(this.selectionMesh)
    }

    get showHelper() {

        return this._showHelper;
    }

    set showHelper(value) {

        this._showHelper = value;

        this.opts.roomParameters.lighting.helper = value;

        this.prefTransformControls = value ? EDITION_TRANSFORM_CONTROL.TRANSFORM_3D : null;
    }

    tmpDir = new Vector3();

    updateCoords(opts = {}) {

        this.getWorldDirection(this.tmpDir);
        
        this.props?.update(
            {
                lightingOpts: {
                    position: { x: this.position.x, y: this.position.y, z: this.position.z },
                    direction: { x: this.tmpDir.x, y: this.tmpDir.y, z: this.tmpDir.z },
                },
            },
            {
                isProgress: this.isDragging,
                ...opts
            }
        )

        console.log("updateCoords", this.position, this.data.lightPosition)
    }

    update3D() {
        //
        const params = this.opts.roomParameters;

        updateRoomParamsFromLightingData(params, this.data);

        this.position.copy(this.data.lightPosition);

        this.tmpDir.copy(this.data.lightDirection).normalize();

        this.lookAt(this.tmpDir.add(this.position));

        params.lighting.helper = this.showHelper;

        if (CURRENT_SPACE?.space?.scene?.lighting)
            SET_SHADOW_NEEDS_UPDATE(true);

        if (CURRENT_SPACE?.space != this.opts.space) return

        if(CURRENT_SPACE?.space?.scene?.lighting) {

            SET_SHADOW_NEEDS_UPDATE( true )

            CURRENT_SPACE.space.scene.lighting.needsRender = true
        }

        this.prefTransformControls = this.showHelper && this.data.enabled ? EDITION_TRANSFORM_CONTROL.TRANSFORM_3D : null;
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

    showSelected(isSelected) {}

    onDispose() {
        const params = this.opts.roomParameters;

        if (params.lighting) {
            params.lighting.enabled = false;
        }
    }
}
