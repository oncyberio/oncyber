import {

	Vector2

} from 'three'

import {

	Fn,
	If,
	Discard,
	vec3,
	vec4,
	float as tslFloat,
	max,
	min,
	dot,
	clamp,
	fwidth,
	uv,
	attribute,

} from 'three/tsl'

import {

	DPI,

	FONT_DISTANCE_RANGE_FIELD,

} from '@3constants'

import {

	ArtworkNodeMaterial,
	KEEP_ALL_FRAGMENTS,
	materialUniform,
	materialTexture,

} from '@3factory/artwork/nodematerial'


let defaultOptions = {

	// light 		: false,

	alphaTest 	: 0.0001,

	alpha 		: 1
}

const ALPHA_TEST = 0.001

const median = ( r, g, b ) => max( min( r, g ), min( max( r, g ), b ) )

const vUv = uv()

const vColor = attribute( 'color', 'vec3' )

/** MSDF coverage, already multiplied by the material alpha */
const msdfAlpha = Fn( () => {

	const map = materialTexture( 'map', vUv ).rgb

	const sigDist = median( map.r, map.g, map.b ).sub( 0.5 ).mul(

		dot( materialUniform( 'msdfUnit', 'vec2' ), tslFloat( 0.5 ).div( fwidth( vUv ) ) )
	)

	const fAlpha = clamp( sigDist.add( 0.5 ), 0.0, 1.0 ).toVar()

	If( fAlpha.lessThan( ALPHA_TEST ), () => {

		Discard()
	} )

	return fAlpha.mul( materialUniform( 'alpha', 'float' ) )
} )()

// The WebGL shader converted its output (colorspace_fragment): use the colour as-is.
const colorNode = vec4( vColor, msdfAlpha )

const occlusionColorNode = vec4( vec3( 0.0 ), msdfAlpha )


export default class MSDFMaterial extends ArtworkNodeMaterial {

	static get type() {

		return 'MSDFMaterial'
	}

	/**
	 * @param { object } options
	 * @param { object } [sharedUniforms] the uniforms of the material this one is a variant of
	 */
	constructor(options = {}, sharedUniforms = null) {

		let nOptions 	= Object.assign( {}, defaultOptions)

			nOptions 	= Object.assign( nOptions, options)

		super()

		this.options = nOptions

		this.uniforms = sharedUniforms || {

			alpha		: { value: nOptions.alpha 		},

			map			: {	value: nOptions.map 		},

			msdfUnit	: {

				value: new Vector2(

					(DPI * FONT_DISTANCE_RANGE_FIELD) / nOptions.map.image.width,

					(DPI * FONT_DISTANCE_RANGE_FIELD) / nOptions.map.image.height
				)
			}
		}

		this.colorNode = colorNode

		this.alphaTestNode = KEEP_ALL_FRAGMENTS

		this.side = 2

		this.transparent = true

		this.fog = true

		if( sharedUniforms == null ) {

			this.occlusionMaterial = new MSDFMaterial( nOptions, this.uniforms )
		}
	}

	setupVariant( variant ) {

		if( variant == 'OCCLUSION' ) {

			return { colorNode: occlusionColorNode, fog: false }
		}

		return null
	}

	/**
	 * Same font, same uniforms (alpha included), its own render state, e.g.
	 * an overlay copy with `depthTest = false`.
	 */
	cloneShared() {

		const material = new MSDFMaterial( this.options, this.uniforms )

		material.occlusionMaterial = this.occlusionMaterial

		return material
	}

	set alpha(val){

		this.uniforms.alpha.value = val

	}

	get alpha() {

		return this.uniforms.alpha.value
	}

}
