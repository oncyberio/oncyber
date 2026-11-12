import { hasCustomPlayerAction } from "./lobbyMotion";
import { nativeTravelIdleAction } from "../../../utils/nativeTravelIdle";
import {

	AnimationMixer,

	Sphere,

	Mesh,

	Vector3,

	Object3D

} from 'three'


import Emitter from '@3emitter'

// import FBOHelper from '@3gl/globals/fbohelper.js'

import Renderer from '@3renderer'

import Scene from '@3scene'

import Camera from '@3camera'

import Wrapper from './wrapper.js'

import Events from  '@3events'

import GLTF from '@3gltf'

import {

	IDLE, RUN, WALK, JUMP, FLY, EMOTES

} from './constants.js'

import {

	DEFAULT_VRM,

	LOD_VRM,

	LOD_VRM_DISTANCE,

	LOD_VRM_VISIBILITY,

	QUALITY,

	QUALITIES,

    MID_LOD_VRM

} from '@3constants'

import * as VRM from '@pixiv/three-vrm';

import VRMMesh from './vrmmesh.js'

import {

	ATLAS_EVENTS,

	TEXTURE_SIZE,

	BLOCK_SIZE

} from '@3factory/atlas/constants'

import Players from '@3factory/player'

class InstanceAvatar3D {

	constructor() {

		this.id = -1

		this.wrappers   = []

		// window.avatar3D = this

		let i = 0

		this._enabled = true

		this.models = {}

		this.atlas = null

		this.onNewTextureEvent =  this.onNewTexture.bind(this)

		this.onBlockDataEvent = this.onBlockData.bind(this)

		this.onBlockRemoveEvent = this.onBlockRemove.bind(this)

		this.avatarPFPContainer = new Object3D()

		this.avatarPFPContainer.matrixAutoUpdate = false

		this.avatarPFPContainer.matrixWorldAutoUpdate = false

		this.avatarPFPContainer.name = 'avatarPFPContainer'

		this.avatarContainer    = new Object3D()

		this.avatarContainer.name = 'avatarContainer'

		this.avatarContainer.matrixAutoUpdate = false

		Scene.add( this.avatarPFPContainer )

		Scene.add( this.avatarContainer )

	}

	setAtlas( atlas ){

		if( this.atlas != null ) {

			this.atlas.off(ATLAS_EVENTS.NEW_TEX, this.onNewTextureEvent )

			this.atlas.off(ATLAS_EVENTS.BLOCK_DATA, this.onBlockDataEvent )

			this.atlas.off(ATLAS_EVENTS.REMOVE_BLOCK, this.onBlockRemoveEvent )
		}

		this.atlas = atlas

		this.atlas.on(ATLAS_EVENTS.NEW_TEX, this.onNewTextureEvent )

		this.atlas.on(ATLAS_EVENTS.BLOCK_DATA, this.onBlockDataEvent )

		this.atlas.on(ATLAS_EVENTS.REMOVE_BLOCK, this.onBlockRemoveEvent )

	}

	onNewTexture( tex ){

		this.addPFPMeshes()
	}

	addPFPMeshes(){

		// for each model
		Object.keys(this.models).forEach(key => {

			const model = this.models[key]

			// if a model is using pfp options

			if( model.pfpOptions ){

				let i = 0

				// for each mega texture in the atlas

				if( model.pfpOptions.megaTextures == null ) {

					model.pfpOptions.megaTextures = []

					model.pfpOptions.pfpMeshes    = []
				}


				while( i < this.atlas.megaTextures.length ) {

					const megaTexture = this.atlas.megaTextures[i]


					if( model.pfpOptions.megaTextures[i] == null ) {

						model.pfpOptions.megaTextures[i] = megaTexture

						const mesh = VRMMesh.getVRMAtlasMesh( model.pfpOptions, megaTexture, i )

						model.pfpOptions.pfpMeshes[i] 	 = mesh

						this.avatarPFPContainer.add( model.pfpOptions.pfpMeshes[i] )

					}

					i++
				}
			}
		})

	}

