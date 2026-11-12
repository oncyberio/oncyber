import {

	BufferGeometry,

	BufferAttribute

} from 'three'

export default class Geometry extends BufferGeometry {

	constructor(config){

		super()

		this.config = config

		this.count 	= config.count

		config.posCount = []


		let max 	= 0

		this.linesMap = []

		this.position = []
		this.previous  = []
		this.next  = []
		this.width = []
		this.color = []
		this.life = []

		this.indices = []

		this.side = []

		this.uvs  = []

		let j = 0

		let i = 0

		let cumul = 0
		

		while(i < this.count){

			let currentRes = config.res[i]

			config.posCount[i] = 0

			let range = 1 / (currentRes - 1)


			let j = 0

			while( j < currentRes * 2 ) {


				this.side.push(  1 )

				this.side.push( -1 )

				this.position.push(0,0,0)
				this.position.push(0,0,0)

				this.previous.push(0,0,0)
				this.previous.push(0,0,0)

				this.next.push(0,0,0)
				this.next.push(0,0,0)

				this.life.push(1)
				this.life.push(1)

				this.width.push( config.width[i] )
				this.width.push( config.width[i] )

				this.color.push( config.colors[i][0],config.colors[i][1],config.colors[i][2] )
				this.color.push( config.colors[i][0],config.colors[i][1],config.colors[i][2] )

				this.uvs.push(  range * ( j * (0.5) % currentRes ) ) 
				this.uvs.push(  range * ( j * (0.5) % currentRes ) ) 

				config.posCount[i] += (2 * 3)

				j += 2
			}


			this.linesMap.push({

				start: cumul ,
				end  : cumul + currentRes  - 1
			})

			cumul += currentRes


			i++
		}

		// console.log(this.linesMap)

		i = 0

		let maxIndexes = 0

		while( i < this.count ){

			let currentCount = config.posCount[i] / 6 - 1

			let currentRes 	 = config.res[i]

			j = 0

			while( j < currentCount ){

				var n = j * 2 + maxIndexes;

				if ( j % currentRes == currentRes - 1 ){

					let aaa = this.indices.length - 1

					this.indices.push( this.indices[aaa],this.indices[aaa],this.indices[aaa] )

					this.indices.push( n + 3, n + 3, n + 3 )

				}

				else {

					this.indices.push( n, n + 1, n + 2 )

					this.indices.push( n + 2, n + 1, n + 3 )

				}

				j++
			}

			maxIndexes += currentRes * 2

			i++
		}

		// this.fill()

		// let i = 0

		// while(i < this.count){

		// 	this.fillLine(i)

		// 	i++
		// }
	
		this.setAttribute( 'uvs', new BufferAttribute( new Float32Array(this.uvs), 1 ) );
		this.setAttribute( 'side', new BufferAttribute( new Float32Array(this.side), 1 ) );
		this.setAttribute( 'position', new BufferAttribute( new Float32Array(this.position), 3));
		this.setAttribute( 'previous', new BufferAttribute( new Float32Array(this.previous), 3));
		this.setAttribute( 'next', new BufferAttribute( new Float32Array(this.next), 3));
		this.setAttribute( 'width', new BufferAttribute( new Float32Array(this.width), 1));
		this.setAttribute( 'color', new BufferAttribute( new Float32Array(this.color), 3));
		this.setAttribute( 'life', new BufferAttribute( new Float32Array(this.life), 1));
		this.setIndex( new BufferAttribute( new Uint16Array( this.indices ), 1 ) );
	}

	setColor( colors ){

		// const res = 8

		let i = 0

		const arr =  this.attributes.color.array

		let cumul = 0
		
		// per res 

		while(i < this.config.res.length ) {

			const currentRes = this.config.res[i] * 2

			let rdmColor = colors[ i % colors.length ]

			let g =  0

			while( g < currentRes ) {

				arr[ cumul + g * 6     ]  = rdmColor[0]
				arr[ cumul + g * 6 + 1 ]  = rdmColor[1]
				arr[ cumul + g * 6 + 2 ]  = rdmColor[2]

				arr[ cumul + g * 6 + 3 ]  = rdmColor[0]
				arr[ cumul + g * 6 + 4 ]  = rdmColor[1]
				arr[ cumul + g * 6 + 5 ]  = rdmColor[2]

				g++
			}

			i++

			cumul += (currentRes * 6) / 2

		}

		this.attributes.color.needsUpdate = true

	}

