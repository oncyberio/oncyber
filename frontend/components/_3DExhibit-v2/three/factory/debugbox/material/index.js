import {

	Color

} from 'three'

import { LineBasicNodeMaterial } from 'three/webgpu'

import { sRGBTransferEOTF, uniform } from 'three/tsl'

export default class DebugMaterial extends LineBasicNodeMaterial {

	constructor(color = 0xffffff, opacity = 1){

		super( {

			transparent: true,

			side: 0,

			// the WebGL shader had no fog / tonemapping / colorspace chunks

			fog: false,

			toneMapped: false
		} )

		this.uniforms = {

			color: uniform( new Color(color) ),

			opacity: uniform( opacity )
		}

		// gl_FragColor was written as-is: undo the output sRGB encode

		this.colorNode = sRGBTransferEOTF( this.uniforms.color )

		this.opacityNode = this.uniforms.opacity

	}
}
