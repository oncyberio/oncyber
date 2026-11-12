
// @ts-check

import { MeshBasicMaterial, Object3D } from "three";

import { VideoTexture } from "@3artwork/textures/videotexture";


export class VideoMaterial extends MeshBasicMaterial {

    /**
     * @typedef {object} VideoTextureSpecOpts
     * @property {HTMLVideoElement} video
     * @property {Object3D} mesh
     *
     * @param {{ materialParams: object, videoOpts: VideoTextureSpecOpts & import("@gltypes").ArtworkOptions }} opts
     */
    constructor(opts) {

        super(opts.materialParams)

        this.video = opts.videoOpts.video

        this.videoOpts = opts

        this.videoTexture = new VideoTexture(opts.videoOpts)

        this.map = this.videoTexture

        this.videoTexture.initControllers()
    }

    /** @return { { width: number, height: number } } */
    get dimensions() {

        return {
            width: this.video.videoWidth || this.videoOpts.videoOpts.item.data.dimensions?.[0] || 960,
            height: this.video.videoHeight || this.videoOpts.videoOpts.item.data.dimensions?.[1] || 540,
        }
    }

    get videoController() {

        return this.videoTexture.videoController
    }

    get audioController() {

        return this.videoTexture.audioController
    }

    /** @return boolean */
    get active() {

        return this._active
    }

    /**
     * @param { boolean } val
     */
    set active(val) {

        this._active = val

        if(val) {

            this.enableControllers()
        }
        else {

            this.disableControllers()
        }
    }

    disableControllers() {

        this.videoController?.pause()

        this.videoController?.removeEvents()

        this.audioController?.pause()

        this.audioController?.removeEvents()
    }

    enableControllers() {

        this.videoController?.addEvents()

        this.audioController?.addEvents()

        this.audioController?.play()
    }


    updateMedia(opts) {

        const prevTexture = this.videoTexture

        const newTexture = new VideoTexture({
            ...this.videoOpts,
            ...opts
        })

        newTexture.videoController = prevTexture.videoController

        newTexture.audioController = prevTexture.audioController


        newTexture.videoController?.setVideo(opts.video)

        newTexture.audioController?.setSource(opts.video)

        this.videoTexture = this.map = newTexture

        this.needsUpdate = true

        this.videoTexture.needsUpdate = true


        prevTexture.videoController = null

        prevTexture.audioController = null

        prevTexture.dispose()

    }

}
