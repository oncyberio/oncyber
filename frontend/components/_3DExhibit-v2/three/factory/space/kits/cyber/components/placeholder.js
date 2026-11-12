// @ts-check

import { Component3D } from '@3factory/space/kits/abstract'
import { MeshBasicMaterial, PlaneGeometry } from "three";
import PipeLineMesh from "@3abstract/pipelinemesh";
import { EDITION_TRANSFORM_CONTROL } from '@components/_3DExhibit-v2/three/constants';
import loader from "@3loader"
import { getNextAutoIncr } from '../../utils';


const ratiosMap = {
    "1:1": { id: "1:1", name: "1:1",  coef: 1 },
    "16:9": { id: "16:9", name: "16:9", coef: 16 / 9 },
}

const ratiosOptions = Object.values(ratiosMap)

export class PlaceholderComponent extends Component3D {

    static getInfo() {

        return {
            type: "media-placeholder",
            title: "Screen Sharing Zone",
            image: "/components/media-placeholder.png",
            imageXL: "/components/media-placeholder-xl.png",
            help: {
                desc: "Add a Screen Sharing Zone to your space to make it easier for users to share their screen to a particular location.",
            },
            group: "triggerZone",
        }
    }

    static getDefaultData(opts) {

        const pos  = Component3D.getInitDefaultPosition()

        const rot = Component3D.getInitDefaultRotation()

        return {
            kit: "cyber",
            type: "media-placeholder",
            name: "",
            position: { x: pos.x, y: pos.y, z: pos.z },
            rotation: { x: 0, y: rot.y, z: 0 },
            ratio: ratiosMap["16:9"],
            size: { x: 1920, y: 1080 },
            scaleCoefficient: 500.83,
        }
    }

    
    static isDraggable() {

        return true
    }

    constructor(opts = {}) {

        super(opts)

        this.opts = opts

        this.data = opts.data

        if(!this.data.name) {

            this.data.name = getNextAutoIncr("Screen", "media-placeholder", "name", opts.container.components)
        }

        const meta = {
            controls: {
                type: "checkbox",
                label: "Advanced Transform controls",
                value: [this, "useAdvancedControls"],
                style: {
                    label: {
                        overflow: "visible",
                    }
                }
            },
            position: {
                type: "xyz",
                value: [this.data, "position"],
                visible: () => this.useAdvancedControls,
            },
            rotation: {
                type: "xyz",
                value: [this.data, "rotation"],
                visible: () => this.useAdvancedControls,
            },
            name: {
                type: "text",
                value: [this.data, "name"],
            },
            ratio: {
                type: "select",
                mode: "buttons",
                value: [this.data, "ratio"],
                items: ratiosOptions,
            },
            size: {
                type: "xyz",
                layout: "inline",
                value: [this.data, "size"],
                min: { x: 1, y: 1 },
                step: 10,
                onChange: (size, _, opts) => {
                    //
                    if (this.prevSize && opts?.source === "ui") {

                        const ratio = this.data.ratio

                        if (this.prevSize.x !== size.x) {
            
                            size.y = size.x / ratio.coef
                        }
                        else if (this.prevSize.y !== size.y) {
            
                            size.x = size.y * ratio.coef
                        }
                    }
                    
                    size.x = Math.round(size.x)
                    size.y = Math.round(size.y)
            
                    this.prevSize = { ...size }
                }
            },
        }

        this.setProps(meta)

        this._prefTransformControl = EDITION_TRANSFORM_CONTROL.TRANSFORM_SNAP
    }

    get useAdvancedControls() {

        return this.prefTransformControls === EDITION_TRANSFORM_CONTROL.TRANSFORM_3D
    }

    /**
     * @param {boolean} val
     */
    set useAdvancedControls(val) {

        if (val === this.useAdvancedControls) return

        this.prefTransformControls = val ? EDITION_TRANSFORM_CONTROL.TRANSFORM_3D : EDITION_TRANSFORM_CONTROL.TRANSFORM_SNAP
    }


    async init() {

        // this.placeholder = PlaceholderFactory.getPlaceholder(
        //     // @ts-ignore
        //     this.opts,
        //     this.data.id
        // )

        const material = new MeshBasicMaterial({
            // polygonOffset: true,
            // polygonOffsetFactor: -2.0,
            // polygonOffsetUnits: -8.0,
            transparent: true,
            color: 0x328DFD,
            opacity: 0.3,
        })

        const geometry = new PlaneGeometry(1, 1);

        this.mesh = new PipeLineMesh(geometry, material, {

            occlusionMaterial: new MeshBasicMaterial({color: 0x000000}),

            visibilityOnMirror : false
        })

        this.mesh.position.z = 0.02

        this.add(this.mesh)

        this.selectionMesh = this.mesh

        const texture = await loader.loadImageTexture("/icons/cast.svg")

        const iconMaterial = new MeshBasicMaterial({
            polygonOffset: true,
            polygonOffsetFactor: -2.0,
            polygonOffsetUnits: -8.0,
            transparent: true,
            map: texture,
        })

        const iconGeo = new PlaneGeometry(1, 1);

        this.icon = new PipeLineMesh(iconGeo, iconMaterial, {

            occlusionMaterial: new MeshBasicMaterial({color: 0x000000}),

            visibilityOnMirror : false
        })

        this.mesh.add(this.icon)

        this.update3D()

        this.setEditMode(this.isEditMode)
    }

    update3D () {

        const { position, rotation, ratio, size, scaleCoefficient } = this.data

        this.position.set(position.x, position.y, position.z)

        this.rotation.set(rotation.x, rotation.y, rotation.z)

        const scale = size.x / scaleCoefficient

        this.scale.set(scale, scale / ratio.coef, 1)

        this.icon.scale.set(0.1, 0.1 * ratio.coef, 1)
    }

    updateCoords(opts) {
        //
        const { scaleCoefficient } = this.data

        const size = { x: this.scale.x * scaleCoefficient, y: this.scale.y * scaleCoefficient}

        this.props?.update(
            {
                position: { x: this.position.x, y: this.position.y, z: this.position.z },
                rotation: { x: this.rotation.x, y: this.rotation.y, z: this.rotation.z },
                size,
            },
            {
                isProgress: this.isDragging,
                ...opts
            }
        )
    }
    
    getGUI() {
    
        return {
            type: "group",
            children: this.props.meta,
        }
    }

    setEditMode(val) {

        super.setEditMode(val)

        this.mesh.visible = !!this.isEditMode
    }

}