import Loader from "@3loader"

import { VRMUtils } from '@pixiv/three-vrm';


import {

	Group,

	Box3,

	Vector3

} from 'three'

import {

	PERF_SCORES,

	LOD_MESHES_MAX,

	MAXIMUM_VRM_BOX,

	MINIMUM_VRM_BOX,

	WEB_WORKER_SUPPORT,

	SUPPORT_TRANSFERRABLE,

	COMPRESSED_SUPPORT,

    CURRENT_USER,

    IS_MOBILE

} from '@3constants'

import { VRMLoaderPlugin } from '@pixiv/three-vrm';

import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

import Mix from '@3utils/math/mix'

// import Baker from '@3factory/player/instanceavatarvrm/baker'

import VrmApi from "@api/vrm/_api"

import VRMCompressedCache from '@3utils/vrmcompressedcache.js'
import { loadBakerAnimations } from './factory/player/instanceavatarvrm/baker/animationData.js'
import { BASE_URL } from "@utils/gcloud/uploader";

// import PreviewBaker from '@3utils/previewbaker.js'



const debug = true

let vrmCache = {}

const tempBox = new Box3()
const localSize = new Vector3()


class GLTF {

	constructor(){

		this._isLoading  = {}

		this._isPooling  = {}

		this.promiseList = {}

		this.poolinList  = {}


		// this.baker = new Baker()

	}

	get_url_extension( url ) {

		const cs = url.split('.')
		
		let ext = cs.pop()

		if(ext === "undefined") {
			ext = cs.pop()
		}

		return ext
	}

	load( object ) {

	    return new Promise( async (resolve, reject) => {

	        let i = 0

	        while ( i < object.length ) {

	            let current = object[i]

	            let url =  current.url

	            const ext = this.get_url_extension(url).toLowerCase()

	            const ISGLB = ext == 'glb'

	            const ISVRM = ext == 'vrm'

	            // Desktop always uses the original avatar; only mobile consumes compressed URLs.
	            if((ISGLB || ISVRM) && COMPRESSED_SUPPORT && IS_MOBILE )  {

	            	if( VRMCompressedCache.get(url) == null ) {

	            		const compressedUrl = await VrmApi.getCompressedUrl({ url })

	            		if(compressedUrl){

	            			if( IS_MOBILE ) {

	            				VRMCompressedCache.set(url, compressedUrl)
	            				//
	            				url = compressedUrl;
	            			}

	            		} else {

                            // we launch the compression for next time

                            const formData = new FormData();

                            formData.append("vrmUrl", url);

                            if (CURRENT_USER.token) {
                                fetch(`${BASE_URL}/vrmoptization_ipfs`, {
                                    method: "POST",
                                    body: formData,
                                    headers: {
                                        "x-token": CURRENT_USER.token,
                                    },
                                });
                            }
                        }
	            	}
	            	else{

	            		if( IS_MOBILE ) {

	            			url = VRMCompressedCache.get(url)

	            		}

	            	}
	            }


	            if ( this[current.name] == null && ( ISGLB == true || ISVRM == true || current.force == true ) ) {

	            	console.log(url)
	            	console.log(url)
	            	console.log(url)

	            	this._isLoading[current.name] = true

	            	var res;

	            	try {

            			// The bytes stay with the result so the bake worker can
            			// parse them instead of downloading the avatar again.
            			var res = await Loader.loadGLTF( url, false, false, false, { keepSourceBytes: true } )

            			const sourceBytes = res?.sourceBytes

            			if( res ) delete res.sourceBytes

            			if ( res != null ) {

		            		const IS_VRM = res.userData?.vrm != null

		        			if( IS_VRM ) {

								// Bakers read the clips synchronously once the
								// avatar is stored (VRMMesh, Baker).
								await loadBakerAnimations()

								VRMUtils.removeUnnecessaryVertices( res.scene )

								if( res.datas?.isHighQuality == false ) {

									VRMUtils.combineSkeletons( res.scene )

								}

								res.datas = this.validate(res)

								if( res.datas.skinnedCount == 0 ){

									res.datas = null
								}

						        tempBox.setFromObject(res.scene)

						        tempBox.getSize(localSize)

						        const maxSize = Math.max( localSize.x, localSize.y, localSize.z )

						        var baseScaleRatio = 1

						        var absoluteRatio = this.calculateRatio( maxSize, MINIMUM_VRM_BOX, MAXIMUM_VRM_BOX )

					        	baseScaleRatio = MAXIMUM_VRM_BOX / maxSize

						        if( maxSize < MINIMUM_VRM_BOX || maxSize > MAXIMUM_VRM_BOX ) {

						        	baseScaleRatio = Math.abs(1 / absoluteRatio)

						        	absoluteRatio = Math.max(  Math.min( 1.0, absoluteRatio ), 0.0 )
						        }


						        res.userData.vrm.baseScaleRatio = baseScaleRatio
						        res.userData.vrm.absoluteRatio  = absoluteRatio

		        			}


		        			if( res.datas?.isHighQuality ) {

		        				this.set( current.name, res )

		        				await this.cloneVRM( current.name, res )

		        				if( current.thumbnail ){

		        					await this.createThumbnail(res)
		        				}
		        			}
		        			else {

		        				if( WEB_WORKER_SUPPORT && SUPPORT_TRANSFERRABLE ) {

		        					// Usually imported at engine start already.
		        					await this.prepareBaking()

		        					const globalMeta = await this.webworkerBaker.prepare( url, sourceBytes )

		        					res.userData.vrm.globalMeta = globalMeta

		        					if( current.thumbnail ){

		        						await this.createThumbnail(res)

		        					}

		        					this.bakerAbstract.updateSkeleton( res.scene, globalMeta.boneMap )

		        				}

		        				else {

		        					const bakerConstructor = (await import('@3factory/player/instanceavatarvrm/baker')).default

		        					const baker = new bakerConstructor()

                            res.userData.vrm.globalMeta = await baker.prepare( res.userData.vrm )
		        				}

		        				this.set( current.name, res )
		        			}
            			}
	            	}

	            	catch(e){

                        this.reset(current.name);
                        reject(e);
                        return;
	            	}
	            }

	            i++
	        }

        	resolve()

	    })
	}

