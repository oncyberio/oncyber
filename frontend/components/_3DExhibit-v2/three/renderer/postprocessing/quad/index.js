import {

	NodeMaterial,

	QuadMesh,

	Color,

	Texture,

	LinearFilter,

	NearestFilter,

	NoBlending

} from 'three/webgpu'

import {

	Fn,

	vec2,

	vec3,

	vec4,

	uv,

	dot,

	floor,

	ceil,

	fract,

	mix,

	sin,

	cos,

	saturate,

	texture,

	uniform

} from 'three/tsl'

import Textures from "@3textures"

import Renderer from '@3renderer'

import Shared from '@3shared'

import MipmapBlur from './mipmapblur.js'

import { POST_TYPES } from "@3editgui/index.js";

// Full-screen kernels of the post pipeline. The scene target holds linear
// colour and the renderer converts the final output to sRGB, exactly like the
// WebGL kernels' `#include <colorspace_fragment>`. The WebGL scene target was
// 8-bit, so its samples are clamped to [0, 1] here.

const neutralBase64 = "data:image/png;base64,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"

const INV_512 = 0.001953125

const INV_512_HALF = 0.0009765625

const INV_8 = 0.125

const W = vec3( 0.2125, 0.7154, 0.0721 )

const quad = new QuadMesh()

function createKernel( name, fragmentNode, extra = {} ) {

	const material = new NodeMaterial()

	material.name = name

	material.fragmentNode = fragmentNode

	material.blending = NoBlending

	material.depthTest = false

	material.depthWrite = false

	material.transparent = false

	return Object.assign( { material }, extra )
}

// Shared timer as a node uniform, refreshed once per render.
const timer = uniform( 0 ).onRenderUpdate( () => Shared.timer.value )

// The WebGL `vUv` grew upward; the quad's uv grows downward.
const glUv = () => vec2( uv().x, uv().y.oneMinus() )

const screenBlend = ( base, blend ) => vec4( 1.0 ).sub( vec4( 1.0 ).sub( base ).mul( vec4( 1.0 ).sub( blend ) ) )

// 512x512 / 8x8 tiles lookup table (the WebGL `lookup()` helper).
const lookup = ( textureColor, lut, flipY ) => {

	const color = saturate( textureColor )

	const blueColor = color.b.mul( 63.0 )

	const quad1y = floor( floor( blueColor ).mul( INV_8 ) )
	const quad1x = floor( blueColor ).sub( quad1y.mul( 8.0 ) )

	const quad2y = floor( ceil( blueColor ).mul( INV_8 ) )
	const quad2x = ceil( blueColor ).sub( quad2y.mul( 8.0 ) )

	const offsetR = color.r.mul( 0.125 - INV_512 ).add( INV_512_HALF )
	const offsetG = color.g.mul( 0.125 - INV_512 ).add( INV_512_HALF )

	let texPos1y = quad1y.mul( 0.125 ).add( offsetG )
	let texPos2y = quad2y.mul( 0.125 ).add( offsetG )

	if ( flipY ) {

		texPos1y = texPos1y.oneMinus()
		texPos2y = texPos2y.oneMinus()
	}

	const texPos1 = vec2( quad1x.mul( 0.125 ).add( offsetR ), texPos1y )
	const texPos2 = vec2( quad2x.mul( 0.125 ).add( offsetR ), texPos2y )

	return mix( lut.sample( texPos1 ), lut.sample( texPos2 ), fract( blueColor ) )
}

const hueShift = ( color, dhue ) => {

	const s = sin( dhue )

	const c = cos( dhue )

	// `(color * s) * mat3(c0, c1, c2)` in GLSL is a row-vector product.
	const rotated = vec3(

		dot( color, vec3( 0.167444, 0.329213, -0.496657 ) ),

		dot( color, vec3( -0.327948, 0.035669, 0.292279 ) ),

		dot( color, vec3( 1.250268, -1.047561, -0.202707 ) )

	).mul( s )

	return color.mul( c ).add( rotated ).add( dot( vec3( 0.299, 0.587, 0.114 ), color ).mul( c.oneMinus() ) )
}

export default class Quad {

	constructor() {

		this.width = 1

		this.height = 1

		this.initPasses()
	}

