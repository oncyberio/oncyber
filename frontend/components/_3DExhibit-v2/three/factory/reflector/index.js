// @ts-check
import MeshReflector from './mesh.js'

import { PlaneGeometry, MeshBasicMaterial, BufferAttribute, Box3, Vector3, BufferGeometry, Mesh, Matrix4, Quaternion } from 'three'

import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const position = new Vector3(); // create one and reuse it
const quaternion = new Quaternion();
const scale = new Vector3();

const tempNormal = new Vector3()

const rotationMatrix = new Matrix4();




class Reflector {


	get( scene ){

		const box = new Box3()

		box.setFromObject( scene )

		const size = new Vector3()
		const pos = new Vector3()

		size.x = box.max.x - box.min.x
		size.y = (box.max.y - box.min.y) * 2
		size.z = box.max.z - box.min.z


		pos.x = (box.max.x + box.min.x) * 0.5
		pos.y = 0
		pos.z = (box.max.z + box.min.z) * 0.5


		const plane = new PlaneGeometry( size.x ,size.z  );

		const res = new MeshReflector( plane, {textureWidth: 1024, textureHeight: 1024, clipBias: 0.00} )

		res.rotation.x = -Math.PI * 0.5

		res.position.copy(pos)

		return res

		// console.log( mesh )
	}

	getRaw( opts = {} ){

		const plane = new PlaneGeometry( 1 ,1  );

		const reflector = new MeshReflector( plane, opts )

		reflector.rotation.x = -Math.PI * 0.5

		if( opts.roomParameters && opts.roomParameters.reflectorOptions ){

			reflector.position.copy( opts.roomParameters?.reflectorOptions?.position )

			reflector.scale.x = opts.roomParameters?.reflectorOptions.scale.x

			reflector.scale.y = opts.roomParameters?.reflectorOptions.scale.z

			reflector.opacity = opts.roomParameters?.reflectorOptions.opacity

			reflector.color = opts.roomParameters?.reflectorOptions.color

			reflector.useNormalMap =  opts.roomParameters?.reflectorOptions?.normalmap.enabled

			reflector.normalStrength = opts.roomParameters?.reflectorOptions?.normalmap.strength

			reflector.tiles = opts.roomParameters?.reflectorOptions?.normalmap.tiles
			
			reflector.blur = opts.roomParameters?.reflectorOptions?.blur

			if ( opts.roomParameters?.reflectorOptions?.normalmap.enabled ) {

			    reflector.normalMap =  opts.roomParameters?.reflectorOptions.normalmap.images.path
			}
		}

		reflector.renderOrder = -10000

		return reflector

	}

		// getFromObject(objects){

		// 	let i = 0

		// 	const geometries = []


		// 	let index = 0

		// 	let indexOffset = 0

		// 	let map = null

		// 	let indexes = []

		// 	while(i < objects.children.length) {

		// 		const child = objects.children[i]

		// 		const geo = child.geometry.clone()

		// 		geo.applyMatrix4(child.matrixWorld);

		// 		const attributes = geo.attributes

		// 		const attrKeys = Object.keys(attributes)

		// 		// console.log(geo)
		// 		// console.log(geo)
		// 		// console.log(geo)

		// 		indexes.push( ...geo.index.array )

		// 		let g = 0

		// 		if( map == null ) {

		// 			map = {}

		// 			while( g < attrKeys.length ) {

		// 				const key = attrKeys[g]

		// 				if( map[key] == null ) {

		// 					map[key] = {

		// 						content: [],

		// 						offset : attributes[key].offset,

		// 						itemSize : attributes[key].itemSize,

		// 						index : geo.index.array
		// 					}
		// 				}

		// 				g++
		// 			}
		// 		}

		// 		const interleaveBuffer = geo.getAttribute("position")

		// 		const stride = interleaveBuffer.data.stride

		// 		const totalLength = interleaveBuffer.data.array.length

		// 		g = 0

		// 		// for all keys
		// 		while( g < attrKeys.length ) {

		// 			let m = 0

		// 			const currentMap = map[attrKeys[g]]

		// 			// browse the entire interleave buffer
		// 			while( m < totalLength ) {

		// 				let p = 0

		// 				// for all the itemSize of the current key attribute

		// 				while( p < currentMap.itemSize ){

		// 					const index = m + p + currentMap.offset

		// 					currentMap.content.push( interleaveBuffer.data.array[index] )

		// 					p++
		// 				}

