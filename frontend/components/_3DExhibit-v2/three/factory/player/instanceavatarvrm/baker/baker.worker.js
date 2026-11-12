import {

	GLTFLoader

} from './bakergltfworkerloader.js'

import { VRMLoaderPlugin } from '@pixiv/three-vrm'

import Baker from './indexworker.js'

import { decodeAvatarClips, readAvatarClipHeader } from './clipCodec.js'

import { createBakeCache } from './bakeCache.js'

import { runBakeJob } from './bakeJob.js'

let gltfLoader = new GLTFLoader().setCrossOrigin("anonymous")

    // this.gltfLoader.register(parser => new GLTFInstancingExtension(parser));

    gltfLoader.register( ( parser ) => {

        const p = new VRMLoaderPlugin( parser, { helperRoot: null && helperRoot, autoUpdateHumanBones: true } );

        p.mtoonMaterialPlugin.getMaterialType = ( materialIndex )=>{

            return null
        }

        return p

   } );

let baker;

let cache = null

let clipsVersion = null

/** Where relative resources of the file would resolve, as loadAsync does. */
function resourcePath( url ) {

	try {

		return new URL( '.', url ).href

	} catch ( _ ) {

		return ''
	}
}

self.addEventListener(

	"message",

	async function(e) {

		if (e.data.init == true) {

			baker = new Baker()

			// The packed clips (this worker's own copy), or the decoded clips
			// when the page fell back to the JSON file.
			baker.setAnimationJson(

				e.data.clips ? decodeAvatarClips(e.data.clips) : e.data.animation
			)

			// Bakes are cached only with the packed clips, whose version
			// is known (bakeCache.js).
			let clips = null

			try {

				clips = e.data.clips ? readAvatarClipHeader(e.data.clips).header.source?.sha256 || null : null

			} catch ( _ ) {}

			cache = clips ? createBakeCache({ clips }) : null

			clipsVersion = clips

			return
		}

		try {

			const { message, transfer } = await runBakeJob( e.data, {

				cache,

				clips: clipsVersion,

				// The main thread sends the bytes it downloaded; older callers
				// (or a file it could not keep) leave the worker to fetch the URL.
				parse: ( data ) => data.bytes
					? gltfLoader.parseAsync( data.bytes, resourcePath( data.url ) )
					: gltfLoader.loadAsync( data.url ),

				bake: ( vrm ) => baker.prepare( vrm ),
			})

			self.postMessage( message, transfer )

		} catch (error) {

			console.log('error .... ')
			console.log(error)

			self.postMessage({
				error: true
			})

		} finally {

			// console.log('end')
		}
	},

	false
)