import { applyNativeAvatarMaterials } from '@features/lobby/webgpu/avatarMaterials'
import PipeLineMesh from '@3abstract/pipelinemesh'

import PipeLineSkinnedMesh from '@3abstract/pipelineskinnedmesh'

import Baker from './baker/index.js'

import InstanceGeometry from './geometry.js'

import {

	Mesh,

	Vector3,

	Quaternion,

	Object3D,

	AnimationMixer,

	LoopOnce,

	SkinnedMesh,

	MeshBasicMaterial,

	MeshLambertMaterial,

	Sphere,

	SRGBColorSpace

} from 'three'


import GLTF from '@3gltf'

import Material from './material/index.js'

import {

	MAX_INSTANCES,

	FBO_DEBUG

} from '@3constants'

const _vec3 = new Vector3()

import Emitter from '@3emitter'

import Events from '@3events'

const name = 'modeltest'

import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const tempv3 = new Vector3()

const levels = [2, 10, 50, 200, MAX_INSTANCES + 3]

import FBOHelper from '@3gl/globals/fbohelper.js'

class VRMMesh {

	constructor() {

	}

	get( opts = {} ){

		const vrmName = opts.userData.VRM

		const data = {}

		const gltf = GLTF[ vrmName ]

		if( gltf?.isHighQuality ) {

			return this.getHigh( opts )
		}

		const baker = new Baker()

		var currentVRM
		try  {
			currentVRM = gltf.userData.vrm
		}
		catch(e){
			// No glTF was given; currentVRM stays undefined.
		}


		let meshes = new Object3D()

		meshes.name = vrmName

		let nb = 0

		let pfpOptions = null

		let globalMeta = gltf.userData.vrm.globalMeta
        meshes.lobbyMotion = globalMeta.lobbyMotion

		const boundingSphere = this.computeBoundingSphere(currentVRM.scene)

		currentVRM.scene.traverse( ( child ) => {

			if( child.type == 'SkinnedMesh' ) {

				let dummy = child

				// console.log(child.position)
				// console.log(child.rotation)

				const _scale = dummy.scale.clone()

				dummy.getWorldScale(_scale)

				dummy.getWorldPosition(tempv3)


				var mesh;

				if( FBO_DEBUG ) {

			         FBOHelper.attach(globalMeta.texture, 'global meta'+Math.random())
			      }


				// to do crawl first in case pfp is the first mesh to copy attributes

				if ( child.name.includes('_pfp') ){

					mesh  =
					{
						geometry : dummy.geometry,

						materialOptions:  { atlas: true, base: dummy, animationTexture: globalMeta.texture, metadata: globalMeta.metadata, scale: _scale, additionalMetas: globalMeta.additionalMeta },

						vrmName  : vrmName,

						boundingSphere: boundingSphere,
					}

					pfpOptions = mesh

				}

				else {

					const options = {boundingSphere: boundingSphere, base: dummy, animationTexture: globalMeta.texture, metadata: globalMeta.metadata, scale: _scale, additionalMetas: globalMeta.additionalMeta }

					const diffuseMaterial = new Material( options )

					const lightingMaterial = new Material( options, true )

					mesh  = new PipeLineMesh(

						new InstanceGeometry( dummy.geometry, {boundingSphere: boundingSphere, vrmName: vrmName, rotationY: true, max: levels[0], sorting: false, animations: true, opacity: true, copyBuffer : nb > 0 ? meshes.children[0].geometry : null, scale: true }),

						diffuseMaterial,

						{
							lightingMaterial : lightingMaterial,

							occlusionMaterial : diffuseMaterial.occlusionMaterial

						}
					)

					mesh.position.copy( tempv3 )

					meshes.add( mesh )

					mesh.receiveShadow = true

					mesh.matrixAutoUpdate = false

					mesh.matrixWorldAutoUpdate = false
				}

				mesh.name = child.name

				mesh.frustumCulled = false

				mesh.matrixAutoUpdate = false

				mesh.gltf = gltf

				mesh.bakeMeta = globalMeta

				nb++
			}
		})

		if( pfpOptions != null ) {

			meshes.pfpOptions = pfpOptions
		}

		meshes.maxCreation = levels[0]

		return meshes
	}

