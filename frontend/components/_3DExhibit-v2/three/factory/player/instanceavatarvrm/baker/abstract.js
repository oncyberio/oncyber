import {

	AnimationMixer,

	DataTexture,

	RGBAFormat,

	FloatType,

	Skeleton,

	Scene,

	BufferAttribute

} from 'three'


import Packer from '@3utils/packer.js'
const TEXTURE_SIZE_W = 2048
const TEXTURE_SIZE_H = 2048


import {

	POSSIBLE_ACTIONS

} from '../constants.js'

import loadMixamoAnimation from './loadmixamoanimation.js'
import readyIdle from './readyIdle.js'
import { prepareNativeLobbyClips } from '../lobbyMotionClips'


export default class AbstractBaker {

	constructor(){

		this.packer = new Packer( TEXTURE_SIZE_W, TEXTURE_SIZE_H )

		this.packer.init( TEXTURE_SIZE_W , TEXTURE_SIZE_H)

	}

	setAnimationJson( val ){

		// Available before avatar preparation: travel never waits for a clip fetch.
		this.jsonAnimation = [ ...val.filter(clip => clip.name !== readyIdle.name), readyIdle ]
	}

	async prepare( vrm ){

		const lobby = await prepareNativeLobbyClips(vrm)
        const clips = this.prepareAnimations( vrm ).concat(lobby?.clips || [])

		let id = 0

		const { mergedSkeleton, boneMap } = this.updateSkeleton(vrm.scene)
		// supress springs 

		vrm.springBoneManager = null

		vrm.update( 0 );

		vrm.scene.position.copy( vrm.scene.position )

		// The lobby motion failed to load (it is optional): the bake works
		// without it, but must not be cached (bakeJob.js).
		const lobbyMotionFailed = lobby === undefined

		try {
            const result = this.bakeAll(vrm, clips, mergedSkeleton, boneMap)
            result.lobbyMotion = lobby?.metadata
            if (lobbyMotionFailed) result.lobbyMotionFailed = true
            return result
        } catch (error) {
            if (error.code !== "LOBBY_ATLAS_FULL") throw error
            // No partial pack or shifted emote indices on large/legacy rigs.
            const result = this.bakeAll(vrm, clips.filter(clip => !clip.name.startsWith("@lobby/")), mergedSkeleton, boneMap)
            if (lobbyMotionFailed) result.lobbyMotionFailed = true
            return result
        }

	}

	updateSkeleton( scene, processedBoneMap = null ){

		let skeletons = []

		let meshes = []

		scene.traverse(( child )=>{

			if( child.type == 'SkinnedMesh' ) {

				skeletons.push( child.skeleton )

				meshes.push( child )
			}
		})


		const { skeleton: mergedSkeleton, boneMap } = this.mergeSkeletons(skeletons);
		
		meshes.forEach((mesh) => {

		  this.updateSkinIndices(mesh.geometry, mesh.skeleton, processedBoneMap != null ? processedBoneMap : boneMap )

		})


		return { mergedSkeleton, boneMap }
	}


	prepareAnimations( vrm ){

		let needAnimation = false

		vrm.scene.traverse( ( child ) => {

			if(child.type == 'SkinnedMesh' ){

				needAnimation = true
			}
		})

		var possibleClips = []

		if( needAnimation ) {

			let i = 0

			while(i < POSSIBLE_ACTIONS.length ) {

				var act = POSSIBLE_ACTIONS[i]

				let b = 0

				while(b < this.jsonAnimation.length ) {

					if( this.jsonAnimation[b].name == act.name.toLowerCase() ) {

						const clip = loadMixamoAnimation( vrm.scene, vrm, this.jsonAnimation[b] )

						clip.name = act.name

						clip.loop = act.loop == true

						possibleClips.push(clip)
					}

					b++
				}

				i++
			}
		}

		return possibleClips
	}

	mergeSkeletons(skeletons) {
	  const mergedBones = [];
	  const boneMap = new Map();

	  skeletons.forEach((skeleton) => {
	    skeleton.bones.forEach((bone) => {
	    	// console.log(bone.name)
	      if (!boneMap.has(bone.name)) {
	        boneMap.set(bone.name, mergedBones.length);
	        mergedBones.push(bone);
	      }
	    });
	  });

	  return {
	    skeleton: new Skeleton(mergedBones),
	    boneMap,
	  };
	}

	updateSkinIndices(geometry, originalSkeleton, boneMap) {
	  const skinIndices = geometry.attributes.skinIndex.array;

	  for (let i = 0; i < skinIndices.length; i++) {
	    const boneName = originalSkeleton.bones[skinIndices[i]].name;
	    // console.log(boneName,skinIndices[i], 'new index : ',  boneMap.get(boneName))
	    skinIndices[i] = boneMap.get(boneName);
	  }
	}


}