// @ts-check

import Emitter from '@3emitter'

import Events from '@3events'

import Camera from '@3camera'

import {

    EDIT_MODE,

    IS_RECORDING,

    MAX_PLAY_DISTANCE_SQ,

    USER_INTERACTED,

    VIDEO_PLAYBACK_TYPES

} from '@3constants'

import { noop } from '@utils/js'
import { releaseArtworkVideo } from '@utils/media/video'

import { Vector3 } from 'three'
import { SpaceArtwork } from '../abstract'


let frameStart = 0

export class VideoController {

    /**
     * @param { import("@gltypes").VideoControllerOptions } opts
     */
    constructor(opts) {

        this.video = opts.video

        this.mesh = opts.mesh

        this.videoPlayback = opts.videoPlayback || VIDEO_PLAYBACK_TYPES.AUTO

        this.isPaused = true

        this.isWorldPaused = null

        // Mute the video at start so that the playback request can succeed
        if(opts.video instanceof HTMLVideoElement && !opts.video.muted) {

            opts.video.muted = true

            USER_INTERACTED.then(() => {

                // Studio: keep videos muted — opening a space with several
                // video artworks otherwise blasts all of them at once.
                if (EDIT_MODE || this.wasDisposed || this.video !== opts.video) return

                opts.video.muted = false
            })
        }

        this.frame = frameStart++


    }

    async loadBlob() {

        const video = this.video
        if(this.wasDisposed || !(video instanceof HTMLVideoElement)) return

        this.blobLoadAbort?.abort()
        const abort = new AbortController()
        this.blobLoadAbort = abort

        try {
            const response = await fetch(video.src, { signal: abort.signal })
            const blob = await response.blob()
            if(abort.signal.aborted || this.wasDisposed || this.video !== video) return

            const url = window.URL.createObjectURL(blob)
            this.releaseBlobUrl()
            this.blobUrl = url
            video.src = url
            video.loop = true
            if(!this.isPaused) await this.onStateChange()
            // Preserve the existing capture settling time, but cancel it on exit.
            await new Promise(resolve => {
                const finish = () => {
                    clearTimeout(timer)
                    abort.signal.removeEventListener("abort", finish)
                    resolve()
                }
                const timer = setTimeout(finish, 1000)
                abort.signal.addEventListener("abort", finish, { once: true })
                if(abort.signal.aborted) finish()
            })
        } catch(error) {
            if(!abort.signal.aborted) console.error("Could not load video blob", error)
        } finally {
            if(this.blobLoadAbort === abort) this.blobLoadAbort = null
        }
    }

    releaseBlobUrl() {
        if(this.blobUrl) {
            window.URL.revokeObjectURL(this.blobUrl)
            this.blobUrl = null
        }
    }

    onPlay = () => {

        this.isWorldPaused = false

        this.onStateChange()
    }

    onPause = () => {

        this.isWorldPaused = true

        this.onStateChange()
    }

    async cinematic_seek(timer) {

        const video = this.video
        if(this.wasDisposed) return false

        if(video instanceof HTMLVideoElement)  {

            try {

                await video.play()

                if(this.wasDisposed || this.video !== video) return false

                timer = timer % video.duration

                await this._setHTMLVideoCurrentTime(video, timer)

                return !this.wasDisposed && this.video === video
            }
            catch(err) {

                console.error(err)

                return false
            }
        }
    }

    seek(timer) {

        if(this.wasDisposed || !this.video) return

        if(this.video instanceof HTMLVideoElement) {

            return this._setHTMLVideoCurrentTime(this.video, timer)
        }
        else {

            this.video.currentTime = timer
        }
    }

    getCurrentTime() {

        if(this.wasDisposed || !this.video || this.isPaused) return -1

        return this.video.currentTime
    }


    /**
     *
     * @param {HTMLVideoElement} video
     * @param {number} timer
     * @returns
     */
    pendingSeeks = new Set()

    cancelSeeks() {
        for(const finish of this.pendingSeeks) finish()
    }

    async _setHTMLVideoCurrentTime(video, timer) {

        if(this.wasDisposed || this.video !== video || video.paused || video.currentTime === timer) return

        return new Promise(resolve => {

            const finish = () => {
                video.removeEventListener("seeked", finish)
                this.pendingSeeks.delete(finish)
                resolve()
            }
            this.pendingSeeks.add(finish)
            video.addEventListener("seeked", finish, { once: true })

            video.currentTime = timer

        })
    }

    async onStateChange() {

        if(this.wasDisposed || !this.video) return

        if (!this.isWorldPaused && !this.isPaused && !IS_RECORDING ) {

            if(this.video.paused) {

                await this.video.play().catch(noop)
            }
        }
        else {

            if(!this.video.paused) {

                this.video.pause()
            }
        }

    }


