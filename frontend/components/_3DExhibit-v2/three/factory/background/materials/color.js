import {

	Color,

	FrontSide

} from 'three'

import {

	NodeMaterial

} from 'three/webgpu'

import {

	cameraIndex,

	float,

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

		// clip-space triangle, z = w (far plane). In VR the renderer draws
		// once per eye and binds the eye's index; a shader that never reads
		// it has no slot for it and the draw throws, so the frame is lost.
		// Reading it keeps that slot; times 1e-30 so the compiler can't drop it,
		// and 1 + 1e-30 is still exactly 1 in float, so nothing moves.
		this.vertexNode = vec4( positionGeometry.xy, float( cameraIndex ).mul( 1e-30 ).add( 1.0 ), 1.0 )

		this.colorNode = this.uniforms.color
	}
}
