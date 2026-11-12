// @ts-check

import InstancedPipelineMesh 		from '@3abstract/instancedpipelinemesh'

import InstancedGeometry 	from '@3abstract/instancedgeometry'

import DebugBoxFactory 		from '@3gl/factory/debugbox'

import DiffuseMaterial 			from './material/diffusematerial.js'

import LightMaterial 			from './material/standardmaterial.js'

import FutureMaterial from './material/index.js'
// CYBER_CITY

import {

	Box3, BufferGeometry, Sphere, Mesh, Material

} from 'three'

import {

	DEBUG,

	UPLOADER_MODE,

	CYBER_CITY,
    EDIT_MODE

} from '@3constants'

import GUI from '@3gui'

const box = new Box3();

let isEditing = UPLOADER_MODE || EDIT_MODE

/**
 *
 * @typedef {object} KitBashBaseItem
 * @property {string} name
 * @property {InstancedPipelineMesh} mesh
 * @property {Mesh<BufferGeometry, Material>} collision
 * @property {BufferGeometry} raycastGeometry
 *
 * @typedef {object} KitBashElementType
 * @property {KitBashBaseItem[]} baseItems
 * @property {Box3} baseBox
 * @property {Mesh} collision
 * @property {BufferGeometry} raycastGeometry
 * @property {string} [previewImg]
 * @property {Array<any>} [accessors]
 *
 *
 * @param {any} res
 * @returns {Record<string, KitBashElementType>}
 */
export default function getTypes( res, data = {}, opts  ) {

    isEditing = UPLOADER_MODE || EDIT_MODE

	/** @type {Record<string, KitBashElementType>} */
	const types = {}

	let blocks = res.children

	let i = 0

	const texs 			= new Map()

	while( i < blocks.length ) {

		const currentBlock 	= blocks[i]

		const blockChilds 	= currentBlock.children

		const items 		= []

		let previewImg;

		let contains = true

		let count    = 0

		let containsCollision = null

		let g = 0

		var needsCollision = true

		while( g < blockChilds.length ) {

			if( blockChilds[g].name.includes('collision')){

				containsCollision = blockChilds[g]

			}

			if( blockChilds[g].name.includes('nocollider') == true ) {

				needsCollision = false
			}

			g++
		}

		if( isEditing == false ) {

			let c = 0

			for ( let key in data ) {

				if( data[key].type == currentBlock.name ) {

					count++
				}

				c++
			}
		}

		if ( types[currentBlock.name] == null ){

			const box = new Box3()

			box.expandByObject(currentBlock)

			var collisionMesh;

			var raycastGeometry;

			// console.log( "containsCollision" )
			// console.log( containsCollision )

			if( containsCollision ) {

				collisionMesh = new Mesh( containsCollision.geometry.clone() )
			}

			else {

				collisionMesh = DebugBoxFactory.getMeshFromObjects(currentBlock )
			}

			raycastGeometry = collisionMesh.geometry.clone()

			desinterleave(raycastGeometry)

			const blockSphere = computeBoundingSphere(currentBlock)


			// if blocks got childrens

			// make them all the same instance

			if( blockChilds.length > 0 ) {

				// above 2


				if( blockChilds.length > 1 ) {


					var copyBuffer = null

					blockChilds.forEach( ( block ) => {

						// if there's no collision

						if( block.name.includes('collision') == false ) {

							const item = constructItems( block, {

								boundingSphere 			: blockSphere,

								copyBuffer  			: copyBuffer,

								transparencySorting 	: block.material.transparent && block.material.opacity < 1,

								count 					: count,

								roomParameters 			: opts.roomParameters
							} )

							items.push( item )

							// first object is the copy buffer

							if( copyBuffer == null ) {

								copyBuffer = item.mesh.geometry
							}
						}

					})
				}

				else {

					blockChilds.forEach( ( block ) => {

						items.push( constructItems(block, {

							boundingSphere 			: blockSphere,

							count : count,

							roomParameters 			: opts.roomParameters

						}) )
					})
				}
			}

			else if( currentBlock.geometry && currentBlock.material ) {

				const block = currentBlock

				items.push( constructItems(block) )

			}

			if( items.length != 0 ) {

				types[currentBlock.name] = {

					baseItems : items,

					collision : needsCollision ? collisionMesh : null,

					raycastGeometry : raycastGeometry,

					baseBox   : box,

					// TODO: preview image
					previewImg: previewImg || "/textures/flower.png",

				}
			}
		}

		i++
	}

	return types
}

