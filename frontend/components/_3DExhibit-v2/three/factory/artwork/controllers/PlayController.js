// @ts-check

import Emitter from '@3emitter'

import Events from '@3events'

import Camera from '@3camera'

import {

    IS_RECORDING,

} from '@3constants'

export class PlayController {

    /**
     * @param { import("@gltypes").PlayControllerOptions } opts
     */
    constructor(opts) {

        this.isGlobal = opts.isGlobal

        this.noUpdate = opts.noUpdate

        this.media = opts.media

        this.artwork = opts.artwork

        this.roomParameters = opts.roomParameters

        this.isPaused = true

        this.isWorldPaused = null

        this.addEvents()
    }

    onPlay = () => {

        this.isWorldPaused = false

        this.onStateChange()
    }

    onPause = () => {

        this.isWorldPaused = true

        this.onStateChange()
    }

    onStateChange() {

        if (!this.isWorldPaused && !this.isPaused) {

            this.media.play()
        }
        else {

            this.media.pause()
        }
    }


    async play() {

        if(!this.isPaused) return

        this.isPaused = false

        // console.log("play", this.media)

        return this.onStateChange()
    }

    async pause() {

        if (this.isPaused) return

        // console.log("pause", this.media)

        this.isPaused = true;

        this.onStateChange()
    }



    update = () => {

        let shouldPlay = this.isGlobal || (this.artwork.isVisibleToCamera &&  this.artwork.inPlayRange())

        if(shouldPlay) {

            this.play()
        }
        else {

            this.pause()
        }
    }


    addEvents() {

        Emitter.on(Events.PLAY, this.onPlay)

        Emitter.on(Events.PAUSE, this.onPause)

        Emitter.on(Events.PRE_UPDATE, this.update)
    }

    removeEvents() {

        Emitter.off(Events.PLAY, this.onPlay)

        Emitter.off(Events.PAUSE, this.onPause)

        Emitter.off(Events.PRE_UPDATE, this.update)
    }

    dispose() {

        this.removeEvents()

        this.media.pause()
    }
}
