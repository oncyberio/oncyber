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

import { LABEL_CANVAS_SIZE } from "./constants"


/**
 * A label's texture before its text is drawn: transparent, and the size every
 * drawn label has. `set()` waits for its icon before drawing, and the label
 * can already be on screen by then. It used to start as a CanvasTexture with
 * no image, which the renderer throws on mid-frame; on WebGPU that left the
 * whole view black for good. The renderer keeps a texture's first size, so the
 * placeholder must match what `set()` uploads later.
 */
export function blankLabelTexture() {

    return new CanvasTexture(new ImageData(LABEL_CANVAS_SIZE, LABEL_CANVAS_SIZE))
}

class Label {

    constructor(opts) {

    }

    getLabel() {
        const material = new MeshBasicMaterial({
            map: blankLabelTexture(),
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
            map: blankLabelTexture(),
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
