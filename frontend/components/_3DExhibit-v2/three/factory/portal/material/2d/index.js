import {

	MeshBasicNodeMaterial

} from 'three/webgpu'

import {

	texture,

	uniform,

	uv

} from 'three/tsl'

import { correctRatio } from '../utils.js'



/**
 * Flat portal preview: the destination's hero image, cropped to the portal's
 * aspect ratio ("cover" fit).
 */
export default class TwoDMaterial extends MeshBasicNodeMaterial {

	constructor( opts ){

		super()

		const aspect = uniform( opts.aspect ?? 1 )

		const uvBackground = correctRatio( uv(), 1.0, aspect ).toVarying( 'vUvBackground' )

		this.uniforms = {

			map: texture( opts.map, uvBackground ),

			aspect,
		}

		// The GLSL version ended in <colorspace_fragment>, so the linear sample is
		// what the node pipeline expects.
		this.colorNode = this.uniforms.map

		this.fog = false
	}
}
