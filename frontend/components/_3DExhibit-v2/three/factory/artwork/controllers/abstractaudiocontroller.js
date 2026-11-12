
// @ts-check

import Emitter from '@3emitter'

import Events from '@3events'

import Scene from "@3scene"

import {

	DEBUG_AUDIO,

} from "@3constants"


import { disposeObject3D } from "@3/three/utils/three"

import { Object3D, Vector3 } from "three"

import VolumeRange from "@3factory/volumerange"


/**
 *
 * @typedef { object } AudioPlayer
 * + @property { () => void } play
 * + @property { () => void } pause
 * + @property { boolean } isPlaying
 * + @property { (vol: number) => unknown } setVolume
 *
 * @typedef { object } AbstractAudioControllerOpts
 *  + @property { Object3D } mesh
 *  + @property { number } volume
 *  + @property { AudioPlayer } [audioPlayer]
*/


export const AudioTypes = {
    LOOKAT: /** @type {const} */("lookat"),
    SPATIAL: /** @type {const} */("spatial"),
    CONSTANT: /** @type {const} */("constant")
}


export class AbstractAudioController {

    /**
     *
     * @param { AbstractAudioControllerOpts } opts
     */
    constructor(opts) {

        this.opts = opts

        this.isPaused = !opts.audioPlayer?.isPlaying

        this.mesh = opts.mesh

        this.audio = opts.audioPlayer

        this.volumeScale = 1.84

        this.audioPosition = new Vector3()

        this.volume = 0

        this.isOutsideAudioRange = null

        if(DEBUG_AUDIO) {

            this.showVolumeRange()
        }

        this.addEvents()

    }

    get audioType() {

        return this._audioType
    }

    /**
     * @param { import('@gltypes').AudioType } val
     */
    set audioType(val) {

        this._audioType = val
    }

    setAudioType(val) {

        this._audioType = val
    }

    get isBackground() {

        return this.audioType !== AudioTypes.LOOKAT
    }

    get muted() {

        return this._muted
    }

    set muted(isMuted) {

        this._muted = isMuted
    }

    /**
     *
     * @param {number} time
     */
    seek(time) {}


    /** @returns { number } */
    getCurrentTime() {

        return -1;
    }

    /** @param { number } volume */
    setVolume(volume) {

        this.volume = volume
    }

    showVolumeRange() {

        if (this.volumeRange == null) {

            this.volumeRange = VolumeRange.getAudioControllerRange({
                audioController: this,
                refObject: this.mesh,
                height: 9
            })

            Scene.add(this.volumeRange)
        }

        this.volumeRange.visible = true

    }

    hideVolumeRange() {

        if (this.volumeRange != null) {

            this.volumeRange.visible = false
        }
    }

    updateVolumeRange() {

        if(this.volumeRange?.visible) {

            this.volumeRange.position.x = this.audioPosition.x

            this.volumeRange.position.z = this.audioPosition.z

            this.volumeRange.scale.set(this.volume, 1, this.volume)
        }
    }

    update() {}

    updateWorldPosition () {

        this.mesh.getWorldPosition(this.audioPosition)
    }

    onUpdate = () => {

        this.updateWorldPosition()

        this.updateVolumeRange()

        this.update()
    }

    onStateChange() {

        if(this.audio == null) return

        if (!this.isWorldPaused && !this.isPaused ) {

            // console.log("AC/PLAY", this.audio.parent.userData.name)

            if(!this.audio.isPlaying) {

                this.audio.play()
            }
        }
        else {

            // console.log("AC/PAUSE", this.audio.parent.userData.name)

            if(this.audio.isPlaying) {

                this.audio.pause()
            }
        }
    }

    play() {

        if(!this.isPaused) return

        this.isPaused = false

        return this.onStateChange()
    }

    pause() {

        if (this.isPaused) return

        this.isPaused = true;

        this.onStateChange()
    }


    onPlay = () => {

        if(!this.enabled || this.wasDisposed) {

            console.error("[Potential memory leak] audioController.onPlay after dispose/removeEvents")

            return
        }

        this.isWorldPaused = false

        this.onStateChange()
    }

    onPause = () => {

        if(!this.enabled || this.wasDisposed) {

            console.error("[Potential memory leak] audioController.onPause after dispose/removeEvents")

            return
        }

        this.isWorldPaused = true

        this.onStateChange()
    }

    addEvents() {

        if(this.enabled) return

        this.enabled = true

        Emitter.on(Events.PLAY, this.onPlay)

        Emitter.on(Events.PAUSE, this.onPause)

        Emitter.on(Events.PRE_UPDATE, this.onUpdate)
    }

    removeEvents() {

        if(!this.enabled) return

        this.enabled = false


        Emitter.off(Events.PLAY, this.onPlay)

        Emitter.off(Events.PAUSE, this.onPause)

        Emitter.off(Events.PRE_UPDATE, this.onUpdate)
    }


    dispose() {

        if(this.wasDisposed) return

        this.wasDisposed = true

        this.removeEvents()

        if(this.volumeRange) {

            this.volumeRange.parent?.remove(this.volumeRange)

            disposeObject3D(this.volumeRange);

            this.volumeRange = null
        }
    }
}
