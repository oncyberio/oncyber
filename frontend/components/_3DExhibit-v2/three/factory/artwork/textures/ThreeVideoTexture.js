
import { Texture, LinearFilter } from 'three';

import {

	PIPE_LINE_STATE

} from '@3constants'




export class ThreeVideoTexture extends Texture {

	constructor( video, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy ) {

		super( video, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy );
		this.isVideoTexture = true;

		this.minFilter = minFilter !== undefined ? minFilter : LinearFilter;
		this.magFilter = magFilter !== undefined ? magFilter : LinearFilter;

		this.generateMipmaps = false;

		this.requestVideoCallback = false

		this._videoTextureDisposed = false
		this._videoFrameCallbackId = null
		this._videoFrameCallbackSource = null
		this._onVideoFrame = this.updateWithCallback.bind(this)

		if (video && typeof video.requestVideoFrameCallback === 'function') {

			this.requestVideoCallback = true
			this._videoFrameCallbackSource = video
			this._videoFrameCallbackId = video.requestVideoFrameCallback(this._onVideoFrame)

		}
		else if (video && typeof requestAnimationFrame === 'function') {

			// WebGL called update() on every video texture each frame; WebGPU
			// never does. Without frame callbacks, poll once per frame instead.
			this._animationFrameId = requestAnimationFrame(this._onAnimationFrame)
		}


	}

	_onAnimationFrame = () => {

		this._animationFrameId = null

		if (this._videoTextureDisposed || this.wasDisposed) return

		this.update()

		this._animationFrameId = requestAnimationFrame(this._onAnimationFrame)
	}

	updateWithCallback(){


        this._videoFrameCallbackId = null

        if(this._videoTextureDisposed || this.wasDisposed) return

        const video = this.image

        if (!video || typeof video.requestVideoFrameCallback !== 'function') return

        this._videoFrameCallbackSource = video
        this._videoFrameCallbackId = video.requestVideoFrameCallback(this._onVideoFrame)

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

	/**
	 * WebGL re-allocated the texture on every upload; WebGPU keeps the size it
	 * was created with. When the video changes resolution (adaptive streams),
	 * release the GPU texture so the renderer re-creates it at the new size.
	 */
	set needsUpdate( value ) {

		if ( value === true ) this._syncVideoSize()

		super.needsUpdate = value
	}

	_syncVideoSize() {

		const video = this.image

		const width = video?.videoWidth

		const height = video?.videoHeight

		if ( ! width || ! height ) return

		const size = this._videoSize

		if ( size != null && ( size[ 0 ] !== width || size[ 1 ] !== height ) ) {

			this.dispatchEvent( { type: 'dispose' } )
		}

		this._videoSize = [ width, height ]
	}

	clone() {

		return new this.constructor( this.image ).copy( this );

	}

	update() {

		
		const video = this.image;

		if (this._videoTextureDisposed || this.wasDisposed || !video) return

		const hasVideoFrameCallback = typeof video.requestVideoFrameCallback === 'function';

		if ( hasVideoFrameCallback === false && video.readyState >= video.HAVE_CURRENT_DATA ) {

			this.needsUpdate = true;

		}

	}

	dispose() {

		// VideoTexture marks wasDisposed before calling this base cleanup.
		if (this._videoTextureDisposed) return

		this._videoTextureDisposed = true
		this.wasDisposed = true

		const video = this._videoFrameCallbackSource
		if (this._videoFrameCallbackId !== null && typeof video?.cancelVideoFrameCallback === 'function') {
			video.cancelVideoFrameCallback(this._videoFrameCallbackId)
		}

		this._videoFrameCallbackId = null
		this._videoFrameCallbackSource = null

		if (this._animationFrameId != null && typeof cancelAnimationFrame === 'function') {
			cancelAnimationFrame(this._animationFrameId)
		}

		this._animationFrameId = null

		super.dispose()

	}

}

