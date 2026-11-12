
// @ts-check

import { EDIT_MODE, USER_INTERACTED } from "@components/_3DExhibit-v2/three/constants"



export class YoutubePlayer {

    constructor(opts) {

        this.player = opts.YTPlayer

        this._playerReady = false

        this._audioReady = false

        this._muted = true

        this._paused = true

        this._volume = 100

        this.player.addEventListener("onReady", () => {

            console.log("Youtubeeee ready", this)

            this._playerReady = true

            this.syncPlayback()

            USER_INTERACTED.then(() => {

                // Studio: keep videos muted — opening a space with several
                // video artworks otherwise blasts all of them at once.
                if (EDIT_MODE) return

                this.player.unMute()

                this._audioReady = true

                this.syncAudio()
            })

        })

        // this.player.addEventListener("onStateChange", this.onPlayerStateChange)
    }

    onPlayerStateChange = (event) => {

        console.log("video state change", event.data)

        if(event.data === 2 && !this._paused) {

            this._paused = true
        }
        else if(event.data === 1 && this._paused) {

            this._paused = false
        }
    }

    get paused() {

        return this._paused
    }

    /**
     * @returns { boolean }
     */
    get muted() {

        return this._muted
    }

    /**
     * @param { boolean } val
     */
    set muted(val) {

        if(this._muted === val) return

        this._muted = val

        if(!this._audioReady) return

        if(val) {

            this.player.mute()
        }
        else {

            this.player.unMute()

            this.player.setVolume(this._volume)
        }
    }

    /**
     * @returns { number }
     */
    get currentTime() {

        return this.player.getCurrentTime()
    }

    /**
     * @param { number } val
     */
    set currentTime(val) {

        this.player.seekTo(val, true)
    }

    /**
     * @returns { number }
     */
    get volume() {

        return this._volume
    }

    /**
     * @param { number } val
     */
    set volume(val) {

        if(this._volume === val) return

        this._volume = val

        if(!this._audioReady) return

        this.player.setVolume(val)
    }

    /**
     * @returns { string }
     */
    get src() {

        return this.player.getVideoUrl()
    }

    /**
     * @param { string } val
     */
    set src(val) {

        if(val === null) {

            this.player.stopVideo()
        }

        else {

            this.player.cueVideoByUrl(val)
        }
    }

    async play() {

        if(!this._paused) return

        this._paused = false

        if(!this._playerReady) return

        this.player.playVideo()
    }

    pause() {

        if(this._paused) return;

        this._paused = true

        if(!this._playerReady) return

        this.player.pauseVideo()
    }

    syncPlayback()  {

        if (this._paused) {

            this.player.pauseVideo()
        }

        else {

            this.player.playVideo()
        }
    }

    syncAudio() {

        if(this._muted) {

            this.player.mute()
        }
        else {

            this.player.unMute()
        }

        this.player.setVolume(this._volume)
    }
}
