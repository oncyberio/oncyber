import {

	MeshBasicNodeMaterial,

	AdditiveBlending,

	FrontSide

} from 'three/webgpu'

import {

	Fn,

	vec2,

	vec3,

	vec4,

	attribute,

	uniform,

	mod,

	floor,

	max,

	sign,

	normalize,

	uv,

	positionGeometry,

	cameraPosition,

	modelViewMatrix,

	cameraProjectionMatrix

} from 'three/tsl'

import Shared from '@3shared'

const LOOP_RANGE_Y = 50.0

const LOOP_RANGE_XZ = 50.0

const LINE_WIDTH = 1.0

// Instanced rain streaks: every instance loops vertically with time and wraps
// on a 50m grid around the camera, drawn as a constant pixel-width line.
// The WebGL material had `fog: false`, so `fogg` was always 1.

export default class RainMaterial extends MeshBasicNodeMaterial {

	constructor( opt ){

		super()

		this.uniforms = {

			timer: uniform( 0 ).onRenderUpdate( () => Shared.timer.value ),

			invaspect: uniform( 0 ).onRenderUpdate( () => Shared.invaspect.value ),

			invresolution: uniform( Shared.invresolution.value ),

			intensity : uniform( opt.intensity )
		}

		this.blending = AdditiveBlending

		this.depthWrite = false

		this.fog = false

		this.transparent = true

		this.side = FrontSide

		const { timer, invaspect, invresolution, intensity } = this.uniforms

		this.vertexNode = Fn( () => {

			const offset = attribute( 'offset', 'vec3' )

			const y = mod( offset.y.sub( timer.mul( 20.0 ) ), LOOP_RANGE_Y ).sub( 2.5 ).add( cameraPosition.y )

			const res = offset.xz.mul( LOOP_RANGE_XZ )

			const currentZ = cameraPosition.xz.sub( res )

			const xz = res.add( floor( currentZ.div( LOOP_RANGE_XZ ) ).mul( LOOP_RANGE_XZ ) ).add( LOOP_RANGE_XZ * 0.5 )

			const instanceStart = vec3( xz.x, y.add( positionGeometry.y ), xz.y )

			const instanceEnd = instanceStart.add( vec3( 0.0, 1.0, 0.0 ) )

			const clipStart = cameraProjectionMatrix.mul( modelViewMatrix.mul( vec4( instanceStart, 1.0 ) ) ).toVar()

			const clipEnd = cameraProjectionMatrix.mul( modelViewMatrix.mul( vec4( instanceEnd, 1.0 ) ) )

			const ndcStart = clipStart.xy.div( clipStart.w )

			const ndcEnd = clipEnd.xy.div( clipEnd.w )

			// account for clip-space aspect ratio
			const dir = normalize( vec2( ndcEnd.x.sub( ndcStart.x ).div( invaspect ), ndcEnd.y.sub( ndcStart.y ) ) )

			// perpendicular, with the aspect adjustment undone
			const side = vec2( dir.y.mul( invaspect ), dir.x ).mul( sign( positionGeometry.x ) )

			const lineOffset = side.mul( max( 0.25, LINE_WIDTH ) ).mul( invresolution.y ).mul( clipStart.w )

			return vec4( clipStart.xy.add( lineOffset ), clipStart.zw )

		} )()

		const vUv = uv().oneMinus()

		this.colorNode = vec3( 1.0 )

		this.opacityNode = vUv.y.mul( 0.2 ).mul( intensity )

	}
}
