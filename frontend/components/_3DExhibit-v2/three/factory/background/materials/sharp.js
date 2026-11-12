import {

	BackSide

} from 'three'

import {

	NodeMaterial

} from 'three/webgpu'

import {

	modelViewProjection,

	texture,

	uv

} from 'three/tsl'

// `.sample()` re-enables the texture's uv transform; these coordinates are raw.
const sampleRaw = ( node, coord ) => node.sample( coord ).setUpdateMatrix( false )

/**
 * The unfiltered ("sharp") equirect background image on a camera-centred
 * sphere at the far plane.
 */
export default class SharpMaterial extends NodeMaterial {

	constructor( opts ){

		super()

		this.name = 'BackgroundSharpMaterial'

		this.uniforms = {

			map: texture( opts.map )
		}

		this.fog = false

		this.transparent = true

		this.side = BackSide

		// set z to camera.far
		this.vertexNode = modelViewProjection.setZ( modelViewProjection.w )

		this.colorNode = sampleRaw( this.uniforms.map, uv() )
	}
}
