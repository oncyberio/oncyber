import {

	NodeMaterial,

	QuadMesh,

	RenderTarget,

	HalfFloatType,

	LinearFilter,

	NoBlending,

	Texture,

	Vector2

} from 'three/webgpu'

import {

	Fn,

	vec2,

	vec4,

	float as tslFloat,

	uv,

	texture,

	uniform,

	luminance,

	smoothstep,

	select,

	saturate,

	mix

} from 'three/tsl'

// TSL port of the pmndrs `postprocessing` (6.30) BloomEffect pieces the
// engine used: LuminancePass (colorOutput + threshold/smoothing) followed by
// MipmapBlurPass (13-tap downsampling chain + 9-tap tent upsampling mixed
// with the matching downsampled level by `radius`). Same levels, same sizes,
// same kernels, so the bloom texture matches the WebGL one.
//
// The WebGL engine fed this from an 8-bit target, so every input sample was
// clamped to [0, 1]; our targets are half-float, so the first stages clamp.

const LEVELS = 8

const WEIGHT_INNER = 0.125

const WEIGHT_OUTER = 0.0555555

const quad = new QuadMesh()

function createTarget() {

	return new RenderTarget( 1, 1, {

		depthBuffer: false,

		stencilBuffer: false,

		generateMipmaps: false,

		minFilter: LinearFilter,

		magFilter: LinearFilter,

		type: HalfFloatType

	} )
}

function createMaterial( name, node ) {

	const material = new NodeMaterial()

	material.name = name

	material.fragmentNode = node

	material.blending = NoBlending

	material.depthTest = false

	material.depthWrite = false

	return material
}

const clampToBorder = ( coord ) => {

	return tslFloat( coord.x.greaterThanEqual( 0.0 ).and( coord.x.lessThanEqual( 1.0 ) ).and( coord.y.greaterThanEqual( 0.0 ) ).and( coord.y.lessThanEqual( 1.0 ) ) )
}

export default class MipmapBlur {

	constructor() {

		this.resolution = new Vector2()

		this.luminanceTarget = createTarget()

		this.downsamplingMipmaps = []

		this.upsamplingMipmaps = []

		for ( let i = 0; i < LEVELS; i++ ) {

			this.downsamplingMipmaps.push( createTarget() )
		}

		for ( let i = 0; i < LEVELS - 1; i++ ) {

			this.upsamplingMipmaps.push( createTarget() )
		}

		this.luminanceEnabled = true

		this.uniforms = {

			threshold: uniform( 0 ),

			smoothing: uniform( 1 ),

			useThreshold: uniform( 1 ),

			radius: uniform( 0.85 ),

			downTexelSize: uniform( new Vector2() ),

			upTexelSize: uniform( new Vector2() )
		}

		const placeholder = new Texture()

		this.luminanceInput = texture( placeholder )

		this.downInput = texture( placeholder )

		this.upInput = texture( placeholder )

		this.upSupport = texture( placeholder )

		this.luminanceMaterial = createMaterial( 'Bloom_luminance', this.createLuminanceNode() )

		this.downsamplingMaterial = createMaterial( 'Bloom_downsampling', this.createDownsamplingNode() )

		this.upsamplingMaterial = createMaterial( 'Bloom_upsampling', this.createUpsamplingNode() )
	}

	createLuminanceNode() {

		const { threshold, smoothing, useThreshold } = this.uniforms

		return Fn( () => {

			const texel = saturate( this.luminanceInput.sample( uv() ) )

			const l = luminance( texel.rgb ).toVar()

			l.assign( select( useThreshold.greaterThan( 0.5 ), smoothstep( threshold, threshold.add( smoothing ), l ), l ) )

			return vec4( texel.rgb.mul( l ), l )

		} )()
	}

	createDownsamplingNode() {

		const texelSize = this.uniforms.downTexelSize

		const input = this.downInput

		return Fn( () => {

			const vUv = uv()

			const sample = ( offset, weight ) => {

				const coord = vUv.add( texelSize.mul( vec2( offset[ 0 ], offset[ 1 ] ) ) )

				return saturate( input.sample( coord ) ).mul( clampToBorder( coord ).mul( weight ) )
			}

			const c = vec4( 0.0 ).toVar()

			const inner = [ [ -1, 1 ], [ 1, 1 ], [ -1, -1 ], [ 1, -1 ] ]

			const outer = [ [ -2, 2 ], [ 0, 2 ], [ 2, 2 ], [ -2, 0 ], [ 2, 0 ], [ -2, -2 ], [ 0, -2 ], [ 2, -2 ] ]

			inner.forEach( ( offset ) => c.addAssign( sample( offset, WEIGHT_INNER ) ) )

			outer.forEach( ( offset ) => c.addAssign( sample( offset, WEIGHT_OUTER ) ) )

			c.addAssign( saturate( input.sample( vUv ) ).mul( WEIGHT_OUTER ) )

			return c

		} )()
	}

