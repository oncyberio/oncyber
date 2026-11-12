import {

	MeshBasicNodeMaterial,

	Color,

	DoubleSide,

	AdditiveBlending

} from 'three/webgpu'

import {

	Fn,

	vec2,

	vec4,

	attribute,

	uniform,

	select,

	all,

	normalize,

	sin,

	transpose,

	positionGeometry,

	modelViewMatrix,

	cameraProjectionMatrix,

	sRGBTransferEOTF

} from 'three/tsl'

import {

	REAL_DPI

} from '@3constants'

import Shared from '@3shared'

// Screen-space ribbons for the highlight particles: each vertex is pushed
// sideways in clip space along the screen direction of its trail, scaled by
// width, life and a sine along the trail.

const fix = ( i, aspect ) => {

	const res = i.xy.div( i.w )

	return vec2( res.x.mul( aspect ), res.y )
}

export default class InstanceMeshLineMaterial extends MeshBasicNodeMaterial {

	constructor(opts) {

		super()

		this.uniforms =
		{

			time: uniform( 0 ).onRenderUpdate( () => Shared.timer.value ),

			lineWidth: uniform( 0.006 * REAL_DPI ),

			uColor: uniform( new Color() ),

			aspect: uniform( 0 ).onRenderUpdate( () => Shared.aspect.value ),

			resolution: uniform( Shared.resolution.value ),

		}

		this.depthTest = false

		this.depthWrite = false

		this.blending = AdditiveBlending

		this.side = DoubleSide

		this.transparent = true

		this.fog = false

		const { aspect, lineWidth } = this.uniforms

		this.vertexNode = Fn( () => {

			const m = cameraProjectionMatrix.mul( modelViewMatrix )

			const side = attribute( 'side', 'float' )

			const finalPosition = m.mul( vec4( positionGeometry, 1.0 ) ).toVar()
			const prevPos = m.mul( vec4( attribute( 'previous', 'vec3' ), 1.0 ) )
			const nextPos = m.mul( vec4( attribute( 'next', 'vec3' ), 1.0 ) )

			const currentP = fix( finalPosition, aspect ).toVar()
			const prevP = fix( prevPos, aspect ).toVar()
			const nextP = fix( nextPos, aspect ).toVar()

			const dir = select(

				all( nextP.equal( currentP ) ),

				normalize( currentP.sub( prevP ) ),

				select(

					all( prevP.equal( currentP ) ),

					normalize( nextP.sub( currentP ) ),

					normalize( normalize( currentP.sub( prevP ) ).add( normalize( nextP.sub( currentP ) ) ) )
				)
			).toVar()

			const uvx = attribute( 'uvs', 'float' )

			const scale = lineWidth.mul( 0.5 ).mul( attribute( 'width', 'float' ) ).mul( sin( uvx.mul( 3.1416 ) ) ).mul( attribute( 'life', 'float' ) )

			// GLSL `normal *= projectionMatrix` (row vector).
			const normal = transpose( cameraProjectionMatrix ).mul( vec4( dir.y.negate().mul( scale ), dir.x.mul( scale ), 0.0, 1.0 ) )

			finalPosition.xy.addAssign( normal.xy.mul( side ) )

			return finalPosition

		} )()

		// The WebGL shader wrote the vertex colour straight to the screen.
		this.colorNode = sRGBTransferEOTF( attribute( 'color', 'vec3' ) )

		this.opacityNode = 0.5

	}

	show(){

	}

	resize(w,h){

		this.uniforms.lineWidth.value = 0.005 * REAL_DPI

		this.uniforms.resolution.value.set(w,h)
	}

	setColor( color ) {

		if ( this.uniforms.uColor.value.getHex() != color ){

			this.uniforms.uColor.value.setHex( color )
		}
	}
}
