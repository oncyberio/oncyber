import {

	MeshBasicNodeMaterial,

	Vector2,

	BackSide

} from 'three/webgpu'

import {

	Fn,

	If,

	Discard,

	float as tslFloat,

	vec2,

	vec3,

	vec4,

	uv,

	texture,

	uniform,

	clamp,

	saturate,

	abs,

	cos,

	sin,

	dot,

	cross,

	distance,

	length,

	normalize,

	fract,

	fwidth,

	mod,

	min,

	max,

	pow,

	mat3,

	positionView,

	cameraPosition,

	cameraViewMatrix,

	PI

} from 'three/tsl'

import Shared from '@3shared'

// The loading tunnel: a plane wrapped into a tube in the vertex stage, lit by
// the tunnel's two point lights through a hand-made Lambert (light positions
// warped by the mouse like the geometry), normal-mapped with a tangent frame
// built from a finite-difference normal, then mixed with a scrolling grid and
// a fresnel fade. Port of the WebGL `lights: true` ShaderMaterial; the light
// loop is written out because the shader moved the lights itself.

const E = 0.001

const LUMINANCE = vec3( 0.2125, 0.7154, 0.0721 )

// GLSL smoothstep, valid with edge0 > edge1 too.
const smoothstep = ( edge0, edge1, x ) => {

	const t = clamp( tslFloat( x ).sub( edge0 ).div( tslFloat( edge1 ).sub( edge0 ) ), 0.0, 1.0 )

	return t.mul( t ).mul( tslFloat( 3.0 ).sub( t.mul( 2.0 ) ) )
}

export default class Material extends MeshBasicNodeMaterial {