    async play() {

        if(this.wasDisposed || !this.video || !this.isPaused) return

        this.isPaused = false

        // console.log("videoController/play", this.mesh.userData.name)

        return this.onStateChange()
    }

    async pause() {

        if (this.wasDisposed || !this.video || this.isPaused) return

        // console.log("videoController/pause", this.mesh.userData.name)

        this.isPaused = true;

        return this.onStateChange()
    }

    update = () => {


        this.frame++

        if(this.frame % 60 !== 0) return

        if(!this.enabled || this.wasDisposed) {

            console.error("[Potential memory leak] videoController.update after dispose/removeEvents")

            return
        }

        if(!this.video || !this.mesh || this.mesh.parent == null || this.videoPlayback !== VIDEO_PLAYBACK_TYPES.AUTO) return;

        /** @type { SpaceArtwork } */
        // @ts-ignore
        const artwork = this.mesh.parent

        let shouldPlay = artwork.isBackgroundAudio || this.isInPlayRange()

        if(shouldPlay) {

            this.play()
        }
        else {

            this.pause()
        }
    }

    artworkPosition = new Vector3()

    artworkDirection = new Vector3()

    cameraDirction = new Vector3()

    cameraToArtwork = new Vector3()



    isInPlayRange = () => {

        // 1- Frsutum test
        if(!Camera.isObjectVisible(this.mesh)) return false

        // console.log('is in range')


        // 2- Object in play range (to pause very far videos)
        this.artworkPosition.setFromMatrixPosition(this.mesh.matrixWorld)

        let distanceSq = Camera.current.position.distanceToSquared(this.artworkPosition)

        if( distanceSq > MAX_PLAY_DISTANCE_SQ) return false


        // 3- Object is facing the camera
        this.mesh.getWorldDirection(this.artworkDirection)

        Camera.current.getWorldDirection(this.cameraDirction)

        this.cameraToArtwork.subVectors( this.artworkPosition, Camera.current.position).normalize()

        const dot =  this.artworkDirection.dot( this.cameraToArtwork )

        return dot <= 0


    }

    /**
     *
     * @param { HTMLVideoElement } video
     */
    setVideo(video) {

        if(this.wasDisposed || !video || video === this.video) return

        const prevVideo = this.video
        this.blobLoadAbort?.abort()
        this.cancelSeeks()
        this.video = video
        video.currentTime = prevVideo?.currentTime || 0
        this.releaseVideo(prevVideo)
        this.releaseBlobUrl()

        if(!this.isPaused) {

            // play() rejects (unhandled) with "no supported source was found"
            // when the swapped-in source/codec isn't playable — swallow it like
            // the other play() call sites.
            this.video.play().catch(noop)
        }
    }

    addEvents() {

        // if(this.mesh.parent.wasDisposed) {
        //     throw new Error("videoController, addEvents called after dispose")
        // }

        if(this.wasDisposed || !this.video || this.enabled) return

        this.enabled = true

        // console.log("videoController.addEvents")

        Emitter.on(Events.PLAY, this.onPlay)

        Emitter.on(Events.PAUSE, this.onPause)

        Emitter.on(Events.PRE_UPDATE, this.update)
    }

    removeEvents() {

        this.enabled = false

        // console.log("videoController.removeEvents")

        Emitter.off(Events.PLAY, this.onPlay)

        Emitter.off(Events.PAUSE, this.onPause)

        Emitter.off(Events.PRE_UPDATE, this.update)
    }

    /**
     *
     * @param { { videoPlayback: import('@gltypes').VideoPlaybackType } } opts
     */
    updatePlaybackOptions(opts) {

        if(opts.videoPlayback === this.videoPlayback) return

        this.videoPlayback = opts.videoPlayback

        if(this.videoPlayback === VIDEO_PLAYBACK_TYPES.MANUAL) {

            this.pause()
        }
    }

    handleClick() {

        if(this.wasDisposed || !this.video) return

        if(this.videoPlayback === VIDEO_PLAYBACK_TYPES.AUTO) return

        this.isPaused = !this.isPaused

        this.onStateChange()
    }

    releaseVideo(video) {
        releaseArtworkVideo(video)
    }

    dispose() {

        if(this.wasDisposed) return

        this.wasDisposed = true
        this.isPaused = true
        const video = this.video
        // Detach first: queued playback callbacks must see a released controller.
        this.video = null
        this.mesh = null
        this.removeEvents()
        this.cancelSeeks()
        this.blobLoadAbort?.abort()
        this.blobLoadAbort = null
        this.releaseVideo(video)
        this.releaseBlobUrl()
    }
}
