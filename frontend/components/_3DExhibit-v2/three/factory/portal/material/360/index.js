import {

	MeshBasicNodeMaterial

} from 'three/webgpu'

import {

	Fn,

	float as tslFloat,

	vec2,

	vec3,

	vec4,

	mix,

	smoothstep,

	select,

	uniform,

	reference,

	texture,

	uv,

	output,

	positionGeometry,

	normalGeometry,

	modelWorldMatrix,

	cameraPosition,

	screenCoordinate,

	sRGBTransferEOTF,

	sRGBTransferOETF,

} from 'three/tsl'

import { Texture } from 'three'

import Shared from '@3shared'



const emptyTexture = /*@__PURE__*/ new Texture()

// Shared's plain `{ value }` objects, read every frame.
const sharedFloat = ( obj ) => reference( 'value', 'float', obj )


const frand = /*@__PURE__*/ Fn( ( [ o ] ) => {

	const p = o.mul( 256.0 )

	const p3 = vec3( p.x, p.y, p.x ).mul( 0.1031 ).fract().toVar()

	p3.addAssign( p3.dot( p3.yzx.add( 33.33 ) ) )

	return p3.x.add( p3.y ).mul( p3.z ).fract()
} )

const hash = /*@__PURE__*/ Fn( ( [ p ] ) => {

	const p3 = vec3( p.x, p.y, p.x ).mul( 0.13 ).fract().toVar()

	p3.addAssign( p3.dot( p3.yzx.add( 3.333 ) ) )

	return p3.x.add( p3.y ).mul( p3.z ).fract()
} )

const newnoise = /*@__PURE__*/ Fn( ( [ x ] ) => {

	const i = x.floor()

	const f = x.fract()

	const a = hash( i )

	const b = hash( i.add( vec2( 1.0, 0.0 ) ) )

	const c = hash( i.add( vec2( 0.0, 1.0 ) ) )

	const d = hash( i.add( vec2( 1.0, 1.0 ) ) )

	const u = f.mul( f ).mul( f.mul( 2.0 ).oneMinus().add( 2.0 ) )

	return mix( a, b, u.x ).add( c.sub( a ).mul( u.y ).mul( u.x.oneMinus() ) ).add( d.sub( b ).mul( u.x ).mul( u.y ) )
} )


/**
 * 360 portal preview: a wobbly mirror-ball reflection of the destination's
 * equirectangular hero image, with the info card on top and a loading sweep.
 *
 * Port of the GLSL ShaderMaterial. Notes on parity:
 * - The GLSL fragment declared `depthFade` / `inverseDepth` as (never set)
 *   uniforms instead of varyings, so both were always 0; that is kept.
 * - The GLSL wrote gl_FragColor without colour conversion, so the colour is
 *   decoded here (sRGBTransferEOTF) and the output conversion gives back the
 *   same pixels. Fog is the engine's (sRGB-space) node fog, like <fog_fragment>.
 * - Inside a portal render (`Shared.isDynamicRendering`), the GLSL linearised
 *   with pow( c, 2.2 ) before writing into the linear portal target; the same
 *   value is written here.
 */
export default class Three60Material extends MeshBasicNodeMaterial {

