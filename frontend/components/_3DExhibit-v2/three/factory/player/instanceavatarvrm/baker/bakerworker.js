import Loader from "@3loader";
import WorkerPool from '@3gl/utils/workerpool.js'

import WorkerSource from "./baker.worker.js"

import { loadBakerClipSource } from './animationData.js'

import {

	IS_MOBILE

} from '@3constants'

import {

	DataTexture,

	RGBAFormat, 

	FloatType

} from 'three'

class BakerWorker {

	constructor(){

		// Each worker receives the clips when it starts (WorkerPool asks
		// for this message then); prepare() loads them before any job.
		this.clipSource = null

		this.wPool = new WorkerPool(WorkerSource, IS_MOBILE ? 4 : 8 , false, () => this.workerInit() )
	}

	/**
	 * The first message of a new worker: its own copy of the packed clips,
	 * transferred (one memory copy, no serialisation), or the decoded clips
	 * as before when the page fell back to the JSON copy.
	 */
	workerInit(){

		const bytes = this.clipSource?.bytes

		if( bytes ) {

			const copy = bytes.slice( 0 )

			return { message: { init: true, clips: copy }, transfer: [ copy ] }
		}

		return { message: { init: true, animation: this.clipSource?.clips || null } }
	}

	/**
	 * @param { string } url
	 * @param { ArrayBuffer } [bytes] the file the main thread already
	 *   downloaded; the worker parses it instead of fetching `url` again.
	 */
	async prepare( url, bytes ){

		const signal = Loader.sessionSignal

		this.clipSource = await loadBakerClipSource()

		return new Promise( (resolve, reject)=>{

			this.wPool.queueJob(

			    './baker.worker.js',

			    {
			    	url : url,

			    	...( bytes instanceof ArrayBuffer ? { bytes } : {} ),

			    },

			    ( e ) => {

			        if( e.data.error == true ){

			            reject('not found');
                        return;
			        }

			        const res = e.data.data

			        if( e.data.cached && process.env.NODE_ENV === "development" )
			            console.info( "[Avatar bake cache] hit " + url )

			        res.texture = new DataTexture(res.texture.source.data.data, res.texture.source.data.width, res.texture.source.data.height, RGBAFormat, FloatType)
			        // new DataTexture( metadataArray, metadataSize, 1,  RGBAFormat, FloatType )
			        res.texture.needsUpdate = true
			        
			        resolve(res)
			    },

			    this,
                signal
			)
		})
	}
}

export default new BakerWorker()