	// fill(){

	// 	let i = 0

	// 	let c = 0

	// 	let dd = 0

	// 	let rangeCount = this.count == 1 ? 0 :  1 / (this.count - 1)

	// 	while(i < this.count ) {

	// 		c = 0

	// 		let start = dd

	// 		while( c < this.res ) {

	// 			let index = dd

	// 			this.position[ index     ] = ( 1 / (this.res   - 1)  ) * c
	// 			this.position[ index + 1 ] = ( 1  * rangeCount ) * i 
	// 			this.position[ index + 2 ] = 0
	// 			this.position[ index + 3 ] = this.position[ index     ]
	// 			this.position[ index + 4 ] = this.position[ index + 1 ]
	// 			this.position[ index + 5 ] = this.position[ index + 2 ]

	// 			c++

	// 			dd += 6
	// 		}

	// 		this.linesMap.push({

	// 			start: start / 6,
	// 			end  : dd / 6 - 1
	// 		})

	// 		i++
	// 	}

	// 	i  = 0

	// 	dd = 0

	// 	while( i < this.position.length / 6 ) {

	// 		let index = dd

	// 		if( index % this.res == 0 ){ 

	// 			this.previous.push( this.position[ index * 6 ] )
	// 			this.previous.push( this.position[ index * 6 + 1 ] )
	// 			this.previous.push( this.position[ index * 6 + 2] )

				
	// 			this.previous.push( this.position[ index * 6 ] )
	// 			this.previous.push( this.position[ index * 6 + 1 ] )
	// 			this.previous.push( this.position[ index * 6 + 2] )


	// 			this.next.push( this.position[ index * 6 + 6] )
	// 			this.next.push( this.position[ index * 6 + 7] )
	// 			this.next.push( this.position[ index * 6 + 8] )

	// 			this.next.push( this.position[ index * 6 + 6] )
	// 			this.next.push( this.position[ index * 6 + 7] )
	// 			this.next.push( this.position[ index * 6 + 8] )

	// 		}

	// 		else if( index % this.res == this.res - 1 ) {

	// 			this.previous.push( this.position[ index * 6 - 3] )
	// 			this.previous.push( this.position[ index * 6 - 2] )
	// 			this.previous.push( this.position[ index * 6 - 1] )

	// 			this.previous.push( this.position[ index * 6 - 3] )
	// 			this.previous.push( this.position[ index * 6 - 2] )
	// 			this.previous.push( this.position[ index * 6 - 1] )

	// 			this.next.push( this.position[ index * 6     ] )
	// 			this.next.push( this.position[ index * 6 + 1 ] )
	// 			this.next.push( this.position[ index * 6 + 2 ] )
				
	// 			this.next.push( this.position[ index * 6     ] )
	// 			this.next.push( this.position[ index * 6 + 1 ] )
	// 			this.next.push( this.position[ index * 6 + 2 ] )

	// 		}

	// 		else {

	// 			this.previous.push( this.position[ index * 6 - 3] )
	// 			this.previous.push( this.position[ index * 6 - 2] )
	// 			this.previous.push( this.position[ index * 6 - 1] )

	// 			this.previous.push( this.position[ index * 6 - 3] )
	// 			this.previous.push( this.position[ index * 6 - 2] )
	// 			this.previous.push( this.position[ index * 6 - 1] )

	// 			this.next.push( this.position[ index * 6 + 6] )
	// 			this.next.push( this.position[ index * 6 + 7] )
	// 			this.next.push( this.position[ index * 6 + 8] )

				
	// 			this.next.push( this.position[ index * 6 + 6] )
	// 			this.next.push( this.position[ index * 6 + 7] )
	// 			this.next.push( this.position[ index * 6 + 8] )
	// 		}

	// 		i++