function constructItems( block, opts = {} ){

	desinterleave( block.geometry )

	if(  opts.containsCollision ) {

		desinterleave( opts.containsCollision.geometry )
	}

	var collisionMesh = opts.containsCollision ? new Mesh( opts.containsCollision.geometry.clone() ) : DebugBoxFactory.getMesh( block.geometry )

	const raycastGeometry = collisionMesh.geometry.clone()

	var constructorLightMaterial = ( opts.roomParameters?.cybercity == true || CYBER_CITY ) ? FutureMaterial : LightMaterial



	// if(block.material.alphaTest  != 0  ){

	// 	console.log( block.material )

	// 	window.mat = block.material

	// }

	// if( block.material.transparent != false ) {

	// 	console.log( block.material )

	// 	window.mat = block.material

	// 	debugger
	// }


	const lightMaterial = new constructorLightMaterial( block, {

		uniforms: {

			map: {
				value: block.material.emissiveMap || block.material.map
			}

		},

		fog: true,

		color: block.material.color,

		side : block.material.side,

		transparent: block.material.transparent,

		alphaTest: block.material.alphaTest,

		opacity: block.material.opacity,

		instance: true
	})


	var constructorDiffuseMaterial = ( opts.roomParameters?.cybercity == true || CYBER_CITY ) ? FutureMaterial : DiffuseMaterial

	const diffuseMaterial = new constructorDiffuseMaterial( block, {

		uniforms: {

			map: {

				value: block.material.emissiveMap || block.material.map
			},



		},

		color: block.material.color,

		opacity: block.material.opacity,

		fog: true,

		side : block.material.side,

		transparent: block.material.transparent,

		alphaTest: block.material.alphaTest,

		instance: true
	})


	console.log('transpanrec sorting : ', opts.transparencySorting)

	const item = {

		name 	 : block.name,

		mesh 	 : new InstancedPipelineMesh (

			new InstancedGeometry( block.geometry, {

				max: opts.count,

				// rotationY: true,

                rotation: true,

				scale: true,

				copyBuffer : opts.copyBuffer,

				boundingSphere : opts.boundingSphere,

				// transparencySorting: block.name.includes('screen')
				transparencySorting: opts.transparencySorting ? opts.transparencySorting : block.name.includes('screen'),

				useNormal: true,

				name : block.name + '_geometry'
				// passing a max count for buffer when not upload mode

			}),

			diffuseMaterial,

			{
				lightingMaterial: lightMaterial,

				type: block.name

				// visibleOnMirror: false
			}
		),

		// collision : needsCollision ? collisionMesh : null,

		// raycastGeometry : raycastGeometry,

	}


	item.mesh.castShadow = true

	item.mesh.receiveShadow = true



	item.mesh.matrixAutoUpdate 		= false 

	item.mesh.matrixWorldAutoUpdate = false

	return item

}

function desinterleave( geometry ){

	if ( geometry.attributes.color ) {

		geometry.deleteAttribute("color")
	}

	if( geometry.attributes.position.isInterleavedBufferAttribute ) {

		geometry.attributes.position = geometry.attributes.position.clone()
	}

	if( geometry.attributes?.uv?.isInterleavedBufferAttribute ) {

		geometry.attributes.uv = geometry.attributes.uv.clone()
	}


	if( geometry.attributes?.normal?.isInterleavedBufferAttribute ) {

		geometry.attributes.normal = geometry.attributes.normal.clone()
	}

}

function computeBoundingSphere(object) {

	const sphere = new Sphere();

	object.traverse(child => {

		if(child.geometry){

			child.geometry.computeBoundingSphere()

			sphere.union(child.geometry.boundingSphere)

		}
	})

	return sphere
}