		// 				// add the total stride
		// 				m += stride
		// 			}

		// 			// while( m < interleaveBuffer.)
		// 			// let i =


		// 			g++
		// 		}

		// 		i++

		// 		index++
		// 	}


		// 	const plane = new BufferGeometry()

		// 	// this.setIndex( new BufferAttribute( geometry.index.array, 1 ) )
		// 	//    70          }
		// 	//    71
		// 	//    72          if( geometry.attributes.position ){
		// 	//    73
		// 	//    74:         	this.setAttribute( 'position',  new BufferAttribute( geometry.attributes.position.array, 3))
		// 	//    75          }
		// 	//    76
		// 	//    77          if( geometry.attributes.normal ){
		// 	//    78
		// 	//    79:             this.setAttribute( 'normal',  new BufferAttribute( geometry.attributes.normal.array, 3))
		// 	//    80          }
		// 	//    81
		// 	//    82          if( geometry.attributes.uv ){
		// 	//    83
		// 	//    84:         	this.setAttribute( 'uv',  new BufferAttribute( geometry.attributes.uv.array, 2))
		// 	//    85          }
		// 	//    86

		// 	// geom.setIndex( new BufferAttribute)

		// 	plane.setIndex( new BufferAttribute( new Uint16Array( indexes ), 1 ) )

		// 	plane.setAttribute( 'position',  new BufferAttribute( new Float32Array( map['position'].content ), 3))

		// 	plane.setAttribute( 'normal',  new BufferAttribute( new Float32Array( map['normal'].content ), 3))

		// 	console.log(plane)

		// 	plane.rotateX(Math.PI * 0.5)

		// 	// const mes


		// 	// const plane = BufferGeometryUtils.mergeBufferGeometries(
	 //  //           geometries,
	 //  //           false
	 //  //       );


	 //        const res = new MeshReflector( plane, {textureWidth: 1024, textureHeight: 1024, clipBias: 0.00} )
	 //        // const res = new Mesh( plane, new MeshBasicMaterial({color:0xff0000}))

	 //  		res.rotation.x = -Math.PI * 0.5

	 //        // res.position.copy(pos)

	 //        return res
		// }


	getFromObject(objects){

		let i = 0

		var positionArray   = []

		var normalArray 	= []

		objects.traverse((child)=>{


			if ( child.geometry  ){

				child.updateMatrixWorld()

				var geo = child.geometry.toNonIndexed()

				let i = 0

				// child.matrixWorld.decompose( position, quaternion, scale );

				// console.log( position )
				// console.log( quaternion )
				// console.log( scale )

				rotationMatrix.extractRotation( child.matrixWorld );


				while(i < geo.attributes.position.array.length ){

					geo.attributes.position.array[i    ] += geo.attributes.normal.array[ i     ]  * 0.1
					geo.attributes.position.array[i + 1] += geo.attributes.normal.array[ i + 1 ]  * 0.1
					geo.attributes.position.array[i + 2] += geo.attributes.normal.array[ i + 2 ]  * 0.1

					tempNormal.set( geo.attributes.normal.array[ i ] , geo.attributes.normal.array[ i + 1], geo.attributes.normal.array[ i + 2] )

					tempNormal.applyMatrix4( rotationMatrix );

					i+=3
				}

				geo.applyMatrix4(child.matrixWorld)

				// geo.applyMatrix4(child.matrixWorld)

				positionArray.push(...geo.attributes.position.array)
				// normalArray.push(...geo.attributes.normal.array)


			}
		})

		// console.log( quaternion )
		// console.log( quaternion )
		// console.log( quaternion )



		const plane = new BufferGeometry()

		plane.setAttribute( 'position',  new BufferAttribute( new Float32Array( positionArray ), 3))

		// plane.rotateX( Math.PI * 0.5)

        const res = new MeshReflector( plane, {textureWidth: 1024, textureHeight: 1024, clipBias: 0.00} )



        res.tNormal = tempNormal

        tempNormal.x *= -1
        tempNormal.y *= -1
        tempNormal.z *= -1

        console.log(tempNormal)
        console.log(tempNormal)
        console.log(tempNormal)
        // this.quaternion.multiply( _q1 );

        // res.quaternion.copy( quaternion )

        // console.log( res )
        // console.log( res )
        // console.log( res )
        // console.log( res )
        // res.rotation.x = -Math.PI * 0.5
  		// res.position.y += 0.1

        return res
	}

}

export default new Reflector()
