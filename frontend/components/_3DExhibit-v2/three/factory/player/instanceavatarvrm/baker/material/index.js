import {

	MeshBasicNodeMaterial,

	NoBlending,

	DoubleSide,

	Texture

} from 'three/webgpu'

import {

	texture,

	textureSize,

	ivec2,

	vec2,

	uv

} from 'three/tsl'


/*
 * Blits a baked clip ( float DataTexture ) into the animation atlas render target.
 * fragmentNode writes the raw texel: no output clamp, fog, blending or colour conversion,
 * bone matrices keep their exact ( negative ) float values.
 */

export default class Material extends MeshBasicNodeMaterial {

	constructor( options ){

		super()

		const map = texture( new Texture() )

		this.uniforms = {

			map: map
		}

		// integer texel fetch: float32 sources need no filterable sampler

		const texel = ivec2( uv().mul( vec2( textureSize( map ) ) ).floor() )

		this.fragmentNode = map.load( texel ).setUpdateMatrix( false )

		this.side = DoubleSide

		this.blending = NoBlending

		this.fog = false

		this.depthTest = false

		this.depthWrite = false
	}
}
