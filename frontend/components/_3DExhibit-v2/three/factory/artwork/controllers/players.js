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


/**
 * A voice the engine cannot hold: in the site's frame the page plays every
 * voice (features/worlds/relayedVoice), so the engine is given a handle in
 * place of a stream and its volume for that voice goes to the page.
 */
export class RelayedAudioPlayer {

    /**
     *
     * @param { { relayedVoice: true, setVolume(volume: number): void } } voice
     */
    constructor(voice) {

        this.paused = true

        this.volume = 0

        this.stream = voice
    }

    setStream(voice) {

        if (this.stream === voice) return

        this.stream?.setVolume(0)

        this.stream = voice

        this.apply()
    }

    apply() {

        this.stream?.setVolume(this.paused ? 0 : this.volume)
    }

    play() {

        this.paused = false

        this.apply()
    }

    pause() {

        this.paused = true

        this.apply()
    }

    get isPlaying() {

        return !this.paused
    }

    setVolume(vol) {

        this.volume = vol

        this.apply()
    }
}

/** The player for a voice: the stream itself, or the page's handle for it. */
export function voiceAudioPlayer(stream) {

    return stream?.relayedVoice
        ? new RelayedAudioPlayer(stream)
        : new StreamAudioPlayer(stream)
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
