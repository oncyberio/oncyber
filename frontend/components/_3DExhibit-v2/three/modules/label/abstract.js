// @ts-check
import { Mesh, Sprite } from "three";

import { SpaceItem } from "../../factory/abstract/spaceitem";

import Emitter from '@3emitter'

import Events from '@3events'

import { IS_FIRST_PERSON } from "../../constants";


import Smoothstep from "../../utils/math/smoothstep";

import imageCache from "@3utils/imagecache"

const FontSize = 15

export class LabelAbstract extends SpaceItem {

   constructor(opts) {
        // @ts-ignore
        super({
            raycastMesh: opts.mesh
        })


        this.imageCache = {}

        /** @type { Mesh } */
        this.mesh = null

        /** @type { gsap.core.Tween } */
        this.tween = null

        this.isLabel = true

        this.sprite = opts.mesh


        /** @type { Sprite } */

        this.add(this.sprite)

        this.setVisible(false)

        this.opacity = 0

        this.renderOrder = 200

        this.currentIntersect = null

        this.intersects = [];

        this.elevatorLabel = false;

        this.canvas = document.createElement("canvas")

        this.ctx = this.canvas.getContext("2d")

        this.canvas.width = 512

        this.canvas.height = 512
   }

   setVisible( val ){

        if( val == true ) {

            this.addEvents()
        }

        else {

            this.removeEvents()
        }

        this.visible = val
    }



    addEvents(){

        if ( this.updateEvent == null ) {

            this.updateEvent = this.update.bind(this)

            Emitter.on(Events.PRE_UPDATE, this.updateEvent)
        }
    }

    removeEvents(){

        if ( this.updateEvent ){

            Emitter.off(Events.PRE_UPDATE, this.updateEvent)

            this.updateEvent = null
        }
    }


    update(){

    }

       /**
     * @param { string } text
     * @param { string } iconUrl
     * @param { boolean } [flipY]
     */
    async set(text, iconUrl = "", flipY = null) {

        const sprite = this.sprite

        let icon
        let fontSize = FontSize

        if (iconUrl) {
            icon = await this.getImage(iconUrl)
        }

        this.ctx.save()

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

        // debug
        // this.ctx.fillStyle = "orange"
        // this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

        this.ctx.font = `bold ${
            fontSize * 0.5
        }px/${fontSize}px 'SpaceGrotesk', Arial, sans-serif`
        this.ctx.textAlign = "left"
        this.ctx.textBaseline = "middle"

        const metrics = this.ctx.measureText(text)
        const width = metrics.width + fontSize * 1.25
        const scale = this.canvas.width / width

        this.ctx.translate(0, this.canvas.height * 0.5)
        this.ctx.scale(scale, scale)

        var mult = 1

        if(flipY != null ) {

            mult = flipY ? -1 : 1
        }

        else if( typeof(icon) == 'object' ) {

            mult = -1
        }

        this.ctx.save()

        this.ctx.scale(1, 1 * mult)

        // Draw Button Icon
        if (icon) {
            this.ctx.drawImage(icon, 0, -fontSize * 0.5 * mult, fontSize, fontSize * mult)
        }

        this.ctx.restore()

        // Write Text
        this.ctx.fillStyle = "white"
        this.ctx.fillText(text, iconUrl ? fontSize * 1.25 : 0, 0)

        this.ctx.restore()

        const texture = sprite.material.map
        texture.image = this.ctx.getImageData(0, 0, this.canvas.height, this.canvas.width)
        texture.generateMipmaps = true
        texture.needsUpdate = true
        sprite.material.needsUpdate = true

        sprite.scale.set(fontSize / scale, fontSize / scale, 1)

    }

    async getImage(url) {

        try {

            let img = this.imageCache[url]

            if(img == null) {

                img = await imageCache.loadImage(url, null, true)

                this.imageCache[url] = img
            }

            return img
        }
        catch(err) {

            console.error(err)

            return null
        }
    }

    attachLabelTo(mesh) {

    }

    hide() {

    }
}
