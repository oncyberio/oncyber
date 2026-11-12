import {

	vec4,
	varying,
	positionGeometry,

} from 'three/tsl'

import {

	ArtworkNodeMaterial,
	materialTexture,

} from '@3factory/artwork/nodematerial'

// full-screen triangle: positions are already in clip space
const vertexNode = vec4( positionGeometry, 1.0 )

const vUv = varying( positionGeometry.xy.mul( 0.5 ).add( 0.5 ) )

// Rendered into a render target: no output conversion either way.
const colorNode = materialTexture( 'map', vUv )

export default class RenderMaterial extends ArtworkNodeMaterial {

	static get type() {

		return 'HighlightRenderMaterial'
	}

	constructor(){

		super()

		this.uniforms = {

			map: {

				value: null
			}
		}

		this.vertexNode = vertexNode

		this.colorNode = colorNode

		this.depthTest = false

		this.depthWrite = false

		this.side = 2
	}

	set map( val ){

		this.uniforms.map.value = val

		// rebuild only if the new texture needs a different build (see textureCacheKey)
		this.needsUpdate = true
	}

	get map(){

		return this.uniforms.map.value
	}
}
