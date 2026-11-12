import {

	Mesh

} from 'three'

import {

	MeshBasicNodeMaterial

} from 'three/webgpu'

import {

	vec3,

	vec4,

	uniform,

	positionGeometry

} from 'three/tsl'

import Triangle from './triangle'

// Full-screen black veil (clip-space triangle) faded through `alpha`.
class CacheMaterial extends MeshBasicNodeMaterial {

	constructor(){

		super()

		this.uniforms = {

			opacity: uniform( 1 )
		}

		this.vertexNode = vec4( positionGeometry, 1.0 )

		this.colorNode = vec3( 0.0 )

		this.opacityNode = this.uniforms.opacity

		this.depthTest = false

		this.depthWrite = false

		this.transparent = true

		this.fog = false
	}
}

export default class CacheMesh extends Mesh {

	constructor(){

		super( Triangle, new CacheMaterial())

		this.frustumCulled = false
	}

	set alpha(val){

		this.material.uniforms.opacity.value = val
	}

	get alpha(){

		return this.material.uniforms.opacity.value
	}
}
