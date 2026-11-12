
// @ts-check

import Events from "@3events"

import { SpaceArtwork } from "@3artwork/abstract"

import { HtmlCanvasTexture } from "@3artwork/textures/htmlcanvastexture"

import { Mesh, MeshBasicMaterial } from "three"

import { disposeObject3D } from "@3utils/three"

import { artworkDepth } from "@components/_3DExhibit-v2/three/utils/spaceutils"


// Cap the canvas -> GPU texture upload for HTML/generative content to ~30fps.
const HTML_TEXTURE_FRAME_MS = 1000 / 30


export class HTMLSpaceArtwork extends SpaceArtwork {


    /**
     *
     * @param { import("@gltypes").HTMLArtworkOptions }  opts
     */
    constructor(opts) {

        super(opts)

        this.opts = opts

        if (opts.item.data.enableHTMLView) {

            this.enableHTMLView()
        }
    }

    async enableHTMLView() {

        if (this.isHtmlViewEnabled)

            return

        this.isHtmlViewEnabled = true

        if(this.opts.htmlText) {

            this.canvasTexture = new HtmlCanvasTexture(this.opts)

            this.htmlMesh = new Mesh(
                this.mesh.geometry,
                new MeshBasicMaterial({
                    map: this.canvasTexture,
                    polygonOffset: true,
                    polygonOffsetFactor: -2.0,
                    polygonOffsetUnits: -8.0,
                    transparent: true,
                })
            )

            let depth = artworkDepth(this.opts.roomParameters)

            this.htmlMesh.position.z += depth * 0.5;

            this.htmlMesh.visible = false

            this.add(this.htmlMesh)

            this.canvasTexture.htmlController.on(
                Events.HTML_PAUSED,
                this.onHTMLCanvasPaused
            )

            this.canvasTexture.htmlController.on(
                Events.HTML_PLAYING,
                this.onHTMLCanvasPlaying
            )
        }
    }

    disableHTMLView() {

        if (!this.isHtmlViewEnabled) return

        this.isHtmlViewEnabled = false

        this.canvasTexture.htmlController.off(
            Events.HTML_PAUSED,
            this.onHTMLCanvasPaused
        )

        this.canvasTexture.htmlController.off(
            Events.HTML_PLAYING,
            this.onHTMLCanvasPlaying
        )

        this.remove(this.htmlMesh)

        this.canvasTexture?.dispose()

        disposeObject3D(this.htmlMesh)

        this.htmlMesh = null

        this.canvasTexture = null

        this.mesh.visible = true
    }

    onHTMLCanvasPaused = () => {

        this.showPreviewMesh()
    }

    onHTMLCanvasPlaying = () => {

        this.showHTMLMesh()
    }

    toggleHTMLView(force = false) {

        let enableHTML = force || !this.isHtmlViewEnabled

        if (enableHTML) {

            this.enableHTMLView()
        }
        else {

            this.disableHTMLView()
        }
    }


    showPreviewMesh() {

        if(!this.mesh.visible) {

            this.mesh.visible = true

            this.htmlMesh.visible = false
        }
    }

    showHTMLMesh() {

        if(!this.htmlMesh.visible) {

            this.mesh.visible = false

            this.htmlMesh.visible = true
        }
    }

    update() {

        if(this.htmlMesh?.visible) {

            // Throttle the canvas -> GPU upload to ~30fps (the canvas itself only
            // redraws at ~30fps now, so uploading every render frame is wasted).
            const now = performance.now()

            if (now - (this._lastTextureUpdate || 0) >= HTML_TEXTURE_FRAME_MS) {

                this._lastTextureUpdate = now

                this.canvasTexture.needsUpdate = true
            }
        }
    }

    dispose() {

        if(this.wasDisposed) return

        this.canvasTexture?.dispose()

        if (this.htmlMesh) {

            disposeObject3D(this.htmlMesh)
        }

        super.dispose()

    }
}