	constructor( opts ){

		super()

		this.fog = true

		const timer = sharedFloat( Shared.timer )

		const dpi = sharedFloat( Shared.dpi )

		const isDynamicRendering = sharedFloat( Shared.isDynamicRendering )

		const loading = uniform( 0 )

		const scaleFactor = uniform( 1 )

		const rotation = uniform( 0 )

		// < VERTEX >

		const modelPosition = modelWorldMatrix[ 3 ].xyz

		const depth = smoothstep( scaleFactor.mul( 3.0 ), scaleFactor.mul( 10.0 ), cameraPosition.distance( modelPosition ) )

		const scaleVal = mix( 1.0, 5.0, depth )

		const worldPosition = modelWorldMatrix.mul( vec4( positionGeometry.mul( scaleVal ), 1.0 ) ).xyz

		// portal normal in world space ( mat3( modelMatrix ) * vec3( 0, 0, 1 ) )
		const n = modelWorldMatrix.mul( vec4( 0.0, 0.0, 1.0, 0.0 ) ).xyz

		const vAngle = n.cross( vec3( 0.0, 1.0, 0.0 ) ).dot( worldPosition.sub( cameraPosition ).negate().normalize() ).toVarying( 'vAngle' )

		const vWorldPosition = worldPosition.toVarying( 'vWorldPositionScaled' )

		const vNormal = normalGeometry.toVarying( 'vPortalNormal' )

		const vUv = uv()

		const loaderTimer = timer.mul( 6.0 ).mod( 5.0 ).sub( 2.5 )

		// < FRAGMENT >

		const fragCoord = screenCoordinate.xy

		const ditherFloat = ( color ) => {

			const gridPosition = frand( fragCoord.add( timer ) )

			const shift = mix( 2.0 * 0.25 / 255.0, - 2.0 * 0.25 / 255.0, gridPosition )

			return color.add( shift.mul( 75.0 ) )
		}

		const ditherVec3 = ( color ) => {

			const gridPosition = frand( fragCoord )

			const shift = vec3( 0.25 / 255.0, - 0.25 / 255.0, 0.25 / 255.0 )

			return color.add( mix( shift.mul( 2.0 ), shift.mul( - 2.0 ), gridPosition ).mul( 75.0 ).mul( dpi ) )
		}

		const map = texture( opts.map ?? emptyTexture )

		const tinfo = texture( opts.tinfo ?? emptyTexture )

		const colorNode = Fn( () => {

			const cameraToVertex = vWorldPosition.sub( cameraPosition ).normalize()

			const centered = vUv.sub( 0.5 ).mul( 2.0 )

			const aa = smoothstep( 0.8, 1.4, centered.length() )

			// uvDomain = mix( vUv, vUv * 0.5, depthFade ), depthFade == 0
			const uvDomain = vUv

			const datnoise = ditherFloat( newnoise( vUv.mul( 5.0 ).sub( vec2( timer, vUv.y.add( timer.mul( 0.2 ) ) ) ) ).sub( 0.5 ) ).mul( 2.0 * 0.4 )

			const perturbRatio = tslFloat( 0.02 * 0.25 ).add( loading.mul( 0.025 ) )

			const perturbNormal = ditherVec3( vec3(

				newnoise( uvDomain.mul( 80.0 ).sub( timer ) ).sub( 0.5 ),

				newnoise( uvDomain.mul( 40.0 ).add( 50.0 ) ).sub( 0.5 ),

				newnoise( uvDomain.mul( 20.0 ).sub( 100.0 ) ).sub( 0.5 )

			) ).mul( perturbRatio ).toVar()

			// the sXsY term is mix( 0, .., inverseDepth ) with inverseDepth == 0
			const worldNormal = vNormal.add( perturbNormal ).toVar()

			const reflected = cameraToVertex.reflect( worldNormal ).toVar()

			reflected.x.mulAssign( - 1.0 )

			// rotation around +Y by ( vAngle + rotation ), as the GLSL getRotationMatrix
			const angle = vAngle.add( rotation )

			const s = angle.sin()

			const c = angle.cos()

			const dir = reflected.normalize()

			const direction = vec3(

				c.mul( dir.x ).sub( s.mul( dir.z ) ),

				dir.y,

				s.mul( dir.x ).add( c.mul( dir.z ) )
			)

			// equirectUv
			const equirect = vec2(

				direction.z.atan( direction.x ).mul( 1.0 / ( Math.PI * 2.0 ) ).add( 0.5 ),

				direction.y.clamp( - 1.0, 1.0 ).asin().mul( 1.0 / Math.PI ).add( 0.5 )
			)

			const infoSample = tinfo.sample( vUv.add( perturbNormal.xy.mul( smoothstep( 0.3, 1.0, loading ) ) ) )

			const infoColor = vec4( sRGBTransferOETF( infoSample.rgb ), infoSample.a )

			const finalColor = map.sample( equirect ).toVar()

			if( opts.halo === 'color' ) {

				finalColor.rgb.assign( mix(

					finalColor.rgb,

					finalColor.rgb.mul( 0.25 ),

					vUv.y.oneMinus().mul( aa.add( datnoise.mul( aa ) ) ).mul( 0.8 ).max( 0.0 ).min( 1.0 )
				) )
			}

			finalColor.rgb.mulAssign( mix( 0.75, 1.0, vUv.y ) )

			const inUv = smoothstep( 0.4, 1.0, loaderTimer.distance( vUv.x.add( vUv.y ).add( worldNormal.x ).add( worldNormal.y ) ) ).oneMinus()

			finalColor.rgb.assign( mix( finalColor.rgb, finalColor.rgb.mul( 1.8 ).add( 0.4 ), loading.mul( 0.3 ).mul( inUv ) ) )

			finalColor.assign( mix( finalColor, infoColor, infoColor.a.mul( loading.oneMinus() ) ) )

			return vec4( sRGBTransferEOTF( finalColor.rgb ), finalColor.a )
		} )()

		this.colorNode = colorNode

		// After fog: inside a portal render the GLSL wrote pow( color, 2.2 ) to
		// the linear portal target; elsewhere the colour goes out unconverted.
		this.outputNode = select(

			isDynamicRendering.equal( 1.0 ),

			vec4( sRGBTransferOETF( output.rgb ).pow( 2.2 ), output.a ),

			output
		)

		this.uniforms = {

			loading,

			scaleFactor,

			isDynamicRendering: Shared.isDynamicRendering,

			map,

			tinfo,

			resolution: Shared.resolution,

			dpi : Shared.dpi,

			rotation,

			timer : Shared.timer,
		}
	}
}
