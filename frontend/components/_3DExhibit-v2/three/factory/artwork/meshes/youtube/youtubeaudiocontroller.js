// @ts-check


import Camera 		from "@3camera"

import audioListener from "@3/three/globals/audioListener";

import {

    AUDIO_TYPES,
    CURRENT_SPACE,
	DEBUG_AUDIO
} from "@3constants"


import { YouTubeSpaceArtwork } from "./youtubespaceartwork"

import { AbstractAudioController } from "@3artwork/controllers/abstractaudiocontroller";

import { YoutubePlayer } from "./youtubeplayer";


const TRANSITION_DELAY = 0.25

const DECAY_FACTOR = 0.05


/**
 * @typedef { object } AudioControllerParams
 *  + @property { YouTubeSpaceArtwork } parent
 *  + @property { import("@gltypes").AudioType } audioType
 *  + @property { number } volume
 *  + @property {  import("@uitypes/roomParameters").RoomParameters } roomParameters
 *  + @property { YoutubePlayer } player
 *
*/



export class YoutubAudioController extends AbstractAudioController {

    /**
     * @param { AudioControllerParams } opts
     */
    static create(opts) {

        return new YoutubAudioController({
            ...opts,
            // @ts-ignore
            mesh: opts.parent.cssWrapper.glPlane,
        })
    }

    /**
     *
     * @param { import("../../controllers/abstractaudiocontroller").AbstractAudioControllerOpts & AudioControllerParams } opts
     */
    constructor(opts) {

        super(opts)

        this.opts = opts

        this.gain = audioListener.context.createGain()

        this.gain.connect(audioListener.getInput())

        this.currentDistance = 0

        this.refDistance = 0

        this.parent = opts.parent

        this.player = opts.player

        this.setAudioType(opts.audioType)

        this.setVolume(opts.volume)


        if(DEBUG_AUDIO) {

            this.showVolumeRange()
        }
    }

    /**
     * @param { import("@gltypes").AudioType } _audioType
     */
     setAudioType(_audioType) {

        if (_audioType === this._audioType) return

        if (_audioType === AUDIO_TYPES.LOOKAT) {

            this.setLookatAudio()

        }
        else if(_audioType === AUDIO_TYPES.SPATIAL) {

            this.setSpatialAudio()
        }
        else if(_audioType === AUDIO_TYPES.CONSTANT) {

            this.setConstantAudio()
        }

        this._audioType = _audioType
    }

    setLookatAudio() {

        this.player.volume = 50

        this.setVolume(1)

        this.muted = true
    }

    setSpatialAudio() {

        this.muted = false
        // resets the volume to a range = 2 x volumeSale
        this.setVolume(2)

        if (CURRENT_SPACE?.exhibit?.info?.customLink === "omsector0" || CURRENT_SPACE?.exhibit?.info?.customLink === "ommetacampus") {

            this.player.volume = this.volume * 50

            this.gain.gain.setValueAtTime(1, 0)
        }
        else {

            this.player.volume = 0

            this.gain.gain.setValueAtTime(0, 0)
        }
    }


    setConstantAudio() {

        this.muted = false

        this.player.volume = 50

        this.gain.gain.setValueAtTime(1, 0)
    }

    get isBackground() {

        return this._audioType !== AUDIO_TYPES.LOOKAT
    }


    get muted() {

        return this.player.muted
    }

    set muted(isMuted) {

       this.player.muted = isMuted
    }

    update() {

        if(!this.enabled || this.wasDisposed) {

            console.error("[Potential memory leak] audioController.update after dispose/removeEvents")

            return
        }

        if (
            this._audioType !== AUDIO_TYPES.SPATIAL ||
            !this.mesh.parent ||
            !audioListener.parent ||
            CURRENT_SPACE?.exhibit?.info?.customLink === "omsector0" ||
            CURRENT_SPACE?.exhibit?.info?.customLink === "ommetacampus"
        ) return

        this.refDistance = this.volume * this.volumeScale

        this.currentDistance = this.audioPosition.distanceTo(Camera.current.position)

        let diff = this.currentDistance - this.refDistance

        if (diff < 0) {

            this.isOutsideAudioRange = false

            let scaledDistance = this.currentDistance / this.volumeScale

            let decayedGain = Math.min(
                1,
                1 / (DECAY_FACTOR * scaledDistance * scaledDistance)
            )

            this.gain.gain.setTargetAtTime(
                decayedGain,
                audioListener.context.currentTime,
                TRANSITION_DELAY
            )
        } else {

            this.isOutsideAudioRange = true

            this.gain.gain.setTargetAtTime(
                0, //1 / (this.currentDistance * this.currentDistance),
                audioListener.context.currentTime,
                TRANSITION_DELAY
            )
        }

        this.player.volume = this.gain.gain.value * 50
    }


    dispose() {

        if(this.wasDisposed) return

        super.dispose()
    }
}