	/**
	 * Imports the avatar bake code (the worker client and the skeleton
	 * helper) once. Scene3D starts this when the engine is ready, so the
	 * avatar does not wait for these chunks after it has parsed; load()
	 * awaits the same promise. Workers start only with the first bake.
	 */
	prepareBaking() {

		// Every avatar needs the clips; fetch them alongside the room.
		void loadBakerAnimations().catch(() => {})

		if( !( WEB_WORKER_SUPPORT && SUPPORT_TRANSFERRABLE ) ) return Promise.resolve()

		if( this._bakingReady == null ) {

			this._bakingReady = Promise.all([

				import('@3factory/player/instanceavatarvrm/baker/bakerworker.js'),

				import('@3factory/player/instanceavatarvrm/baker/abstract.js'),

			]).then(( [ worker, abstract ] )=>{

				if( this.webworkerBaker == null ) this.webworkerBaker = worker.default

				if( this.bakerAbstract == null ) this.bakerAbstract = new abstract.default()

			}, ( error )=>{

				this._bakingReady = null

				throw error
			})
		}

		return this._bakingReady
	}

	async createThumbnail( res ){

		if( this.previewBaker == null )  {

			const previewBakerConstructor = (await import('@3utils/previewbaker.js')).default

			this.previewBaker = new previewBakerConstructor()
		}

		res.thumbnail = (await this.previewBaker.render([res]))[0].image

	}

	async cloneVRM( name, model = null ){


		var res = model;

		if( model == null ) {

			res = await Loader.loadGLTF( name )
		}

		res.userData.vrmExpressionManager  = null 
		res.userData.vrm.expressionManager = null 


		res.pooled = true

		res.scene.pooled = true

	    res.scene.poolUsed = false

	    res.datas = this.validate( res )

		VRMUtils.removeUnnecessaryVertices( res.scene )

		if( res.datas?.isHighQuality == false ) {

			VRMUtils.combineSkeletons( res.scene )

		}

	 	const gltf = this[name]

	    if( gltf.pool == null ) {

	    	gltf.pool = []
	    }

	    res.scene.lobbyMotionClips = await (await import("./factory/player/instanceavatarvrm/lobbyMotionClips")).prepareNativeLobbyClips(res.userData.vrm)

        gltf.pool.push( res )

	    res.clonedCount = gltf.pool.length - 1

	    res.scene.clonedCount = gltf.pool.length - 1

	    res.scene.parser = res.parser

	    res.scene.gltf = res

	    res.userData.vrmExpressionManager = null
	    res.userData.vrm.expressionManager = null


	    return res
	}

	requestPoolNow(name){

		let availablePool = null

		if( this[name] != null && this[name].pool ) {

			let pool = this[name].pool

			let i = 0

			let res = null

			while( i < pool.length ) {

				if( pool[i].scene.poolUsed == false ) {

					res = pool[i]
				}

				i++
			}

			if( res == null ) {

				availablePool = false
			}
			else {

				availablePool = res
			}

		}

		return availablePool
	}

