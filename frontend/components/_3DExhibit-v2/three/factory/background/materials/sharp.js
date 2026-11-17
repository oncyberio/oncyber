import {

	BackSide

} from 'three'

import {

	NodeMaterial

} from 'three/webgpu'

import {

	texture,

	uv

} from 'three/tsl'

import { skyClipPosition } from './skyPosition.js'

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

		// At infinity (far plane), the same for both eyes in VR.
		this.vertexNode = skyClipPosition()

		this.colorNode = sampleRaw( this.uniforms.map, uv() )
	}
}