	onBlockData( blocks ){

		if( blocks.blockMap ) {

			let c = 0

			while( c < this.wrappers.length ) {

				if( blocks.blockMap[ this.wrappers[c].url ] != null ) {

					this.wrappers[c].atlas  	  = blocks.blockMap[ this.wrappers[c].url ].atlas

					this.wrappers[c].textureIndex = blocks.blockMap[ this.wrappers[c].url ].textureIndex

					// console.log(  blocks.blockMap[ this.wrappers[c].url ] )
				}

				c++
			}
		}
	}

	onBlockRemove( block ){

		if( block.wrapper ) {

			block.wrapper = null
		}
	}

	set enabled( val ){

		this._enabled = val

		let i = 0

		Object.keys(this.models).forEach(key => {

			this.models[key].visible = this._enabled

		});

		if( this._enabled ) {

			this.addEvents()

			this.update()
		}

		else {

			this.removeEvents()
		}
	}

	get enabled (){

		return this._enabled
	}

	init( opts = {} ){

		if( opts.userData.VRM == null ) {

			opts.userData.VRM = DEFAULT_VRM
		}

		var meshes = this.getMesh( opts )

		meshes.visible = this.enabled

		meshes.name = opts.userData.VRM

		this.id++

		const wrapper = new Wrapper( meshes, this.id, opts  )

		if( opts.position != null ) {

			wrapper.position.copy( opts.position )
		}

		else {

			wrapper.position = new Vector3(0, 0, 0)
		}

		if( opts.animation ) {

			if(  EMOTES[opts.animation] != null ) {

				wrapper.playEmote(opts.animation, true)

				wrapper.setCurrentAction( EMOTES[opts.animation], true )
			}
		}

		this.wrappers.push( wrapper )

		this.setWrapperQuality( wrapper )

		return wrapper

	}

	getMesh( opts ){

		var meshes = this.models[opts.userData.VRM];

		if( opts.userData.VRMMeshes ){

			const name = opts.userData.VRM + opts.userData.VRMMeshes.clonedCount

			meshes =  this.models[name]

			if( meshes == null ) {

				this.models[name] = VRMMesh.get( opts )

				this.avatarContainer.add(this.models[name])

				meshes = this.models[name]
			}
		}

		else if( this.models[opts.userData.VRM] == null ) {

			this.models[opts.userData.VRM] = VRMMesh.get( opts )

			this.avatarContainer.add(this.models[opts.userData.VRM])

			this.addPFPMeshes()

			meshes = this.models[opts.userData.VRM]

		}


		return meshes
	}

	//

	setWrapperQuality( wrapper ){


		if( wrapper.main ) {

			return true
		}

		const dist = Players.main ? Players.main.position.distanceTo( wrapper.position ) : Infinity

		const inVisibleRange = dist < LOD_VRM_VISIBILITY

		const needsLOD = dist > LOD_VRM_DISTANCE && !wrapper.ignoreLOD



		if( needsLOD || QUALITIES.LOW == QUALITY || QUALITIES.MEDIUM == QUALITY ) {


			const testQuality = needsLOD ? 'LOD' : QUALITY

			if(  wrapper.overrideVRMName == null || testQuality != wrapper.overrideQuality ) {

				var newVRM =  QUALITIES.MEDIUM  == QUALITY ? MID_LOD_VRM : LOD_VRM

				newVRM = needsLOD ? LOD_VRM : newVRM


				if( GLTF[newVRM] ) {

					wrapper.overrideVRMName = newVRM

					wrapper.originalIsHighQuality = wrapper.isHighQuality

					wrapper.originalhighQualityMeshes = wrapper.highQualityMeshes

					wrapper.overrideQuality = testQuality

					const vrmMeshes = this.getMesh( { userData: {VRM : newVRM }} )

					wrapper.updateVRM( vrmMeshes, true )
				}

			}

		}
		else {

			if( wrapper.overrideVRMName != null ) {

				wrapper.overrideVRMName = null

				if( wrapper.originalIsHighQuality == true ) {

					if( wrapper.originalIsHighQuality ) {

						const vrmMeshes = this.getMesh( { userData: {VRM : wrapper.originalVRMName , VRMMeshes: wrapper.originalhighQualityMeshes } } )

						wrapper.updateVRM( vrmMeshes )

						wrapper.overrideQuality = null
					}
					else {

						console.warn('model is high quality, but wrapper got no highquality meshes')
					}
				}

				else {

					if( GLTF[wrapper.originalVRMName] ) {

						const vrmMeshes = this.getMesh( { userData: {VRM :  wrapper.originalVRMName }} )

						wrapper.updateVRM( vrmMeshes )

						wrapper.overrideQuality = null
					}
				}
			}

			// wrapper.originalVRMName = wrapper.vrmName

		}

		return inVisibleRange
	}