	// 		dd++
	// 	}
	// }

	getPosition( index ){

		return {
			x : this.attributes.position.array[ this.linesMap[ index ].start * 6 	   ] ,
			y : this.attributes.position.array[ this.linesMap[ index ].start * 6 + 1 ] ,
			z : this.attributes.position.array[ this.linesMap[ index ].start * 6 + 2 ] 
		}
	}

	update( id , pos ){

		this.updatePosAtIndex(id , pos )

		this.attributes.position.needsUpdate = true
		this.attributes.next.needsUpdate = true
		this.attributes.previous.needsUpdate = true
	}

	updateAllLifeAtIndex(index, life){

		let start  	= this.linesMap[ index ].start * 2
		let end  	= (this.linesMap[ index ].end + 1 ) * 2
		let res 	= this.config.res[index]
		let diff 	= end - start

		let i = 0

		while( i < diff / 2 ){

			this.attributes.life.array[ start + ( 2 * i ) 	 ]  = life
			
			this.attributes.life.array[ start + ( 2 * i ) + 1 ] = life

			i+=1
		}

		this.attributes.life.needsUpdate = true
	}

	updateAllPosAtIndex(index, pos){

		let start  	= this.linesMap[ index ].start * 6
		let end  	= (this.linesMap[ index ].end + 1 ) * 6
		let res 	= this.config.res[index]
		let diff 	= end - start

		let i = 0


		while( i < diff / 6 ){


			this.attributes.position.array[ start + ( 6 * i ) 	 ]  = pos.x
			this.attributes.position.array[ start + ( 6 * i ) + 1 ] = pos.y
			this.attributes.position.array[ start + ( 6 * i ) + 2 ] = pos.z

			this.attributes.position.array[ start + ( 6 * i ) + 3 ] = pos.x
			this.attributes.position.array[ start + ( 6 * i ) + 4 ] = pos.y
			this.attributes.position.array[ start + ( 6 * i ) + 5 ] = pos.z

			i+=1

		}

		this.memcpy( this.attributes.position.array, start, this.attributes.previous.array, start, diff )
		
		this.memcpy( this.attributes.position.array, start, this.attributes.next.array, start, diff )
	}

	updatePosAtIndex( index, pos  ){

		let start  	= this.linesMap[ index ].start * 6
		let end  	= (this.linesMap[ index ].end + 1 ) * 6
		let res 	= this.config.res[index]
		let diff 	= end - start

		
		this.memcpy( this.attributes.position.array, start, this.attributes.previous.array, start, diff )


		this.memcpy( this.attributes.position.array, start, this.attributes.position.array, start + 6, diff - 6)

		this.attributes.position.array[ start  	   ] = pos.x
		this.attributes.position.array[ start  + 1 ] = pos.y
		this.attributes.position.array[ start  + 2 ] = pos.z

		this.attributes.position.array[ start  + 3 ] = pos.x
		this.attributes.position.array[ start  + 4 ] = pos.y
		this.attributes.position.array[ start  + 5 ] = pos.z

		this.memcpy( this.attributes.position.array, start, this.attributes.next.array, start + 6, diff - 6)

		this.attributes.next.array[ start 	 ] = pos.x
		this.attributes.next.array[ start + 1 ] = pos.y
		this.attributes.next.array[ start + 2 ] = pos.z

		this.attributes.next.array[ start + 3 ] = pos.x
		this.attributes.next.array[ start + 4 ] = pos.y
		this.attributes.next.array[ start + 5 ] = pos.z
	}

	memcpy (src, srcOffset, dst, dstOffset, length) {
		
	    src = src.subarray || src.slice ? src : src.buffer
	    dst = dst.subarray || dst.slice ? dst : dst.buffer

	    src = srcOffset != null ? src.subarray ?
	        src.subarray(srcOffset, srcOffset + length) :
	        src.slice(srcOffset, srcOffset + length) : src

	    if (dst.set) {
	        dst.set(src, dstOffset)
	    } else {
	        for (var i=0; i<src.length; i++) {
	            dst[i + dstOffset] = src[i]
	        }
	    }


	    return dst
	}
} 