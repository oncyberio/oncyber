import {

  PlaneGeometry

} from 'three'

import SimplexNoise from 'simplex-noise'

import Smoothstep from '@3utils/math/smoothstep'

const eps = 0.000001

function distance(x1, y1,x2,y2 ) {

  var a = x1 - x2;
  var b = y1 - y2;

  return  Math.sqrt( a*a + b*b );
}

function diagonalOfSquare(sideLength) {
  const diagonal = sideLength * Math.sqrt(2);
  return diagonal;
}

self.addEventListener(

  "message",

  async function(e) {

    console.log( e.data  )

    const data = e.data 

    const geometry = new PlaneGeometry( 1, 1, data.definition, data.definition )

    geometry.rotateX(-Math.PI * 0.5 )

    var simplex = new SimplexNoise(data.seed)

    let pos = geometry.attributes.position.array

    let i = 0

    // smoothCenter

    const maxSmooth = diagonalOfSquare(1) * 0.5

    while( i < pos.length / 3 ) {

      const originalX =  pos[i * 3]
      const originalZ =  pos[i * 3 + 2 ]

      const dist = distance(originalX, originalZ, 0, 0)

      // if( dist < 0.2 ) {

      //   console.log( dist )

      // }

      const smoothForce = Smoothstep( data.smoothCenter * maxSmooth - 0.1, maxSmooth + 0.1, dist )

      const x = originalX * data.noiseDomain 
      const z = originalZ * data.noiseDomain

      if(  data.scale.x <  data.scale.z ) {

        const ratio = data.scale.x / data.scale.z

        pos[i * 3 + 1 ] = simplex.noise3D(x  * ratio , 0, z); 

      }

      else {

        const ratio = data.scale.z / data.scale.x

        pos[i * 3 + 1 ] = ( simplex.noise3D(x , 0, z * ratio) + 1 ) ; 

      }


      pos[i * 3 + 0 ] *=  data.scale.x
      pos[i * 3 + 1 ] *=  smoothForce * data.scale.y
      pos[i * 3 + 2 ] *=  data.scale.z

      i++

    }

    geometry.computeVertexNormals()

    self.postMessage( {

      position : geometry.attributes.position.array,
      normal : geometry.attributes.normal.array,
      uv : geometry.attributes.uv.array,
      index: geometry.index.array
      // position: 
    }, [
      geometry.attributes.position.array.buffer,
      geometry.attributes.normal.array.buffer,
      geometry.attributes.uv.array.buffer,
      geometry.index.array.buffer
    ] )
  }

);
