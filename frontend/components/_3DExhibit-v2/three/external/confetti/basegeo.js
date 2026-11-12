import { 
	InstancedBufferGeometry,
	PlaneGeometry,
	BufferAttribute,
	InstancedBufferAttribute,
	CircleGeometry
} from 'three'

// const colors = [
	
// 	[0.5, 0.2, 1.0],
// 	[0.2, 0.8, 0.2],
// 	[1.0, 0.8, 0.2],
// 	[1.0, 0.0, 0.0]
// ]

export default class BaseGeo extends InstancedBufferGeometry {
			
    constructor(nb = 10, colors, type = 'square') {

    	// console.log(colors)

    	super()

    	var plane;

    	if(type == 'square'){

    		plane = new PlaneGeometry(1,1)
    	}

    	else {

    		plane = new CircleGeometry( 1, 32 );
    	}

		plane.rotateX(Math.PI)

		this.setAttribute( 'position', plane.attributes.position );
		this.setAttribute( 'normal', plane.attributes.normal );

		this.attributes.position.needsUpdate = true
		this.attributes.normal.needsUpdate = true

		this.setIndex( plane.index );

		this.index.needsUpdate = true

		var dd = []

		for ( var i = 0, ul = nb; i < ul; i++ ) {

			dd[i] = i
		}

		var countID = new InstancedBufferAttribute( new Float32Array( dd ), 1, false, 1 );

		this.setAttribute( 'countID', countID );

		this.instanceCount = nb


		var cc = []

		var count = 0

		for ( var i = 0, ul = nb * 3; i < ul; i+=3 ) {

			var current = colors[ count % colors.length ]

			cc.push(current[0], current[1], current[2]);

			count++
		}

		var color = new InstancedBufferAttribute( new Float32Array( cc ), 3, false, 1 );

		this.setAttribute( 'color', color );

    } 

}
