import Loader from '@3loader'
import { prepareRoomTextureUpgrade } from '@3utils/roomTextureUpgradeController'
import { selectRoomModelSource, publishRoomModelSource, classicRoomModelOptions, roomModelFallbacks } from '@3utils/roomModelSource'
import { loadRoomModel } from '@3utils/loadRoomModel'
import { COMPRESSED_SUPPORT, EDIT_MODE, GPU_TIER, IS_MOBILE } from '@3constants'

import {

	AnimationMixer,

	Box3,

	Mesh,

	PlaneGeometry,

	Group,

	Color,
} from 'three'

import {

	UPLOADER_MODE,

	DISABLE_REFLECTOR,

	DEBUG_COLLISION
	
} from '@3constants'

import { Space } 	from '@3factory/space/space'

import KitBuilder 	from './kitbuilder.js'

import { PortalPlaceholderFactory } from '@3portal/index'

import SpaceFactoryAbstract from '@3factory/abstract/spacefactory.js'

import BackgroundFactory from '@3factory/background'

import Reflector from '@3factory/reflector'

import WaterFactory from '@3factory/water'

import LightFactory from '@3factory/lighting'


import { ERROR_CODES } from '@3constants'
import { KitbashWrapper } from './kitbashwrapper.js'


class FutureSpaceFactory extends SpaceFactoryAbstract {

	constructor(){

		super()
	}

    /**
     *
     * @param { import('@gltypes').World3DOptions } opts
     * @returns { Promise<import('@gltypes').SpaceData & { kitbash: KitbashWrapper  }> }
     */
	async get(opts){

		// samsy

        // Same choice as the classic kit: the device's tier, mid first on a
        // capable desktop. It used to always start at high.
        const modelOptions = classicRoomModelOptions({
            preferLowResolution: opts.preferLowResolution,
            gpuTier: GPU_TIER.path,
            isMobile: IS_MOBILE,
            compressedSupport: COMPRESSED_SUPPORT,
            skin: opts.exhibit.info?.currentSkin,
            editing: EDIT_MODE || UPLOADER_MODE,
        })
        let modelSource = selectRoomModelSource(opts.roomParameters, modelOptions)
        var url = modelSource.url
        publishRoomModelSource(modelSource)
        if (modelSource.source === "skin") opts.roomParameters.background = modelSource.background

		const isNewUpload = UPLOADER_MODE && opts.roomParameters.uPath?.fileURL != null


		return new Promise( async (resolve, reject)=>{

			if( isNewUpload ) {

				try{

				    const { default: Optimiser } = await import('@3modules/optimiser')
				    url = await Optimiser.processKitBash(url)

				} catch(err) {

				    console.error(err)

				    reject({
				        code: ERROR_CODES.INVALID_MODEL,
				        value: err
				    })

				    return;
				}
			}

			let promise;

			if (url) {

				// A processed upload has no alternatives to fall back to.
				const fallbacks = url === modelSource.url ? roomModelFallbacks(opts.roomParameters, modelOptions, modelSource) : []
				promise = loadRoomModel(fileUrl => Loader.loadGLTF( fileUrl, true ), { ...modelSource, url }, fallbacks).then(({ result, source }) => {
					if (source.url !== url) {
						modelSource = source
						publishRoomModelSource(modelSource)
					}
					return result
				})
			}
			else {

				const emptyScene = new Group()

				promise = Promise.resolve({ scene: emptyScene, animations: [] })
			}

            let textureUpgrade = null
		    promise.then(async (res)=>{
                textureUpgrade = prepareRoomTextureUpgrade(opts, modelSource, res.scene)

		        const placeholders = []

		        const floorMeshes = []

                let kitbashData;

                kitbashData = opts.exhibit.kitbash

		        let kitbash = await KitBuilder.create( res.scene, kitbashData, {
					...opts,
					kit: opts.roomParameters.slug,
                    isNewUpload
				} )

		        // placeholders.push( new Mesh(new PlaneGeometry()))
		        // if()
		        // kitbash.scene.add(placeholders[0])

		        // placeholders.forEach(p => {

		        //     p.parent.remove(p)
		        // })

		        const portalPlaceholders = PortalPlaceholderFactory.get(res)

		        const mixer = new AnimationMixer(kitbash.scene);

		        let floors = []

		        let background;

				try {

					background = await this.getBackgroundDisplay( opts )
				}
				catch(err) {

					console.error(err)

					background = new Color(0, 0, 0)
				}

		        let backgroundMesh = BackgroundFactory.get( background )

		        const scene = new Space({ scene: kitbash.scene, background: backgroundMesh })

				// uploader mode is still based on roomParameters

                if( !DISABLE_REFLECTOR && opts.roomParameters && opts.roomParameters.enableWater == true ){

                    const water = WaterFactory.get( opts )

                    scene.add(water)

                    scene.water = water

                }

                if( !DISABLE_REFLECTOR && opts.roomParameters && opts.roomParameters.enableReflector == true ){

                    const reflector = Reflector.getRaw( opts )

                    scene.add(reflector)

                    scene.reflector = reflector

                    kitbash.collisions.push(reflector)

                }

                const lighting = LightFactory.get( opts.roomParameters?.lighting, scene )

                scene.add( lighting )

                scene.lighting = lighting

				const bbox = this.computeSpaceBBox( kitbash )

		        let far = this.getFarValue(res.scene, bbox )

		        // if(opts.roomParameters.isFuture)

		        // let fog = this.getFog( background, far, opts )

		        // scene.fog = fog

		        scene.originalGLB = res.scene

				let cubeMap = await this.setupPBR( scene , opts )

                textureUpgrade?.attach(scene, Object.values(kitbash.build.types || {}).flatMap(type => type.baseItems?.map(item => item.mesh) || []))


				// const now = performance.now()

				let kitbashImgs = isNewUpload ? await KitBuilder.bakeAssets( scene ) : null

				// console.log('bakeAssets', performance.now() - now)


		        resolve ({
		            scene,
		            mixer,
		            colliders: kitbash.collisions,
                    kitbash: kitbash.build,
					kitbashImgs,
		            placeholders,
		            portalPlaceholders,
		            background,
		            floors,
		            cubeMap,
		            far,
		            bbox,
		            fog : null
		        })
		    }).catch(error => {
                textureUpgrade?.dispose()
                reject(error)
            })

		})
	}

	computeSpaceBBox( kitbash ) {

		const box = new Box3().setFromObject(kitbash.scene)

		kitbash.build.elements.forEach( element => {

			element.getBBox(box)

		})

		return box
	}


}

export default new FutureSpaceFactory()
