// @ts-check


import { SpaceArtwork } from "@3artwork/abstract"


export class CSSEmbedArtwork extends SpaceArtwork {

    /**
     * @param { import("@gltypes").CSSEmbedOptions } opts
     */
    constructor(opts) {

        super(opts);


        this.cssWrapper = opts.cssWrapper

        this.cssObject = opts.cssWrapper.cssObject

        this.mesh = /** @type {import("@gltypes").IArtworkMesh} */ (opts.cssWrapper.glPlane)

        this.previewMesh = opts.previewMesh

        if (this.previewMesh) {

            this.previewMesh.visible = false

            this.add(this.previewMesh)
        }

        // @ts-ignore
        this.add(opts.cssWrapper.glPlane);

        this.add(opts.cssWrapper.glCache);

        this.element = this.cssObject.element

        this.iframe = opts.iframe

        this.onMatrixChanged(() => {

            this.cssObject.updateMatrixWorld(true)
        })

        // @ts-ignore
        // this.add(opts.mixedCSS.cssObject)
    }
        

    get enableCSSInteraction() {
        return true;
    }

    togglePreview(isPreviewMode) {

        if(this.isPreviewMode === isPreviewMode) return

        this.isPreviewMode = isPreviewMode

        if(isPreviewMode) {

            if(this.onLoadIframe) {

                this.iframe?.removeEventListener("load", this.onLoadIframe)
            }

            this.cssWrapper.remove()

            this.cssWrapper.glPlane.visible = false

            if (this.previewMesh) {

                this.previewMesh.visible = true
            }

        }
        else {

            this.iframe.style.visibility = "hidden"

            this.cssWrapper.add()

            this.onLoadIframe = () => {

                console.log("iframe loadeddddddddddd")

                this.iframe.style.visibility = "visible"

                this.cssWrapper.glPlane.visible = true

                if (this.previewMesh) {

                    this.previewMesh.visible = false
                }

            }

            this.iframe.addEventListener("load", this.onLoadIframe, { once: true })
        }

    }

    update(force) {

        const postProEnabled = 
            this.opts.roomParameters.usePostProcessing?.enabled
            // this.opts.roomParameters.lighting?.enabled

        this.togglePreview(postProEnabled)
    }

    dispose() {

        this.cssWrapper?.dispose()

        super.dispose()
    }
}