	update( delta ){




		if ( !this.enabled && Players != null ) {

			return;
		}

		// Object.keys(this.models).forEach(key => {

		// 	const model = this.models[key]

		// 	if( model.isHighQuality != true ) {

		// 		model.visible = false
		// 	}

		// })

		if( this.wrappers.length > 0 ) {

			let x = 0

			const wrappers = []

			const sortingWrappers = {}

			const pfpSortingWrappers = {}

			while ( x < this.wrappers.length ) {

				const wrapper = this.wrappers[x]

				const visible = this.setWrapperQuality( wrapper )

				if( visible && wrapper.visible) {

					wrapper.smoothedFloorVelocity = wrapper.floorVelocity * 0.2 + wrapper.smoothedFloorVelocity * 0.8

					this.setAnimations( wrapper, delta )

					if( wrapper.isHighQuality ) {

						//this.setAnimations( wrapper )

						const highQualityMeshes = wrapper.highQualityMeshes

						highQualityMeshes.visible = true

						if( highQualityMeshes.mixer ) {

							highQualityMeshes.mixer.update( delta )

							highQualityMeshes.vrm.update( delta )

							highQualityMeshes.position.copy(wrapper.position)

							// highQualityMeshes.parent.updateWorldMatrix(true, true)

							// console.log(highQualityMeshes)

							// console.log(highQualityMeshes)
						}
					}

					else {

						//wrapper.smoothedFloorVelocity = wrapper.floorVelocity * 0.2 + wrapper.smoothedFloorVelocity * 0.8

						//this.setAnimations( wrapper )

						if( sortingWrappers[wrapper.vrmName] == null ) {

							sortingWrappers[wrapper.vrmName] = []
						}

						sortingWrappers[wrapper.vrmName].push( wrapper )


						if( wrapper.usePFPs ) {

							if( pfpSortingWrappers[wrapper.vrmName] == null ) {

								pfpSortingWrappers[wrapper.vrmName] = []
							}

							if( pfpSortingWrappers[wrapper.vrmName][wrapper.textureIndex] == null ) {

								pfpSortingWrappers[wrapper.vrmName][wrapper.textureIndex] = []
							}

							pfpSortingWrappers[wrapper.vrmName][wrapper.textureIndex].push(wrapper)

						}
					}
				}

				else {

					if( wrapper.isHighQuality ){

						wrapper.highQualityMeshes.visible = false
					}
				}

				x++
			}


			Object.keys(this.models).forEach(key => {

				const model = this.models[key]

				if( model.isHighQuality != true ) {

					// model exists, but got no matches
					if( sortingWrappers[model.name] == null || sortingWrappers[model.name].length == 0 ) {

						model.visible = false

						// if model got a pfp assigned in its option

						// hide the pfp meshes too

						if( model.pfpOptions != null ) {

							let i = 0


							while(i <  model.pfpOptions.pfpMeshes.length ) {

								 model.pfpOptions.pfpMeshes[i].visible = false

								i++
							}
						}

						return
					}


					model.visible = this.enabled

					model.instanceCount = sortingWrappers[model.name].length

					if( model.visible ) {

						// if( model.instanceCount > model.maxCreation ){

						// 	VRMMesh.updateMesh( model )
						// }

						let currentWrappers = []

						let sorted = null

						if( model.instanceCount > 0 ){

							let i = 0

							while(i < model.children.length ) {

								const geometry = model.children[i].geometry


								if( geometry.copyBuffer ) {

								    if( geometry.bufferVersion != geometry.copyBuffer.bufferVersion ){

								        geometry.updateCopyBuffers( geometry.copyBuffer )
								    }

								    geometry._maxInstanceCount = geometry.copyBuffer._maxInstanceCount
								    geometry._closestDistance  = geometry.copyBuffer._closestDistance
								}
								else {

									geometry.sort( sortingWrappers[model.name] )
								}

								i++
							}
						}
					}
				}

			})

			// pfps only

			let i = 0

			while(i < this.avatarPFPContainer.children.length ) {

				const pfpmesh = this.avatarPFPContainer.children[i]

				if( pfpSortingWrappers[pfpmesh.name] && pfpSortingWrappers[pfpmesh.name][pfpmesh.geometry.textureID] ) {

					const pfpWrappers = pfpSortingWrappers[pfpmesh.name][pfpmesh.geometry.textureID]

					// console.log( pfpWrappers )

					if( pfpWrappers ){

						pfpmesh.visible = true

						pfpmesh.geometry.sort( pfpWrappers )

					}

				}
				else {

					pfpmesh.visible = false
				}

				i++
			}
		}
	}