	createUpsamplingNode() {

		const texelSize = this.uniforms.upTexelSize

		const input = this.upInput

		return Fn( () => {

			const vUv = uv()

			const sample = ( x, y, weight ) => input.sample( vUv.add( texelSize.mul( vec2( x, y ) ) ) ).mul( weight )

			const c = vec4( 0.0 ).toVar()

			c.addAssign( sample( -1, 1, 0.0625 ) )
			c.addAssign( sample( 0, 1, 0.125 ) )
			c.addAssign( sample( 1, 1, 0.0625 ) )
			c.addAssign( sample( -1, 0, 0.125 ) )
			c.addAssign( input.sample( vUv ).mul( 0.25 ) )
			c.addAssign( sample( 1, 0, 0.125 ) )
			c.addAssign( sample( -1, -1, 0.0625 ) )
			c.addAssign( sample( 0, -1, 0.125 ) )
			c.addAssign( sample( 1, -1, 0.0625 ) )

			return mix( this.upSupport.sample( vUv ), c, this.uniforms.radius )

		} )()
	}

	get texture() {

		return this.upsamplingMipmaps[ 0 ].texture
	}

	set radius( value ) {

		this.uniforms.radius.value = value
	}

	get radius() {

		return this.uniforms.radius.value
	}

	set threshold( value ) {

		this.uniforms.threshold.value = value

		this.updateThreshold()
	}

	set smoothing( value ) {

		this.uniforms.smoothing.value = value

		this.updateThreshold()
	}

	updateThreshold() {

		const { threshold, smoothing, useThreshold } = this.uniforms

		useThreshold.value = ( threshold.value > 0 || smoothing.value > 0 ) ? 1 : 0
	}

	render( renderer, input ) {

		let previous = input

		if ( this.luminanceEnabled ) {

			this.luminanceInput.value = input.texture

			renderer.setRenderTarget( this.luminanceTarget )

			quad.material = this.luminanceMaterial

			quad.render( renderer )

			previous = this.luminanceTarget
		}

		quad.material = this.downsamplingMaterial

		for ( let i = 0; i < this.downsamplingMipmaps.length; i++ ) {

			const mipmap = this.downsamplingMipmaps[ i ]

			this.uniforms.downTexelSize.value.set( 1 / previous.width, 1 / previous.height )

			this.downInput.value = previous.texture

			renderer.setRenderTarget( mipmap )

			quad.render( renderer )

			previous = mipmap
		}

		quad.material = this.upsamplingMaterial

		for ( let i = this.upsamplingMipmaps.length - 1; i >= 0; i-- ) {

			const mipmap = this.upsamplingMipmaps[ i ]

			this.uniforms.upTexelSize.value.set( 1 / previous.width, 1 / previous.height )

			this.upInput.value = previous.texture

			this.upSupport.value = this.downsamplingMipmaps[ i ].texture

			renderer.setRenderTarget( mipmap )

			quad.render( renderer )

			previous = mipmap
		}
	}

	setSize( width, height ) {

		this.resolution.set( width, height )

		this.luminanceTarget.setSize( Math.max( 1, Math.floor( width ) ), Math.max( 1, Math.floor( height ) ) )

		let w = width

		let h = height

		for ( let i = 0; i < this.downsamplingMipmaps.length; i++ ) {

			w = Math.round( w * 0.5 )

			h = Math.round( h * 0.5 )

			this.downsamplingMipmaps[ i ].setSize( Math.max( 1, w ), Math.max( 1, h ) )

			if ( i < this.upsamplingMipmaps.length ) {

				this.upsamplingMipmaps[ i ].setSize( Math.max( 1, w ), Math.max( 1, h ) )
			}
		}
	}

	dispose() {

		this.luminanceTarget.dispose()

		this.downsamplingMipmaps.forEach( ( target ) => target.dispose() )

		this.upsamplingMipmaps.forEach( ( target ) => target.dispose() )

		this.luminanceMaterial.dispose()

		this.downsamplingMaterial.dispose()

		this.upsamplingMaterial.dispose()
	}
}
