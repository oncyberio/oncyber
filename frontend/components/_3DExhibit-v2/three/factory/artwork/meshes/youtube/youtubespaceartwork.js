// @ts-check


import Loader from "@3loader"

import Events from "@3events"

import Emitter from "@3emitter"

import { IS_VR, VIDEO_PLAYBACK_TYPES } from "@components/_3DExhibit-v2/three/constants"

import { LinearFilter, LinearMipmapLinearFilter, Mesh, MeshBasicMaterial, SRGBColorSpace, Texture } from "three"

import { CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer.js"

import { VideoController } from "../../controllers/videocontroller"

import { CSSEmbedArtwork } from "../css/CSSembedartwork"

import { YoutubAudioController } from "./youtubeaudiocontroller"

import { YoutubePlayer } from "./youtubeplayer"

import { disposeObject3D } from "@components/_3DExhibit-v2/three/utils/three"

import { nodeEnv } from "@env"




export class YouTubeSpaceArtwork extends CSSEmbedArtwork {

    /**
     * @param { import("@gltypes").CSSEmbedOptions } opts
     */
    constructor(opts) {

        super(opts)

        this.isPreviewMode = false

        /** @type { CSS3DObject } */
        const object = this.cssObject

        const iframe = object.element.children[0]

        // @ts-ignore
        iframe.onload = () => {

            if(this.wasDisposed || this.opts.abort?.aborted) return

            // @ts-ignore
            const YTPlayer = new YT.Player(iframe)

            this.video = new YoutubePlayer({ YTPlayer })

            this._videoController = new VideoController({
                video: this.video,
                videoPlayback: opts.item.videoPlayback,
                mesh: this.mesh
            })

            this._audioController = YoutubAudioController.create({
                parent: this,
                player: this.video,
                audioType: opts.item.data.audioType,
                volume: opts.item.data.volume,
                roomParameters: opts.roomParameters
            })

            this._videoController.addEvents();

            this.emit(Events.MEDIA_PLAYER_READY)

        }

        this.togglePreview(IS_VR)

    }


    get enableCSSInteraction() {

        return this.videoController.videoPlayback === VIDEO_PLAYBACK_TYPES.MANUAL
    }

    _isPaused = false

    togglePlay() {

        if(this._videoController == null) return

        this._isPaused = !this._isPaused

        if(this._isPaused) {

            this._videoController.pause()

            this._videoController.removeEvents()
        }
        else {

            this._videoController.play()

            this._videoController.addEvents()
        }
    }

    /**
     *
     * @param { import("@uitypes/Asset").YTOptions } opts
     */
    updatePlaybackOptions(opts) {

        console.log("Youtube update options", opts)
    }


    async togglePreview(isPreviewMode) {

        if(this.isPreviewMode === isPreviewMode) return

        console.log("Youtube toggle preview", isPreviewMode)

        this.isPreviewMode = isPreviewMode

        if(isPreviewMode) {

            if(this.previewMesh == null) {

                await this.createPreviewMesh()

                if(this.wasDisposed ) return
            }
        }

        this.cssWrapper.glPlane.visible = !this.isPreviewMode

        if (this.previewMesh) {

            this.previewMesh.visible = this.isPreviewMode
        }
    }

    async createPreviewMesh() {

        if(this.previewMesh) return this.previewMesh

        if (this._previewMeshPromise == null) {

            this._previewMeshPromise = this._createPreviewMeshImpl()
        }

        return this._previewMeshPromise
    }


    async _createPreviewMeshImpl() {

        const image = await Loader.loadImage(
            [
                nodeEnv.POLAR_SAMA + this.opts.item.data.image_url
            ],
            this.opts.abort
        )

        if(this.wasDisposed) return


        if(image == null) {

            console.error("Failed to load youtube preview image")

            return
        }

        if(this.wasDisposed) return

        const texture = new Texture(image)

        texture.colorSpace = SRGBColorSpace
        texture.minFilter = LinearMipmapLinearFilter
        texture.magFilter = LinearFilter
        texture.generateMipmaps = true;
        texture.needsUpdate = true


        const glPlane = this.cssWrapper.glPlane

        this.previewMesh = new Mesh(
            glPlane.geometry,
            new MeshBasicMaterial({
                map: texture,
                polygonOffset: true,
                polygonOffsetFactor: -2.0,
                polygonOffsetUnits: -8.0,
                transparent: false
            })
        )

        this.previewMesh.position.copy(glPlane.position)

        this.previewMesh.quaternion.copy(glPlane.quaternion)

        this.previewMesh.scale.copy(glPlane.scale)

        this.add(this.previewMesh)

    }

    onVRSessionStart () {

        this.togglePreview(true)
    }

    onVRSessionEnd () {

        this.togglePreview(false)
    }


    addEvents() {

        super.addEvents()

        if(this.vrSessionStartEvent == null) {

            this.vrSessionStartEvent = this.onVRSessionStart.bind(this)

            Emitter.on(Events.VR_SESSION_START, this.vrSessionStartEvent)

        }

        if(this.vrSessionEndEvent == null) {

            this.vrSessionEndEvent = this.onVRSessionEnd.bind(this)

            Emitter.on(Events.VR_SESSION_END, this.vrSessionEndEvent)

        }
    }

    removeEvents() {

        super.removeEvents()

        if(this.vrSessionStartEvent) {

            Emitter.off(Events.VR_SESSION_START, this.vrSessionStartEvent)
        }

        if(this.vrSessionEndEvent) {

            Emitter.off(Events.VR_SESSION_END, this.vrSessionEndEvent)
        }
    }



    dispose() {

        if(this.wasDisposed) return

        if(this._videoController != null) {

            this._videoController.dispose();

            this._videoController = null
        }

        super.dispose()

        if(this.previewMesh) {

            disposeObject3D(this.previewMesh)
        }
    }
}
