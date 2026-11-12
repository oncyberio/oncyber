import Triangle from "@3gl/globals/triangle";

import {

	Scene,

	Mesh,

	DoubleSide,

	LinearFilter,

	LinearMipMapLinearFilter,

} from 'three'

import {

	MeshBasicNodeMaterial,

	RenderTarget

} from 'three/webgpu'

import {

	mix,

	positionGeometry,

	texture,

	uniform,

	vec2,

	vec4

} from 'three/tsl'

import Camera from '@3camera'

import Renderer from '@3renderer'

import { correctRatio } from '@3factory/portal/material/utils.js'

/**
 * Full-screen triangle that bakes the 2D preview image ( "cover" fit ) with the
 * info card on top. Writes into a linear target, unconverted, like the GLSL did.
 */
class PortalInfoMaterial extends MeshBasicNodeMaterial {

	constructor( opts ){

		super()

		const aspect = uniform( opts.aspect )

		const vUv = vec2( 0.5 ).add( positionGeometry.xy.mul( 0.5 ) ).toVarying( 'vUv' )

		const vUvBackground = correctRatio( vUv, 1.0, aspect ).toVarying( 'vUvBackground' )

		const map = texture( opts.map, vUvBackground )

		const tInfo = texture( opts.tInfo, vUv )

		this.uniforms = { tInfo, map, aspect }

		this.vertexNode = vec4( positionGeometry, 1.0 )

		this.colorNode = mix( map, tInfo, tInfo.a )

		this.side = DoubleSide

		this.fog = false

		this.depthTest = false

		this.depthWrite = false
	}
}

class PortalInfo {

	constructor(){

		this.scene = new Scene()

	}

	get( tmap, tinfo, geometry, aspect ){



		let mat = new PortalInfoMaterial({
			map: tmap,
			tInfo: tinfo,
			aspect

		})


		var mesh = new Mesh(Triangle, mat)

		mesh.frustumCulled = false

		mesh.position.z = -10


		let oldTarget = Renderer.getRenderTarget()

        let isVR = Renderer.xr.enabled

		let output = new RenderTarget( tinfo.source.data.width,  tinfo.source.data.height, {

			minFilter: LinearMipMapLinearFilter,

			magFilter: LinearFilter,

			generateMipmaps: true
		} )

		output.texture.renderTarget = output

		// output.colorSpace = SRGBColorSpace

		this.scene.add( mesh )

        Renderer.xr.enabled = false
		Renderer.setRenderTarget( output )

		Renderer.render(this.scene, Camera.current)

		Renderer.xr.enabled = isVR
        Renderer.setRenderTarget( oldTarget )

		this.scene.remove( mesh )

		mesh = null

		tinfo.dispose()

		tinfo = null

		tmap.dispose()

		tmap = null

		mat.dispose()

		mat = null


		return output


	}
}

export default new PortalInfo()