	// updateMaxCreation( model ) {
	//   const currentIndex = levels.indexOf(model.maxCreation);

	//   if (currentIndex === -1 || currentIndex === levels.length - 1) {
	// 	// If the current value is not found or it's the last item in the array, do nothing
	// 	return;
	//   } else {
	// 	// Otherwise, set maxCreation to the next value in the array
	// 	model.maxCreation = levels[currentIndex + 1];
	//   }
	// }

	// updateMesh( model ){

	// 	this.updateMaxCreation( model )

	// 	let i = 0

	// 	while(i < model.children.length ) {

	// 		const child =  model.children[ i ]

	// 		child.geometry.grow(  model.maxCreation )

	// 		i++
	// 	}

	// 	// console.log('grow model' ,  model.name , ' to ', model.maxCreation )

	// }

	getVRMAtlasMesh( opts, texture, textureID ){


		const geo = new InstanceGeometry( opts.geometry, {boundingSphere: opts.boundingSphere, scale: true, textureID : textureID, atlas: true, vrmName: opts.vrmName, rotationY: true, max: 16, sorting: false, animations: true, opacity: true })

		// The head screen shows the profile photo as authored, unlit, like the
		// lobby's avatars: room and avatar lights would shade the picture.
		const diffuseMaterial = new Material( opts.materialOptions )

		// The atlas canvas holds sRGB photos. Untagged, the sRGB output pass
		// encoded them a second time, so the picture looked washed out next to
		// the lobby's (sRGB-tagged) portrait atlas.
		if( texture.colorSpace !== SRGBColorSpace ) {

			texture.colorSpace = SRGBColorSpace

			texture.needsUpdate = true
		}

		diffuseMaterial.uniforms.map.value = texture


		const mesh = new PipeLineMesh( geo, diffuseMaterial )


		mesh.receiveShadow = true

		mesh.matrixAutoUpdate = false

		mesh.frustumCulled = false

		mesh.isPFP = true

		mesh.name = opts.vrmName

		mesh.matrixAutoUpdate = false

		mesh.matrixWorldAutoUpdate = false

		return mesh

	}

	getHigh( opts = {} ) {

		const gltf = opts.userData.VRMMeshes

		if( gltf == null ) {

			// No pooled meshes; the next line will throw.
		}

		const currentVRM = gltf.userData.vrm


		if(currentVRM == null){

			// The glTF carries no VRM; the next line will throw.
		}

		applyNativeAvatarMaterials( currentVRM.scene, 1 )
		this.replaceMeshes( currentVRM.scene )

		const currentMixer = new AnimationMixer( currentVRM.scene )

		const baker = new Baker()

		const possibleClips = baker.prepareAnimations(currentVRM).concat(currentVRM.scene.lobbyMotionClips?.clips || [])
        currentVRM.scene.lobbyMotion = currentVRM.scene.lobbyMotionClips?.metadata

		currentVRM.scene.isHighQuality = true

		currentVRM.scene.name 			= opts.userData.VRM

		currentVRM.scene.possibleClips 	= possibleClips

		currentVRM.scene.mixer 			= currentMixer

		let possibleActions = {}

		let c = 0

		while(c < possibleClips.length ) {

			possibleActions[ possibleClips[c].name ]  = currentMixer.clipAction( possibleClips[c] )

			if( possibleClips[c].loop == false ) {

				possibleActions[ possibleClips[c].name ].setLoop( LoopOnce )

				possibleActions[ possibleClips[c].name ].clampWhenFinished = true
			}

			c++
		}

		currentVRM.scene.possibleActions = possibleActions

		currentVRM.scene.vrm = currentVRM


		return currentVRM.scene
	}


