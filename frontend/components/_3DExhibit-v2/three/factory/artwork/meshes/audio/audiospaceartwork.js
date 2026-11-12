// @ts-check

import { SpaceArtwork } from "@3artwork/abstract"

import { AudioController } from "@3artwork/controllers/audiocontroller"
import { EDITION_TRANSFORM_CONTROL, USER_INTERACTED } from "@components/_3DExhibit-v2/three/constants"
import loader from "@3loader"



export class AudioSpaceArtwork extends SpaceArtwork {

    /**
     * @param { import("@gltypes").AudioArtworkOptions } opts
     */
    constructor(opts) {

        super(opts)

        this.sourceUrl = opts.url

        this.coverImage = opts.coverImage

        this._audioController = new AudioController({
            volume: opts.item.volume || 1,
            audioType: opts.item.audioType,
            // @ts-ignore
            mesh: this.raycastMesh,
        })

        this.prefTransformControls = this.coverImage != null
            ? EDITION_TRANSFORM_CONTROL.TRANSFORM_SNAP
            : EDITION_TRANSFORM_CONTROL.TRANSFORM_3D

    }

    get renderMesh() {
        //
        return this.coverImage.renderMesh
    }

    async update() {

        if(!this.audioLoaded && this.userInteracted && this._audioController.isCloseToPlayRange()) {

            console.log("Audio in play range")

            this.audioLoaded = true

            const buffer = await loader.loadAudio(this.sourceUrl)

            this._audioController.setSource(buffer)

            this._audioController.play()
        }
    }

    get border() {

        return this.coverImage?.border
    }

    set border(val) {

        if(this.coverImage) {

            this.coverImage.border = val
        }
    }

    get instancedBorderOpts() {

        return this.coverImage?.instancedBorderOpts
    }

    set instancedBorderOpts(val) {

        if(this.coverImage) {

            this.coverImage.instancedBorderOpts = val
        }
    }


    setBorder() {

        this.coverImage?.setBorder()
    }

    dispose() {

        this._audioController.dispose()

        super.dispose()
    }

}
