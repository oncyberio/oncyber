// @ts-check

import {

	DEBUG_AUDIO,

} from "@3constants"

import Camera 		from "@3camera"

import audioListener from "@3/three/globals/audioListener";

import { AbstractAudioController } from "./abstractaudiocontroller";



const TRANSITION_DELAY = 0.25

/**
 * @typedef { import("./abstractaudiocontroller").AbstractAudioControllerOpts & { rolloffFactor?: number } } PseudoAudioControllerOpts
 */

export class PseudoAudioController extends AbstractAudioController {

    /**
     *
     * @param { PseudoAudioControllerOpts } opts
     */
    constructor(opts) {

        super(opts)

        // this.volumeScale = opts.roomParameters.user_height / 1.25

        this.gain = audioListener.context.createGain()

        this.gain.connect(audioListener.getInput())

        this.currentDistance = 0

        this.rolloffFactor = opts.rolloffFactor || 1

        this.enabled = true

        this.setVolume(opts.volume)
    }


    setVolume(volume) {

        super.setVolume(volume)

        this.refDistance = this.volume * this.volumeScale
    }


    /**
     *
     * @param { number } distance
     * @returns { number }
     */
    calcGainInverseModel(distance) {

        return this.refDistance / (this.refDistance + this.rolloffFactor * (Math.max(distance, this.refDistance) - this.refDistance))
    }

    showVolumeRange() {

        if(DEBUG_AUDIO) {

            super.showVolumeRange()
        }
    }


    update() {

        if(!this.enabled || this.wasDisposed) {

            console.error("[Potential memory leak] audioController.update after dispose/removeEvents")

            return
        }

        if (!audioListener.parent) return

        if(DEBUG_AUDIO) {

            this.updateVolumeRange()
        }

        this.currentDistance = this.audioPosition.distanceTo(audioListener.parent.position)

        let decayedGain = this.calcGainInverseModel(this.currentDistance)

        this.gain.gain.setTargetAtTime(
            decayedGain,
            audioListener.context.currentTime,
            TRANSITION_DELAY
        )

        this.audio.setVolume(this.gain.gain.value)
    }


    disable() {

        this.removeEvents()

        this.pause()

        this.hideVolumeRange()
    }


    enable() {

        this.addEvents()

        this.play()

        this.showVolumeRange()
    }

    dispose() {

        this.wasDisposed = true

        super.dispose()

        this.disable()

        // a node connected to the listener input is kept alive by the
        // audio graph; without this every enable/disable cycle leaks one
        this.gain.disconnect()

        this.opts = null
    }
}
