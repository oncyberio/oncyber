import {

	AnimationMixer,

	DataTexture,

	RGBAFormat,

	FloatType,

	Skeleton,

	Scene,

	BufferAttribute

} from 'three'

import { FBO_DEBUG } from '@3constants'

import FBOHelper from '@3gl/globals/fbohelper.js'

// Loaded on demand (animationData.js); GLTF.load awaits it before any Baker exists.
import { bakerAnimations } from './animationData.js'


const fps = 30

const delta = 1 / 30

import DataBake from './datatexture.js'


var id = 0

import AbstractBaker from './abstract.js'



let DataBakeConstructor;



export default class Baker extends AbstractBaker {

	constructor(){

		super()

		this.setAnimationJson( bakerAnimations() )

	}
	
	// bakeAll( currentVrm, model, clips, skin) {
	bakeAll( currentVrm, clips, skeleton, boneMap ) {

		// this.skin.skeleton.computeBoneTexture()

		this.frameCount   = -1

		this.boneCount = skeleton.bones.length;

		this.maxBoneElements = this.boneCount * 4 * 4

		const mixer = new AnimationMixer( currentVrm.scene )

		const ids = []

		var res = []

		const loops = []

		let i = 0


		// currentVrm.scene.updateWorldMatrix(true, true)

		while( i < clips.length ) {

			res.push( this.getBakedClip2( currentVrm, mixer, skeleton, clips[i] ) )

			ids.push( clips[i].name )

			loops.push(clips[i].loop)

			i++
		}


		// if( FBO_DEBUG ) {

		// 	FBOHelper.attach ( this.skin.skeleton.boneTexture , 'bones' + id)
		// }
		
		// metadata size for uvs / scale etc..

		const metadataSize = res.length

		const metadataArray = new Float32Array( metadataSize * 4 )

		var metaDataBlock = {

			w : metadataSize,
			h : 1,
			url : 'metadata',
			image: new DataTexture( metadataArray, metadataSize, 1,  RGBAFormat, FloatType )
		}

		res.push( metaDataBlock )


		// additional metadata for loops etc.. 

		const metaDataAdditionals = new Float32Array( metadataSize * 4 )

		const metaDataAdditionalsArray = new Float32Array( metadataSize * 4 )

		var metaDataAdditionalsBlock = {

			w : metadataSize,
			h : 1,
			url : 'metadataadditionals',
			image: new DataTexture( metaDataAdditionalsArray, metadataSize, 1,  RGBAFormat, FloatType )
		}

		res.push( metaDataAdditionalsBlock )

		this.packer.reset()

		this.packer.fit( res )
        if (clips.some(clip => clip.name.startsWith("@lobby/")) && res.some(block => block.textureIndex > 0 || block.fit?.dummy)) {
            for (const block of res) block.image.dispose();
            const error = new Error("Shared motion exceeds the native avatar atlas budget");
            error.code = "LOBBY_ATLAS_FULL";
            throw error;
        }

		this.bakeTexture = new DataBake( this.packer.maxSize.w, this.packer.maxSize.h )

		i = 0

		// const metaDataArray = []


		while( i < res.length ) {

			if( res.url != 'metadata' && res.url != 'metadataadditionals' ){

				this.bakeTexture.update( res[i].image, res[i].fit.x, res[i].fit.y )

				res[i].uvScale = {
				    x: res[i].w / this.packer.maxSize.w,
				    y: res[i].h / this.packer.maxSize.h,

				}

				res[i].uvPos = {
				    x:  res[i].fit.x / this.packer.maxSize.w,
				    y:  res[i].fit.y / this.packer.maxSize.h
				}

				if( FBO_DEBUG ) {

					FBOHelper.attach ( res[i].image , 'animtex' + res[i].url)

					res[i].image.needsUpdate = true
				}

				const dat = metaDataBlock.image.source.data.data

				dat[ i * 4     ] = res[i].uvPos.x
				dat[ i * 4 + 1 ] = res[i].uvPos.y
				dat[ i * 4 + 2 ] = res[i].uvScale.x
				dat[ i * 4 + 3 ] = res[i].uvScale.y


				const additionalMeta = metaDataAdditionalsBlock.image.source.data.data

				additionalMeta[ i * 4 ] = loops[i]
                additionalMeta[ i * 4 + 1 ] = res[i].duration || 0

			}

			i++
		}

		// clean 

		// update metadata in texture

		this.bakeTexture.update( metaDataBlock.image, metaDataBlock.fit.x, metaDataBlock.fit.y )

		this.bakeTexture.needsUpdate = true 

		id++


		let c = 0

		while( c < res.length ) {

			res[c].image.dispose()
			res[c].data = null 

			res[c] = null
			c++
		}

		skeleton.pose()

		skeleton.update()

		return { boneMap: boneMap, texture: this.bakeTexture, metadata : metaDataBlock, ids: ids, metaDataArray: metadataArray, additionalMeta : metaDataAdditionalsBlock  }

	}


	getBakedClip2( currentVrm, mixer, skeleton, clip ){

		this.delta = 0

		const duration   = clip.duration

		const sharedMotion = clip.name.startsWith("@lobby/")
        const frameCount = sharedMotion ? Math.ceil(duration / delta) + 1 : Math.floor(duration / delta)

		const action = mixer.clipAction( clip ).play()

		const textureSize = (this.boneCount) * 4 * 4 * frameCount

        const vertexData = new Float32Array(textureSize)

		var d = 0

		var currentFrame = 0



		// currentVrm.nodeConstraintManager = null
		// currentVrm.springBoneManager = null

		// console.log( currentVrm)

		while(  currentFrame < frameCount ) {


			if (sharedMotion) {
                action.time = Math.min(currentFrame * delta, duration);
                mixer.update(0);
            } else mixer.update(delta)

			currentVrm.update( delta );

			currentVrm.scene.copy(currentVrm.scene.position)

			d += delta

			let i = 0

			let hasBoneFirstChild = false

			while(i < currentVrm.scene.children.length ) {

				if(currentVrm.scene.children[i].isBone){

					hasBoneFirstChild = true

					currentVrm.scene.children[i].updateWorldMatrix(false, true)
				}

				i++
			}

			// needs to update everything..
			if( hasBoneFirstChild == false ) {

				currentVrm.scene.updateWorldMatrix(false, true)
			}

			skeleton.update()

			i = 0

			while( i < this.maxBoneElements ){

				const index = this.maxBoneElements * currentFrame + i 

				vertexData[ index ] = skeleton.boneMatrices[i]

				i++
			}

			currentFrame ++

		}

		action.stop()

		const width = (this.boneCount) * 4

		return {

			data: vertexData,

			image : new DataTexture(vertexData, width , frameCount, RGBAFormat, FloatType),

			url : clip.name,

			w: width,

			h: frameCount,

			frames : frameCount,

			duration: duration
		}
	}

	
}