	setAnimations( wrapper, delta ){

        // Back owns the ready idle until the native renderer is released. Keep
        // the same action object so repeated holds never restart its clock.
        const travelIdle = nativeTravelIdleAction(wrapper);
        if (travelIdle) {
            wrapper.setCurrentAction(travelIdle);
            return;
        }

        if ( wrapper.isSitting ) {

            if ( wrapper.currentEmote ) {

                wrapper.setCurrentAction( wrapper.currentEmote )
            }

            return
        };

        // A space-authored action (including its own WALK/IDLE object) owns playback.
        if (hasCustomPlayerAction(wrapper)) return;
        if (wrapper.lobbyMotion?.update(delta)) return;

		var newAction = null

		var fall = false

		if( wrapper.smoothedFloorVelocity < 0.012 ){

			newAction = IDLE
		}

		else if( wrapper.smoothedFloorVelocity < 0.24  ) {

			newAction = WALK
		}
		else if( wrapper.smoothedFloorVelocity > 0.6 ) {

			newAction = FLY
		}
		else if( wrapper.smoothedFloorVelocity >= 0.24  ) {

			newAction = RUN
		}

		if( wrapper.onFloor == false && wrapper.isJumping == true ) {

			newAction = JUMP
		}

		if( wrapper.onFloor == false && wrapper.isJumping == false ) {

			newAction = JUMP

			fall = true
		}

		if( newAction != IDLE && wrapper.currentEmote  ){

			wrapper.stopEmote()
		}

		if( wrapper.currentEmote && newAction == IDLE ) {

			newAction = wrapper.currentEmote
		}


		if( fall == true && ( newAction == JUMP ) && newAction != wrapper.currentAction  ) {

			// confirmation threshold
			if( wrapper.actionConfirmation < 15 ) {

				wrapper.actionConfirmation++

				newAction = wrapper.currentAction
			}
		}

		else {

			wrapper.actionConfirmation = 0
		}

		wrapper.setCurrentAction( newAction )
	}


	addEvents(){

		if( this.updateEvent == null ) {

			this.updateEvent = this.update.bind(this)

			Emitter.on(Events.PRE_UPDATE, this.updateEvent )
		}
	}

	removeEvents(){

		if( this.updateEvent != null ) {

			Emitter.off(Events.PRE_UPDATE, this.updateEvent )

			this.updateEvent = null

		}
	}

	dispose( avatar ){

        if (!avatar) return;
        const index = this.wrappers.indexOf(avatar);
        if (index === -1) return;
        this.wrappers.splice(index, 1);
        avatar.dispose();

        if( avatar.isHighQuality ) {

        	avatar.highQualityMeshes.visible = false

        }

	}

	disposeAll() {

		this.wrappers = []

        for (const model of Object.values(this.models)) {
            model.removeFromParent();
            model.traverse((object) => {
                object.geometry?.dispose();
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                for (const material of materials) material?.dispose();
            });
        }
        this.models = {};
        this.removeEvents();
	}
}

export default new InstanceAvatar3D()
