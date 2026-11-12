// @ts-check

import { CURRENT_SPACE, UPLOADER_TYPES } from "@3constants";
import root from "@3gl/root";
import { Component3D } from '@3factory/space/kits/abstract'
import {physicsPresets, getPhysicsDataFromRoom, getDefaultPhysicsData, updateRoomParamsFromPhysicsData } from "./data";

export class PhysicsComponent extends Component3D {
    static getInfo() {
        return {
            type: "physics",
            title: "Physics",
            image: "https://cyber.mypinata.cloud/ipfs/QmPboABGHtHVzhxxUCphuiCsxmYPK1aAsGt5RagVwkdLJ6?filename=physics_rsjikj.webp",
            help: {
                desc: "Define how visitors move around in your World.",
            },
        };
    }

    static getDefaultData() {
        return getDefaultPhysicsData();
    }

    static getDataFromRoom(room) {
        return getPhysicsDataFromRoom(room);
    }

    static isSingleton() {
        return true;
    }

    static isRequired() {
        return true;
    }

    static getPresets() {
        return physicsPresets;
    }

    constructor(opts = {}) {
        super(opts);

        this.opts = opts;

        this.data = opts.data;

        const meta = {
            gravity: {
                type: "number",
                label: "Gravity",
                value: [this.data, "gravity"],
                min: 0,
                max: 15,
                step: 0.1,
            },
            playerSpeed: {
                type: "number",
                label: "Player Speed",
                value: [this.data, "playerSpeed"],
                min: 1,
                max: 200,
                step: 1,
            },
            jump: {
                type: "number",
                label: "Jump",
                value: [this.data, "jump"],
                min: 0,
                max: 250,
                step: 1,
            },
            quidditch: {
                type: "checkbox",
                label: "Fly",
                value: [this.data, "quidditch"],
            },
        };

        this.setProps(meta);

        this.presets = this.props.getPresets(physicsPresets);
    }

    async init() {
        this.update3D();
    }

    update3D() {
        const params = this.opts.roomParameters;

        updateRoomParamsFromPhysicsData(params, this.data);

        root.uploaderSetRoomParameters({
            type: UPLOADER_TYPES.GRAVITY,
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
}
