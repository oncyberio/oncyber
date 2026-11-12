import {

	Color,

	FrontSide

} from 'three'

import {

	NodeMaterial

} from 'three/webgpu'

import {

	positionGeometry,

	uniform,

	vec4

} from 'three/tsl'

/**
 * Flat background colour on a full-screen triangle at the far plane.
 * `color` is linear; the output is converted to sRGB like the WebGL shader.
 */
export default class ColorMaterial extends NodeMaterial {

	constructor(){

		super()

		this.name = 'BackgroundColorMaterial'

		this.uniforms = {

			color: uniform( new Color() )
		}

		this.fog = false

		this.transparent = true

		this.side = FrontSide

		// clip-space triangle, z = w (far plane)
		this.vertexNode = vec4( positionGeometry.xy, 1.0, 1.0 )

		this.colorNode = this.uniforms.color
	}
}