	async requestPool( name ) {

		let availablePool = null

		this._isPooling[name] = true

		if( this[name] != null && this[name].pool ) {

			let pool = this[name].pool

			let i = 0

			let res = null

			while( i < pool.length ) {

				if( pool[i].scene.poolUsed == false ) {

					res = pool[i]

					i =  pool.length + 1
				}

				i++
			}

			if( res == null ) {

				availablePool = false
			}
			else {

				availablePool = res
			}

		}


		if ( availablePool == false ) {


			availablePool = await this.cloneVRM( name )

		}

		this._isPooling[name] = null
		// availablePool.poolUsed = true

		return availablePool

	}

	poolAvailable( name ){

		if( this[name] != null && this[name].pool ) {

			let pool = this[name].pool

			let i = 0

			let res = null

			while( i < pool.length ) {

				if( pool[i].scene.poolUsed == false ) {

					return true
				}

				i++
			}

			if( res == null ) {

				return false
			}
			else {

				return true
			}

		}

		else {

			console.log('warn cant test pool, this VRM has no pool', name)

			// return false
		}

	}

	requestPoolOnce( name ){

		if(this._isPooling[name] == null ) {

			this.requestPool( name )
		}

	}




	loadOnce( object ){


		if(this._isLoading[object.name] == null ) {

			this._isLoading[object.name] = true

			return this.load([object])
		}
		else {

			// if asking to load a specific model, but already loading somewhere else

			if( this[object.name] == null ) {

				// console.log('trying to reload a model ')

				const promise = new Promise((resolve)=>{

					if( this.promiseList[object.name] == null ) {

						this.promiseList[object.name] = []
					}

					this.promiseList[object.name].push( resolve )
				})

				return promise

			}

			// already loaded all good
			else {

				return Promise.resolve()

			}
		}
	}

    releaseSession() {
        // Pool copies share meshes' geometry/materials/images, but own their
        // skeleton buffers. Collect first so shared sources are released once.
        const geometries = new Set(), skeletons = new Set();
        const materials = new Set(), textures = new Set(), images = new Set();
        for (const name of Object.keys(this._isLoading)) {
            const gltf = this[name];
            const scenes = new Set([gltf?.scene, ...(gltf?.pool || []).map(item => item.scene)]);
            for (const scene of scenes) {
                scene?.removeFromParent();
                scene?.mixer?.stopAllAction();
                scene?.mixer?.uncacheRoot(scene);
                scene?.traverse((object) => {
                    if (object.geometry) geometries.add(object.geometry);
                    if (object.skeleton) skeletons.add(object.skeleton);
                    const values = Array.isArray(object.material) ? object.material : [object.material];
                    for (const material of values) if (material) materials.add(material);
                });
            }
            if (gltf?.userData?.vrm?.globalMeta?.texture) textures.add(gltf.userData.vrm.globalMeta.texture);
            this.reset(name);
        }
        for (const material of materials) {
            for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
            for (const uniform of Object.values(material.uniforms || {})) {
                const values = Array.isArray(uniform?.value) ? uniform.value : [uniform?.value];
                for (const value of values) if (value?.isTexture) textures.add(value);
            }
        }
        for (const geometry of geometries) geometry.dispose();
        for (const skeleton of skeletons) skeleton.dispose();
        for (const material of materials) material.dispose();
        for (const texture of textures) {
            texture.dispose();
            const data = texture.source?.data ?? texture.image;
            for (const image of Array.isArray(data) ? data : [data]) {
                if (typeof image?.close === "function" && !images.has(image)) {
                    images.add(image);
                    image.close();
                }
            }
        }
        this._isLoading = {};
        this._isPooling = {};
        this.poolinList = {};
        this.promiseList = {};
    }

	reset( name ){

		this._isLoading[name] 	= null

		this.promiseList[name]  = null

		this[name] 				= null

	}

	set( name, value ){

		if( this[name] == null ) {

			this[name] = value
		}
		else {

			console.warn('texture already set')
		}

		if( this.promiseList[name] != null ) {

			let i = 0

			while(i < this.promiseList[name].length ) {
				// execute promise for waiting calls
				this.promiseList[name][i]()

				i++
			}

			this.promiseList[name] = null
		}
	}

