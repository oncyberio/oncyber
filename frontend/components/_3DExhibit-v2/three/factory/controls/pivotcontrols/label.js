// @ts-check


import {
    Group,
    SpriteMaterial,
    CanvasTexture,
    Sprite,
    Vector3,
    Mesh,
    Object3D,
} from "three"




const tmpVec3 = new Vector3()

const FONT_SIZE = 11

const canvas = document.createElement("canvas")

canvas.width = 512

canvas.height = 512

import PipeLineSprite from '@3abstract/pipelinesprite'

export class ControlsLabel extends Group {


    constructor() {

        super()

        this.mesh = null



        const texture = new CanvasTexture(canvas)

        texture.generateMipmaps = true

        texture.needsUpdate = true

        const material = new SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        })


        /** @type { Sprite } */
        this.sprite = new PipeLineSprite(material, {

            visibleOnDiffuse   : true,

            visibleOnOcclusion : false,

            visibleOnMirror    : false
        })

        this.sprite.renderOrder = 1_000_000_000

        this.add(this.sprite)

        this.visible = false
    }


    /**
     * @param { string } text
     */
    set(text) {

        const ctx = canvas.getContext("2d")

        // ctx.fillStyle = "orange"
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const fontSize = FONT_SIZE

        ctx.font = `bold ${
            fontSize * 0.5
        }px/${fontSize}px 'Aeonik', Arial, sans-serif`
        ctx.textAlign = "left"
        ctx.textBaseline = "middle"

        const metrics = ctx.measureText(text)
        const width = metrics.width + fontSize * 1.25
        const height = (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent)
        const scale = canvas.width / width

        ctx.save()
        ctx.translate(0, canvas.height * 0.5)

        ctx.scale(scale, scale)

        // ctx.fillStyle = "orange"
        // ctx.fillRect(0, -metrics.actualBoundingBoxAscent, metrics.width,  height)

        // Write Text
        ctx.fillStyle = "white"
        
        ctx.fillText(text, 0, 0)

        ctx.restore()

    }

    updateMatrixWorld(force) {

        this.sprite.material.map.needsUpdate = true

        if(this.mesh?.geometry) {

            this.mesh.getWorldQuaternion(this.quaternion)

            this.mesh.getWorldPosition(this.position)

            if(this.mesh.geometry.boundingBox == null) {

                this.mesh.geometry.computeBoundingBox()
            }

            const bb = this.mesh.geometry.boundingBox

            // this.translateX(this.mesh.geometry.boundingBox.max.x - 0.6)
        }

        super.updateMatrixWorld(force)
    }


    attachTo(mesh) {

        this.mesh = mesh
    }

    dispose() {


        // disposeObject3D(this);

        // if (this.parent) {

        //     this.parent.remove(this);
        // }
    }
}
