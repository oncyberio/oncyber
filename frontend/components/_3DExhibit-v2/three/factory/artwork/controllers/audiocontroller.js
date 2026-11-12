// @ts-check

/**
 * @typedef { object } AudioControllerParams
 *  + @property { Object3D } mesh
 *  + @property { import("@gltypes").AudioType } audioType
 *  + @property { number } volume
 *  + @property { AudioBuffer | HTMLMediaElement | MediaStream | MediaStreamAudioSourceNode } [source]
 *
*/

import { Audio, Object3D, PositionalAudio } from "three";

import audioListener from "@3gl/globals/audioListener";

import { AbstractAudioController } from "./abstractaudiocontroller";

import { AUDIO_TYPES, LOAD_AUDIO_CLOSE_DIST } from "@3constants";



const TRANSITION_DELAY = 0.25

const DECAY_FACTOR = 0.05



export class AudioController extends AbstractAudioController {

    /**
     * @param { AudioControllerParams } opts
     */
    constructor(opts) {

        super({
            ...opts,
        })

        this.opts = opts


        this.audio = new PositionalAudio(audioListener)

        this.spatialGain = this.audio.context.createGain()

        this.audio.setFilter(this.spatialGain)


        this.mesh = opts.mesh

        this.isPaused = true

        this.isWorldPaused = null

        this.setSource(opts.source)

        this.setAudioType(opts.audioType)

        this.setVolume(opts.volume)
    }

    /**
     *
     * @param { AudioBuffer | HTMLMediaElement | AudioNode | MediaStream } source
     */
    setSource(source) {

        if(this.source != null) {

            Audio.prototype.disconnect.call(this.audio)
        }

        this.source = source

        this.connectSource()
    }

    connectSource() {

        if(this.source == null || this.audio == null) return


        if(this.source instanceof AudioBuffer) {

            this.audio.setBuffer(this.source)

            this.audio.setLoop(true)

            this.audio.loop = true

            if(this.audio.isPlaying) {

                this.audio.pause()

                this.audio.play()
            }
        }
        else if(this.source instanceof HTMLMediaElement) {

            this.audio.setMediaElementSource(this.source)

            this.mediaNode = this.audio.source
        }
        else if(this.source instanceof MediaStream) {

            this.audio.setMediaStreamSource(this.source)

            this.mediaNode = this.audio.source
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

        this.mesh.add(this.audio)

        this._audioType = _audioType
    }

    setLookatAudio() {

        this.setVolume(1)

        this.audio.setDistanceModel("inverse")

        this.audio.setRefDistance(1)

        this.spatialGain.gain.setValueAtTime(1, 0);

        this.muted = true
    }

    setSpatialAudio() {

        this.setVolume(2)

        this.audio.setDistanceModel("linear")

        this.audio.setRefDistance(1)

        this.audio.setMaxDistance(10_000_000)

        this.muted = false

        this.spatialGain.gain.setValueAtTime(0, 0);
    }

    setConstantAudio() {

        this.setVolume(1)

        this.audio.setDistanceModel("linear")

        this.audio.setRefDistance(1)

        this.audio.setMaxDistance(10_000_000)

        this.spatialGain.gain.setValueAtTime(1, 0);

        this.muted = false
    }

    /** @param { number } volume */
    setVolume(volume) {

        this.volume = volume

        this.audio.setRefDistance(this.volume * this.volumeScale);
    }

    get muted() {

        return this._muted
    }

    set muted(isMuted) {

        if (this._muted !== isMuted) {

            this._muted = isMuted

            const volume = isMuted ? 0 : 1

            this.audio.setVolume(volume)
        }
    }

    /**
     *
     * @param {number} time
     */
    seek(time) {

        if(this.isPaused || !this.audio.hasPlaybackControl ) return

        this.audio.stop().setLoopStart(time)

        this.audio.play()
    }

    getCurrentTime() {

        if(this.isPaused || !this.audio.hasPlaybackControl ) return -1

        const audio = this.audio

        // @ts-ignore
        let progress = audio._progress + Math.max( audio.context.currentTime - audio._startedAt, 0 ) * audio.playbackRate;

        if ( audio.loop === true ) {

            // ensure _progress does not exceed duration with looped audios

            progress = progress % ( audio.duration || audio.buffer.duration );

        }

        return progress
    }


    isCloseToPlayRange() {

        this.updateWorldPosition()

        const refDistance = this.volume * this.volumeScale

        const currentDistance = this.audioPosition.setY(audioListener.parent.position.y).distanceTo(audioListener.parent.position)

        return currentDistance <= refDistance + LOAD_AUDIO_CLOSE_DIST
    }


    update = () => {

        if(!this.enabled || this.wasDisposed) {

            console.error("[Potential memory leak] audioController.update after dispose/removeEvents")

            return
        }

        if (
            this._audioType !== AUDIO_TYPES.SPATIAL ||
            !this.mesh.parent ||
            !audioListener.parent ||
            this.isPaused ||
            this.isWorldPaused ||
            this._muted ||
            this.audio.context.state != "running"
        ) return




        const refDistance = this.volume * this.volumeScale

        const currentDistance = this.audioPosition.distanceTo(audioListener.parent.position)

        let diff = currentDistance - refDistance

        if (diff < 0) {

            this.isOutsideAudioRange = false

            let scaledDistance = currentDistance / this.volumeScale

            let decayedGain = Math.min(
                1,
                1 / (DECAY_FACTOR * scaledDistance * scaledDistance)
            )

            this.spatialGain.gain.setTargetAtTime(
                decayedGain,
                this.audio.context.currentTime,
                TRANSITION_DELAY
            )
        } else {

            this.isOutsideAudioRange = true

            this.spatialGain.gain.setTargetAtTime(
                0, //1 / (this.currentDistance * this.currentDistance),
                this.audio.context.currentTime,
                TRANSITION_DELAY
            )
        }
    }


    disposeAudio() {

        if(this.audio.source != null) {

            // this.audio.disconnect()
            Audio.prototype.disconnect.call(this.audio)

            this.audio.stop()
        }


        this.audio.parent?.remove(this.audio)

        if(this.spatialGain != null) {

            this.spatialGain.disconnect()

            this.spatialGain = null
        }

        this.audio = null
    }

    dispose() {

        if(this.wasDisposed) return

        super.dispose()

        this.opts = null

        this.mesh = null

        this.disposeAudio()
    }
}
