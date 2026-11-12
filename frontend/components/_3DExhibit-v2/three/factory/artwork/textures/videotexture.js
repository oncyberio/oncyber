// @ts-check

import {

    PIPE_LINE_STATE

} from '@3constants'

import { SRGBColorSpace } from "three"

import { VideoController } from "@3factory/artwork/controllers/videocontroller"

import { AudioController } from "@3factory/artwork/controllers/audiocontroller"

import { ThreeVideoTexture } from "./ThreeVideoTexture"
import { releaseArtworkVideo } from "@utils/media/video"

import { getCurrentSpaceVoiceRange } from "@components/_3DExhibit-v2/three/utils/spaceutils"
import { VOICE_ROLLOFF_FACTOR } from "@components/_3DExhibit-v2/three/constants"
import { PseudoAudioController } from "../controllers/pseudoaudiocontroller"
import { MediaElementAudioPlayer } from "../controllers/players"

import Renderer from '@3renderer'

window.rrr = Renderer

export class VideoTexture extends ThreeVideoTexture {


    /**
     *
     * @param { import("@gltypes").VideoTextureOptions } opts
     */
    constructor(opts) {

        super(opts.video)

        this.opts = opts

        this.video = opts.video

        this.colorSpace = SRGBColorSpace

        this.hasFirstUpdate = false

        this.renderFrame = -1
    }

    initControllers() {

        const opts = this.opts

        this.videoController = new VideoController({
            ...opts,
            videoPlayback: opts.item.videoPlayback
        })

        this.audioController =  new AudioController({
            volume: opts.item.volume || 1,
            audioType: opts.item.audioType,
            mesh: opts.mesh,
            source: opts.video
        })

    }

    update() {

        // handled somewhere else

        // console.log(this.requestVideoCallback)

        if( this.requestVideoCallback ){

            return 
        }

        // console.log( PIPE_LINE_STATE )

        if(this.wasDisposed) return

        const video = this.image

        if (!video) return

        if( PIPE_LINE_STATE.MIRROR == true || PIPE_LINE_STATE.OCCLUSION == true ) {

            return
        }


        if (this.hasFirstUpdate && (video.paused || video.ended)) {

            this.needsUpdate = false

            return
        }

        if ( video.readyState >= video.HAVE_CURRENT_DATA ) {

            this.hasFirstUpdate = true

			this.needsUpdate = true
		}
    }

    dispose() {

        if(this.wasDisposed) return

        this.wasDisposed = true

        this.opts = null

        if (this.videoController) this.videoController.dispose()
        else releaseArtworkVideo(this.video)

        this.audioController?.dispose()

        this.video = null

        this.videoController = null

        this.audioController = null

        super.dispose()

    }

}

