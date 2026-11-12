import {

	CANVAS,

	DEBUG,

	IS_RECORDING,

	SET_IS_RECORDING,

	VIEW,

	DPI,

	RECORD_FPS,

	CINEMATIC

} from '@3constants'

import Emitter 		from '@3emitter'

import Events 		from '@3events'

import Mediator 	from '@3mediator'

import Renderer 	from '@3renderer'

import gsap 		from 'gsap'


import Scene 		from '@3scene'

import Camera from '@3camera'

import loadMP4Module, { isWebCodecsSupported } from "@3utils/mp4wasm.js";

import {

	RECORD_SIZE,

	CURRENT_SPACE,

	UPLOADER_MODE

} from '@3constants'

import Root from '@3gl/root'



// const captureSize = {

// 	w: 1920,

// 	h: 1080
// }


class Recorder {

	constructor(){

		this.MP4 	= null

		this.canvas = CANVAS

		this.frame 	= -1

		this.timer = 0
	}

	async loadModule(){

		this.MP4 = await loadMP4Module({

			getWasmPath (fileName, scriptDir, isSIMDRequested) {
			  return '/mp4/' + fileName;
			}
		})
	}

	async init(){

		if(!isWebCodecsSupported()){

			// record() rejects with this, and the studio's record button
			// explains it (features/studio/StudioMenu/context/CinematicContext)
			throw new Error('Video recording is not supported by this browser')
		}

		if(this.MP4 == null ) {

			// this.cacheMesh = new CacheMesh()

			await this.loadModule()
		}

		await this.preload()
	}

	async preload(){

		return Root.onRecordStart()

	}

	async updatecompose(){

		// console.log('update compose')

		Camera.updateFrustum()

		await Root.onRecord(this.timer)

		// console.log('root recorded..')

		// const progress =  this.timer / this.duration

		// this.cacheMesh.opacity = Math.pow((progress - 0.5) * 2, 4)
	}

	start( tween, opts ) {

		return new Promise( async (resolve)=>{

			this.resolve = resolve

			this.callback = opts.callback

			this.frame   = 0

			this.timer   = 1 / RECORD_FPS * this.frame

			this.duration = tween.duration()

			this.tween = tween

			this.encoder = await this.MP4.createWebCodecsEncoder({

				width	: RECORD_SIZE.w,

				height  : RECORD_SIZE.h,

				fps: RECORD_FPS,

				bitrate : 4_000_000,

				bitrateMode: 'constant'

			})

			// await new Promise((resolve)=>{

			// 	gsap.delayedCall(0.5, ()=>{

			// 		resolve()
			// 	})
			// })

			Renderer.setPixelRatio(1)

			Mediator.resize( {

				w: RECORD_SIZE.w,

				h: RECORD_SIZE.h,

				force: true
			} )

			Mediator.pause()

			SET_IS_RECORDING(true)

			// intro

			// CANVAS.style.transform = 'scale(0.25)'

			this.update()
		})
	}

	async renderIdle(){

		let i = 0

		while( i < RECORD_FPS ){

			await this.update( true )

			i++
		}

	}

	async update( force = false ){

		// console.trace()

		if( IS_RECORDING == false  || this.encoder == null ){

			return
		}

		this.tween.seek( this.timer, false )

		await this.updatecompose()


		Root.currentArtworks.artworks.forEach(( artwork )=>{

	    	if( artwork.isPlaceholder ) {

	    		artwork.visible = false
	    	}
	    })




		Mediator.next()

		Camera.cinematic.composer.render()


		 Root.currentArtworks.artworks.forEach(( artwork )=>{

	    	if( artwork.isPlaceholder ) {

	    		artwork.visible = true
	    	}
	    })


		var bitmap = await createImageBitmap(CANVAS, 0, 0, RECORD_SIZE.w, RECORD_SIZE.h);

		if( this.encoder ) {

			await this.encoder.addFrame(bitmap);

		}

		else {

			// no encoder

			return
		}


		await new Promise((resolve)=>{

			if( this.callback ) {

				this.callback( {

					bitmap: bitmap,

					progression: Math.min( this.timer / this.tween.totalDuration(), 1.0 )
				})

			}

			gsap.delayedCall(0.01, ()=>{

				resolve()
			})
		})

		bitmap = null

		if( force == false ) {

			await this.next()
		}
	}

	async next(){

		// console.log( IS_RECORDING )

		if( IS_RECORDING == false ){

			return
		}

		gsap.delayedCall( 1 / RECORD_FPS , async ()=>{

			if( IS_RECORDING == true) {

				this.frame++

				this.timer = 1 / RECORD_FPS * this.frame

				if( this.timer > this.tween.totalDuration()){

					await this.renderIdle()

					await this.stop()

					if( this.callback ) {

						this.callback( {

							progression : 1,

							blobFile : this.blobFile(),

							progression: Math.min( this.timer / this.tween.totalDuration(), 1.0 )
						})
					}

					if( CINEMATIC == true || UPLOADER_MODE == true ) {

						await this.download()

					}


					this.resolve()

				}

				else {

					this.update()
				}
			}
		})
	}



	async stop() {


		SET_IS_RECORDING(false)

		if( this.encoder ) {

			this.buffer = await this.encoder.end();

			this.encoder = null

		}

		// CANVAS.style.transform = ''

		Renderer.setPixelRatio( DPI )

		Mediator.resize()

		Mediator.play()
	}

	blobFile() {

		return new Blob([this.buffer], { type: "video/mp4" })
	}

	download(){

		const url = URL.createObjectURL(new Blob([this.buffer], { type: "video/mp4" }));

		var a = document.createElement('a')

		a.style.display = 'none'

		a.href = url


		a.download = (CURRENT_SPACE?.exhibit?.info?.headline || CURRENT_SPACE?.destination?.name || CURRENT_SPACE?.exhibit?.id) + '-' + ( new Date().toISOString().split("T")[0] ) +'.mp4'

		//

		document.body.appendChild(a)

		a.click()

		setTimeout(() => {

			window.URL.revokeObjectURL(url)

			document.body.removeChild(a)

			a = null

		}, 100)


	}
}

export default new Recorder()
