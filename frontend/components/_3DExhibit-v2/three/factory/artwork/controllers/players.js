// @ts-check

import { USER_INTERACTED } from "@components/_3DExhibit-v2/three/constants"



export class StreamAudioPlayer {

    /**
     *
     * @param { MediaStream } stream
     */
    constructor(stream) {

        this.paused = true

        this.stream = stream

        this.audio = new Audio()

        this.audio.srcObject = stream
    }

    setStream(stream) {

        if(this.stream == stream) return
            
        if(this.stream) {

            this.audio.srcObject = null

            this.stream.getTracks().forEach(track => track.stop())
        }
    
        this.stream = stream

        this.audio.srcObject = stream
    }

    play() {

        this.paused = false

        return USER_INTERACTED.then(() => {
            //
            if(this.paused) return

            this.audio.play()
        });
    }

    pause() {

        this.paused = true

        this.audio.pause()
    }

    get isPlaying() {

        return !this.audio.paused
    }

    setVolume(vol) {

        this.audio.volume = vol
    }
}


export class MediaElementAudioPlayer {

    /**
     *
     * @param { HTMLMediaElement } media
     */
    constructor(media) {

        this.media = media
    }

    play() {

        this.media.play()
    }

    pause() {

        this.media.pause()
    }

    get isPlaying() {

        return this.media.paused
    }

    setVolume(vol) {

        this.media.volume = vol
    }
}
