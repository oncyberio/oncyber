// @ts-check

import { SpaceLabel } from "./oldspacelabel"

import { BillboardLabel } from "./billboardlabel"

import {
    Group,
    SpriteMaterial,
    CanvasTexture,
    Sprite,
    Vector3,
    Mesh,
    Object3D,
    MeshBasicMaterial,

    PlaneGeometry
} from "three"

import PipeLineMesh from '@3abstract/pipelinemesh'

import PipeLineSprite from "../../abstract/pipelinesprite"


class Label {

    constructor(opts) {

    }

    getLabel() {
        const material = new MeshBasicMaterial({
            map: new CanvasTexture(undefined),
            transparent: true,
            depthTest: false,
            depthWrite: false,
        })

        const geometry = new PlaneGeometry(1, 1)

        geometry.translate(0.5, 0, 0.0)

        const mesh = new PipeLineMesh( geometry, material,{
            visibleOnOcclusion: false
        })

        return new SpaceLabel({ mesh })
    }

    getBillboardLabel() {
        const material = new SpriteMaterial({
            map: new CanvasTexture(undefined),
            transparent: true,
            depthTest: false,
            depthWrite: false,
        })

        const mesh = new PipeLineSprite(  material,{
            visibleOnOcclusion: false
        })

        return new BillboardLabel({ mesh })
    }


    get(opts) {
        if (opts?.type === "billboard") {
            return this.getBillboardLabel()
        }

        return this.getLabel();
    }
}

export default new Label()

export { SpaceLabel } from "./oldspacelabel";

export { LABEL_STATES, MESSAGE_STATES, LABEL_ICONS } from "./constants"