	replaceMeshes( scene ) {

		try {

			const transformed = []

			const materialCache = {};

			const skeletonCache = {}

			const occlusionMaterial = new MeshBasicMaterial({color: 0x000000})
			

			scene.traverse( (object) => {

			  if (object.isMesh) {

			    var newMesh;

			    var diffuseMaterial;

			    var lightingMaterial;

			    // determine if original

				const isLightMaterial = this.isLightMaterial( object.material )

			     // Use cache for materials
				 const materialKey = object.material.uuid; // Assuming materials have unique UUIDs

				 if (materialCache[materialKey]) {

					 ({diffuseMaterial, lightingMaterial} = materialCache[materialKey]);
					
				 } else {
					 if (isLightMaterial) {
						 lightingMaterial = object.material;
						 diffuseMaterial = lightingMaterial;
					 } else {
						 diffuseMaterial = object.material;
						 // Authored unlit avatars stay unlit in every room.
                         lightingMaterial = diffuseMaterial;
					 }
 
					 // Store in cache
					 materialCache[materialKey] = {
						 diffuseMaterial,
						 lightingMaterial
					 };
				}

			    // Check if the current mesh has skinning data

			    if (object.skeleton !== undefined) {

			      // If the mesh has skinning data, create a new SkinnedMesh object

			      newMesh = new PipeLineSkinnedMesh(

			      	object.geometry,

			      	diffuseMaterial, {

				      	occlusionMaterial 			: occlusionMaterial,

				      	visibleOnOcclusion 			: true,

				      	visibleOnMirror 			: false,

				      	// isLightMaterial

				      	lightingMaterial 			: lightingMaterial,

				      	lightingOcclusionMaterial 	: occlusionMaterial

			      	}
			      )

			      newMesh.bind(object.skeleton, object.matrixWorld);

			      newMesh.skeleton = object.skeleton;

			      newMesh.bindMatrix.copy(object.bindMatrix);

			      newMesh.bindMatrixInverse.copy(object.bindMatrixInverse);

				  skeletonCache[object.skeleton.uuid] = object.skeleton

			    }

			    else {

			      // If the mesh doesn't have skinning data, create a new Mesh object

			      newMesh = new PipeLineMesh (

			      	object.geometry,

			      	diffuseMaterial,

			      	{
			      		occlusionMaterial 			: occlusionMaterial,

			      		visibleOnOcclusion 	: true,

			      		visibleOnMirror 	: false,

			      		// isLightMaterial

			      		lightingMaterial 	: lightingMaterial,

			      		lightingOcclusionMaterial 	: occlusionMaterial
			      	}
			      )
			    }

			    newMesh.position.copy(object.position);

			    newMesh.rotation.copy(object.rotation);

			    newMesh.scale.copy(object.scale);

			    newMesh.name = object.name

			    newMesh.receiveShadow = true

			   	transformed.push({
			   		new : newMesh,
			   		old : object
			   	})

			  }

			});

			let i = 0

			while( i < transformed.length ){

				const op = transformed[i]

				op.old.parent.add(op.new);

			    op.old.parent.remove(op.old);

				i++
			}

		}

		catch(e){

			console.log( e )
		}
	}

	computeBoundingSphere(object) {

		const sphere = new Sphere();

		object.traverse(child => {

			if(child.geometry){

				child.geometry.computeBoundingSphere()

				sphere.union(child.geometry.boundingSphere)

			}
		})

		return sphere
	}

	isLightMaterial( material ) {

		return material.isMeshLambertMaterial || material.isMeshToonMaterial || material.isMeshPhongMaterial ||
			material.isMeshStandardMaterial || material.isShadowMaterial ||
			material.isMeshLambertNodeMaterial === true || material.isMeshPhongNodeMaterial === true ||
			material.isMeshStandardNodeMaterial === true || material.isMeshToonNodeMaterial === true;

	}

	createDiffuseMaterialFromLight( material ){

		const mat = new MeshBasicMaterial({map: material.map ? material.map : material.emissiveMap })

		return mat
	}

	createLightMaterialFromDiffuse( material ){

		const mat = new MeshLambertMaterial({map: material.map})

		return mat
	}
}

export default new VRMMesh()
