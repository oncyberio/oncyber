// @ts-check



import Events from "@3events"

import Emitter from "@3emitter"

import { IS_VR } from "@components/_3DExhibit-v2/three/constants"

import { CSSEmbedArtwork } from "../css/CSSembedartwork"

import { disposeObject3D } from "@components/_3DExhibit-v2/three/utils/three"
import { PlayController } from "../../controllers/PlayController"
import { Vector3 } from "three"


/** @type { CSSHTMLSpaceArtwork } */
let currentPlaying = null



export class CSSHTMLSpaceArtwork extends CSSEmbedArtwork {

    /**
     * @param { import("@gltypes").CSSHTMLArtworkOptions } opts
     */
    constructor(opts) {

        super(opts)

        this.opts = opts

        this._lookedatTime = Infinity

        this.checkPlaybackStateFPS = 3

        this.currentFrame = 0

        this.isPreviewMode = false

        this.isHtmlViewEnabled = false

        this.togglePreview(true)

        this.prevLookedAtPoint = new Vector3();



        if (opts.item.data.enableHTMLView) {

            this.enableHTMLView()
        }
        else {

            this.disableHTMLView()
        }

    }

    update() {

        if(!this.enabled || this.wasDisposed) {

            console.error("[Potential memory leak] HtmlCanvasTexture.update after dispose/removeEvents")

            return
        }

        if(!this.isHtmlViewEnabled || IS_VR) return

        this.currentFrame++

        if((this.currentFrame % this.checkPlaybackStateFPS) === 0) {

            this.updatePlaybackState()
        }


    }


    play() {

        if(currentPlaying !== this) {

            currentPlaying?.togglePreview(true)

            this.togglePreview(false)


            if(!this.isPreviewMode) {

                currentPlaying = this
            }
        }
    }

    pause() {

        if(currentPlaying === this) {

            this.togglePreview(true)

            if(currentPlaying === this) {

                currentPlaying = null
            }
        }

    }

    updatePlaybackState() {

        const artwork = this

        const now = performance.now()

        const isVisible = artwork.isVisibleToCamera



        if (!artwork.isLookedAt) {

            this._lookedatTime = Infinity;
        }
        else {

            if(currentPlaying === this) return

            // Just entered, starts counting looked at time
            if (this._lookedatTime === Infinity) {

                this._lookedatTime = now
            } else {

                // if camera is moving, then resets looked at time
                let movement = this.prevLookedAtPoint.distanceToSquared(artwork.lookedAtPoint)

                if (movement > 0.001 && this.isPreviewMode) this._lookedatTime = now
            }

            this.prevLookedAtPoint.copy(artwork.lookedAtPoint)
        }

        if (artwork.isLookedAt && now - this._lookedatTime > 300) {

            this.play()
        }
        else if (
            (!isVisible && !this.opts.foreverPlay) ||
            (currentPlaying !== this)
        ) {
            this.pause()
        }
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

    async enableHTMLView() {

        if (this.isHtmlViewEnabled)

            return

        this.isHtmlViewEnabled = true
    }

    disableHTMLView() {

        if (this.isHtmlViewEnabled === false) return

        this.isHtmlViewEnabled = false

        this.pause()
    }


    onVRSessionStart() {

        this.togglePreview(true)
    }

    onVRSessionEnd()  {

        this.togglePreview(false)
    }


    onWorldPlay() {

        if(this === currentPlaying) {

            this.togglePreview(false)
        }
    }

    onWorldPause()  {

        if(this === currentPlaying) {

            this.togglePreview(true)
        }
    }

    addEvents() {


        if(this.enabled) return

        this.enabled = true

        super.addEvents()

        this.onVRSessionStartEvent = this.onVRSessionStart.bind(this)

        this.onVRSessionEndEvent = this.onVRSessionEnd.bind(this)

        this.onWorldPlayEvent = this.onWorldPlay.bind(this)

        this.onWorldPauseEvent = this.onWorldPause.bind(this)

        Emitter.on(Events.VR_SESSION_START, this.onVRSessionStartEvent)

        Emitter.on(Events.VR_SESSION_END, this.onVRSessionEndEvent)

        Emitter.on(Events.PLAY, this.onWorldPlayEvent)

        Emitter.on(Events.PAUSE, this.onWorldPauseEvent)
    }

    removeEvents() {

        if(!this.enabled) return

        this.enabled = false

        super.removeEvents()

        Emitter.off(Events.VR_SESSION_START, this.onVRSessionStartEvent)

        Emitter.off(Events.VR_SESSION_END, this.onVRSessionEndEvent)

        Emitter.off(Events.PLAY, this.onWorldPlayEvent)

        Emitter.off(Events.PAUSE, this.onWorldPauseEvent)
    }



    dispose() {

        if(this.wasDisposed) return

        super.dispose()

        this.previewMesh.dispose()

        if(this.previewMesh) {

            disposeObject3D(this.previewMesh)
        }


        this.previewMesh = null
    }
}