	render( source, occlusion, roomParameters, target ) {

		const effect = roomParameters.usePostProcessing.type

		const postProValues = roomParameters.usePostProcessing.value

		if( effect == POST_TYPES.BLOOM ){

			this.bloom.threshold = postProValues.threshold
			this.bloom.smoothing = postProValues.smoothing
			this.blendKernel.uniforms.intensity.value = postProValues.intensity
			this.bloom.radius = postProValues.radius

			this.bloom.luminanceEnabled = true

			this.bloom.render( Renderer, occlusion )

			this.blendKernel.uniforms.tInput2.value = this.bloom.texture

			this.blendKernel.uniforms.bloomColor.value.set(postProValues.color).convertSRGBToLinear()

			this.compute( this.blendKernel, source, target )
		}

		else if( effect == POST_TYPES.CYBERCITY ) {

			this.blendCityKernel.uniforms.intensity.value 		= postProValues.intensity

			this.blendCityKernel.uniforms.correctColor.value 	= postProValues.correctColor

			this.bloom.radius 									= postProValues.radius

			this.bloom.luminanceEnabled = false

			this.bloom.render( Renderer, occlusion )

			this.blendCityKernel.uniforms.tInput2.value = this.bloom.texture

			this.compute( this.blendCityKernel, source, target )

		}

		else if( effect == POST_TYPES.LOOK_UP_TABLE ) {

			const currentLut = postProValues.image.path

			if( this.lutKernel.currentLut != currentLut ) {

				try {

					if( Textures[currentLut] ) {

						this.setLut( Textures[currentLut] )
					}

					else {

						Textures.loadTexture({ name: currentLut, url : currentLut }).then(()=>{

							if( this.lutKernel.currentLut == currentLut && Textures[currentLut] != null ) {

								this.setLut( Textures[currentLut] )
							}
						})
					}

					this.lutKernel.currentLut =  currentLut
				}

				catch(e){


				}
			}

			this.compute( this.lutKernel, source, target )
		}

		else if( effect == POST_TYPES.TRIPPY ) {

			this.trippyKernel.uniforms.speed.value = postProValues.speed

			this.compute( this.trippyKernel, source, target )
		}
	}

	setLut( tex ) {

		tex.minFilter = NearestFilter
		tex.magFilter = LinearFilter
		tex.generateMipmaps = false
		tex.needsUpdate = true

		this.lutKernel.uniforms.lutTexture.value = tex
	}

	compute( kernel, source, target ) {

		kernel.uniforms.tInput.value = source.texture

		Renderer.setRenderTarget( target ? target : null )

		quad.material = kernel.material

		quad.render( Renderer )
	}

	initPasses() {

		const placeholder = new Texture()

		// bloom (pmndrs BloomEffect: luminance + mipmap blur)

		this.bloom = new MipmapBlur()

		this.bloom.threshold = 0.23

		this.bloom.smoothing = 0.594

		this.bloom.radius = 0.7

		// blend kernel

		{
			const uniforms = {

				tInput: texture( placeholder ),

				tInput2: texture( placeholder ),

				intensity: uniform( 5 ),

				bloomColor: uniform( new Color( 0xffffff ) )
			}

			const node = Fn( () => {

				const base = saturate( uniforms.tInput.sample( uv() ) )

				const blend = uniforms.tInput2.sample( uv() ).mul( vec4( uniforms.bloomColor, 1.0 ) ).mul( uniforms.intensity ).mul( 5.0 )

				return screenBlend( base, blend )

			} )()

			this.blendKernel = createKernel( 'PostBlend', node, { uniforms } )
		}

		// blend city kernel

		{
			const uniforms = {

				tInput: texture( placeholder ),

				tInput2: texture( placeholder ),

				intensity: uniform( 5 ),

				correctColor: uniform( 0 )
			}

			const node = Fn( () => {

				const base = saturate( uniforms.tInput.sample( uv() ) )

				const blend = uniforms.tInput2.sample( uv() ).mul( uniforms.intensity ).mul( 5.0 )

				const temp = screenBlend( base, blend ).toVar()

				const lumi = dot( temp.rgb, W )

				return vec4( temp.rgb.add( lumi.oneMinus().mul( 0.08 ).mul( uniforms.correctColor ) ), temp.a )

			} )()

			this.blendCityKernel = createKernel( 'PostBlendCity', node, { uniforms } )
		}

		// LUT kernel

		const neutralTexture = new Texture()

		if ( typeof Image !== 'undefined' ) {

			const img = new Image()

			img.onload = () => { neutralTexture.needsUpdate = true }

			img.src = neutralBase64

			neutralTexture.image = img
		}

		neutralTexture.minFilter = NearestFilter
		neutralTexture.magFilter = LinearFilter
		neutralTexture.generateMipmaps = false

		{
			const uniforms = {

				tInput: texture( placeholder ),

				lutTexture: texture( neutralTexture )
			}

			const node = Fn( () => {

				return lookup( uniforms.tInput.sample( uv() ), uniforms.lutTexture, true )

			} )()

			this.lutKernel = createKernel( 'PostLut', node, { uniforms, currentLut: null } )
		}

		// trippy kernel

		{
			const uniforms = {

				tInput: texture( placeholder ),

				timer,

				speed: uniform( 0.1 )
			}

			const node = Fn( () => {

				const texel = saturate( uniforms.tInput.sample( uv() ) )

				const dhue = uniforms.timer.mul( 4.0 ).mul( uniforms.speed ).add( glUv().y.mul( 3.0 ) )

				return vec4( hueShift( texel.rgb, dhue ), texel.a )

			} )()

			this.trippyKernel = createKernel( 'PostTrippy', node, { uniforms } )
		}
	}

	resize( w, h, dpi ) {

		this.width = w

		this.height = h

		this.bloom.setSize( w * dpi, h * dpi )
	}
}