	validate( currentvrm ){

		let valid = true

		let count = 0

		// let rightBones = true

		let hasPFP = false

		let skinnedCount = 0

		currentvrm.scene.traverse( ( child ) => {

			if( child.type == 'SkinnedMesh' || child.type == 'Mesh' ) {

				if( child.type == 'SkinnedMesh' ) {

					skinnedCount++
				}

				if( child.name.includes('_pfp')){

					hasPFP = true
				}

				child.material.depthWrite = true

				child.material.depthTest  = true

				count++
			}
		})

		const isHighQuality = currentvrm.userData.vrmSpringBoneManager?.joints.size > 5 || currentvrm.userData.vrmNodeConstraintManager?.constraints.size > 5

		// isHighQuality = false

		if( isHighQuality ) {

			currentvrm.scene.isHighQuality = true

			currentvrm.isHighQuality = true
		}

		return {

			skinnedCount: skinnedCount,

			score : this.getPerfScore( currentvrm, isHighQuality ),

			count : count,

			validCount: count <= LOD_MESHES_MAX,

			hasPFP : hasPFP,

			isHighQuality: isHighQuality
		}
	}

	/**
	 * @return { import("@3constants").PERF_SCORE }
	 * */
	getPerfScore( vrm, isHighQuality = false ) {

		const scene = vrm.scene

        let nbVertices = 0

        let pbrMaterials = 0

        let nbTextures = 0

        let textureMap = new Map()

        let maxTextureSize = 0

        let drawCalls = 0

        let normalMap = 0

        scene.traverse(obj => {
            //
            if(obj.material) {

            	if( Array.isArray(obj.material)){

            		drawCalls++

            		return;
            	}


                drawCalls++

                const geometry = obj.geometry;
                const material = obj.material

                if(geometry) {

                	if( geometry.index ) {

                		nbVertices +=  geometry.index.count / 3

                	}

                	else {

                    	nbVertices += obj.geometry.attributes.position.count
                	}
                }

                if(material) {

                    if(material.map) {

                    	const existMap = textureMap.get(material.map.uuid)

                    	if( existMap == null ) {

                    		nbTextures ++

                    		if( material.map.source == null ) {

                    			// A map without a source; the next line will throw.
                    		}

                    		maxTextureSize = Math.max(material.map.source.data.width * material.map.source.data.height, maxTextureSize)

                    		textureMap.set(material.map.uuid, material.map)
                    	}

                    }

                    if(material.emissiveMap) {

                    	const existMap = textureMap.get(material.emissiveMap.uuid)

                    	if( existMap == null ) {

                    		nbTextures ++

                        	maxTextureSize = Math.max(material.emissiveMap.source.data.width * material.emissiveMap.source.data.height, maxTextureSize)

                        	textureMap.set(material.emissiveMap.uuid, material.emissiveMap)
                    	}

                    }

                    if(material.normalMap) {

                    	const existMap = textureMap.get(material.normalMap.uuid)

                		if( existMap == null ) {

                			nbTextures ++

                			normalMap++

                        	maxTextureSize = Math.max(material.normalMap.source.data.width * material.normalMap.source.data.height, maxTextureSize)

                        	textureMap.set(material.normalMap.uuid, material.normalMap)
                    	}
                    }
                }
            }
        })

        let _perfScore = PERF_SCORES.LOW

        if(pbrMaterials > 1 || nbVertices > 10000 || nbTextures > 1 || normalMap > 0 || Math.sqrt( maxTextureSize ) > 1024) {

            _perfScore = PERF_SCORES.MEDIUM
        }

        if(pbrMaterials > 3 || drawCalls > 5 || nbVertices > 20000 || nbTextures > 2 || Math.sqrt( maxTextureSize ) > 2048) {

            _perfScore = PERF_SCORES.HIGH
        }

        // scene.updateWorldMatrix(false, true)

        // tempBox.setFromObject(scene)

        // tempBox.getSize(localSize)

        if( isHighQuality == true || drawCalls > 10 ) {

        	_perfScore = PERF_SCORES.EXTREME
        }

        let _stats = {

        	// box : {
        	// 	x: localSize.x,
        	// 	y: localSize.y,
        	// 	z: localSize.z,
        	// 	correctSize : true
        	// },


        	perfScore: _perfScore,

            nbVertices,

            pbrMaterials,

            nbTextures,

            maxTextureSize,

            normalMap,

            drawCalls
        }

        textureMap = null

	    return _stats
	}

	calculateRatio(x, lowerLimit, upperLimit) {
	  const ratio = (x - lowerLimit) / (upperLimit - lowerLimit); // calculate the ratio between 0 and 1
	  return ratio;
	}

}

export default new GLTF()