	constructor( options ){

		super()

		const LENGTH = tslFloat( options.length )

		const RADIUS = tslFloat( options.radius )

		const SPEED = tslFloat( options.speed )

		this.uniforms = {

			timer: uniform( 0 ).onRenderUpdate( () => Shared.timer.value ),

			desactivated: uniform( 1 ),

			mouse : uniform( new Vector2() )
		}

		const { timer, desactivated, mouse } = this.uniforms

		const normalMap = texture( options.normalMap )

		// The WebGL engine lit with legacy lights: colour * intensity * PI in,
		// Lambert BRDF / PI out, cutoff falloff `pow( saturate( 1 - d / distance ), decay )`.
		const lights = ( options.lights || [] ).map( ( light ) => ( {

			position: uniform( light.position ),

			color: uniform( light.color ),

			intensity: uniform( 0 ).onRenderUpdate( () => light.intensity ),

			distance: uniform( 0 ).onRenderUpdate( () => light.distance ),

			decay: uniform( 0 ).onRenderUpdate( () => light.decay )
		} ) )

		// vertex: plane -> tube, bulged towards the mouse in its middle

		this.positionNode = Fn( () => {

			const vUv = uv()

			const angle = PI.mul( 2.0 ).mul( vUv.x )

			const pos = vec3( RADIUS.mul( cos( angle ) ), RADIUS.mul( sin( angle ) ), vUv.y.mul( LENGTH ) )

			const weight = smoothstep( LENGTH.mul( 0.5 ), 0.0, distance( LENGTH.mul( 0.5 ), pos.z ) )

			return pos.add( vec3( mouse.mul( 30.0 ), 0.0 ).mul( weight ) )

		} )()

		// fragment helpers

		const getPosition = ( pos ) => {

			const weight = smoothstep( LENGTH.mul( 0.3 ), 0.0, distance( LENGTH.mul( 0.3 ), pos.z ) )

			return pos.add( vec3( mouse.mul( 12.0 ), 0.0 ).mul( weight ) )
		}

		const getPositionFromUv = ( datUv ) => {

			const angle = PI.mul( 2.0 ).mul( datUv.x )

			return getPosition( vec3( RADIUS.mul( cos( angle ) ), RADIUS.mul( sin( angle ) ), datUv.y ) )
		}

		const getAverageNormal = ( _uv ) => {

			const dx = getPositionFromUv( _uv.add( vec2( E, 0.0 ) ) ).sub( getPositionFromUv( _uv.add( vec2( -E, 0.0 ) ) ) )

			const dy = getPositionFromUv( _uv.add( vec2( 0.0, E ) ) ).sub( getPositionFromUv( _uv.add( vec2( 0.0, -E ) ) ) )

			return cross( normalize( dx ), normalize( dy ) )
		}

		// three's getTangentFrame( eye_pos, surf_norm, uv )
		const getTangentFrame = ( eyePos, N, mapUv ) => {

			const q0 = eyePos.dFdx()
			const q1 = eyePos.dFdy()
			const st0 = mapUv.dFdx()
			const st1 = mapUv.dFdy()

			const q1perp = cross( q1, N )
			const q0perp = cross( N, q0 )

			const T = q1perp.mul( st0.x ).add( q0perp.mul( st1.x ) )
			const B = q1perp.mul( st0.y ).add( q0perp.mul( st1.y ) )

			const det = max( dot( T, T ), dot( B, B ) )
			const scale = det.equal( 0.0 ).select( 0.0, det.inverseSqrt() )

			return mat3( T.mul( scale ), B.mul( scale ), N )
		}

		this.colorNode = Fn( () => {

			const initialUV = uv()

			// normal map uv: `repeat( 4, 4 )`
			const vNormalMapUv = uv().mul( options.normalMap.repeat )

			const vViewPosition = positionView.negate()

			// dissolve in / out along the tube

			const mapN2 = normalMap.sample( vNormalMapUv ).xyz.mul( 2.0 ).sub( 1.0 )

			const whenGt = max( desactivated.sub( initialUV.y ).sign(), 0.0 )

			const diff = smoothstep( 0.0, 0.3, distance( initialUV.y, desactivated ) ).sub( 0.15 ).add( abs( mapN2.r ).mul( 0.3 ) ).mul( whenGt )

			// scrolling normal map + tangent frame on the analytic normal

			const normalUv = vec2( vNormalMapUv.x.mul( 4.0 ), mod( vNormalMapUv.y.add( timer.mul( SPEED ).mul( 1.25 ) ), 1.0 ) )

			const mapN = normalMap.sample( normalUv ).xyz.mul( 2.0 ).sub( 1.0 )

			const vNormal = normalize( getAverageNormal( initialUV ) )

			const tbn = getTangentFrame( vViewPosition.negate(), vNormal, vNormalMapUv )

			const normal = normalize( tbn.mul( mapN ) ).negate().toVar()

			// grid (derivatives stay in uniform control flow, before the discard)

			const coord = vec2( mod( vNormalMapUv.y.add( timer.mul( SPEED ) ), 1.0 ), vNormalMapUv.x ).mul( vec2( LENGTH.mul( 0.1 ), 4.0 ) ).mul( 0.5 )

			const grid = abs( fract( coord.sub( 0.5 ) ).sub( 0.5 ) ).div( fwidth( coord ) ).mul( 0.8 )

			If( initialUV.y.greaterThan( diff ), () => {

				Discard()

			} )

			// lambert, diffuse = white

			const directDiffuse = vec3( 0.0 ).toVar()

			for ( const light of lights ) {

				const lightPosition = cameraViewMatrix.mul( vec4( light.position, 1.0 ) ).xyz

				const lVector = getPosition( lightPosition ).sub( positionView )

				const lightDistance = length( lVector )

				const attenuation = light.distance.greaterThan( 0.0 ).and( light.decay.greaterThan( 0.0 ) ).select(

					pow( saturate( lightDistance.div( light.distance ).negate().add( 1.0 ) ), light.decay ),

					1.0
				)

				const dotNL = saturate( dot( normal, normalize( lVector ) ) )

				directDiffuse.addAssign( light.color.mul( light.intensity ).mul( attenuation ).mul( dotNL ) )
			}

			const color = directDiffuse.toVar()

			const gridForce = smoothstep( 0.0, 0.9, dot( color, LUMINANCE ) )

			const line = min( grid.x, grid.y )

			const depthFade = smoothstep( 0.0, 50.0, vViewPosition.z )

			const gColor = min( line, 1.0 ).oneMinus().mul( depthFade.oneMinus() )

			// sic: view-space position against the world-space camera, as in WebGL
			const viewWorldDir = normalize( positionView.sub( cameraPosition ) )

			const NdotV = max( dot( viewWorldDir, normal ), 0.0 )

			const fresnelFactor = pow( NdotV.oneMinus(), 4.0 ).oneMinus()

			const v2mix = min( fresnelFactor, depthFade )

			const pulse = smoothstep( 0.5, 1.0, sin( mod( timer.mul( 0.05 ).add( 1.2 ), 1.0 ).mul( 3.1416 ) ) )

			return color.mul( v2mix.oneMinus() ).add( vec3( gColor.mul( gridForce.oneMinus() ).mul( viewWorldDir.r ).mul( viewWorldDir.r ) ).mul( pulse ) )

		} )()

		this.fog = false

		this.transparent = true

		this.side = BackSide

		this.name = 'TunnelMaterial'
	}

	update( m ){

		this.uniforms.mouse.value.copy( m )
	}
}
