// @ts-check

import { CanvasTexture, SRGBColorSpace } from "three"

import Events from "@3events"

import { HTMLCanvasController } from "../controllers/htmlcanvascontroller"



export class HtmlCanvasTexture extends CanvasTexture {


    /**
     *
     * @param { import("@gltypes").HTMLArtworkOptions } opts
     */
    constructor(opts) {

        super(null)

        this.opts = opts

        this.colorSpace = SRGBColorSpace

        this.htmlController = new HTMLCanvasController(this.opts)

        this.htmlController.on(Events.HTML_PLAYING, this.onHTMLPlaying)

        this.htmlController.on(Events.HTML_PAUSED, this.onHTMLPaused)
    }

    /**
     * Nothing to upload while paused (no canvas). WebGPU also keeps the size a
     * texture was created with: when the art's canvas changes size, release
     * the GPU texture so the renderer re-creates it at the new size.
     */
    set needsUpdate(value) {

        const image = this.image

        if (value === true) {

            if (image == null) return

            const size = this._uploadSize

            if (size != null && (size[0] !== image.width || size[1] !== image.height)) {

                this.dispatchEvent({ type: "dispose" })
            }

            this._uploadSize = [image.width, image.height]
        }

        super.needsUpdate = value
    }

    onHTMLPlaying = ({ canvas }) => {

        this.image = canvas
    }

    onHTMLPaused = () => {

        this.image = null
    }

    dispose() {

        if(this.wasDisposed) return

        this.wasDisposed = true

        this.htmlController.off(Events.HTML_PAUSED, this.onHTMLPaused)

        this.htmlController.off(Events.HTML_PAUSED, this.onHTMLPaused)

        this.opts = null

        this.htmlController?.dispose()

        this.htmlController = null

        super.dispose()

    }

}

