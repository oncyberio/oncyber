import {

	NodeMaterial,

	QuadMesh,

	Texture,

	Vector2

} from 'three/webgpu'

import {

	Fn,

	texture,

	uniform,

	uv,

	vec4

} from 'three/tsl'

import renderer from '@3renderer'

// `.sample()` re-enables the texture's uv transform; these coordinates are raw.
const sampleRaw = ( node, coord ) => node.sample( coord ).setUpdateMatrix( false )

// 9-tap separable gaussian, the same weights as the WebGL blur.
const WEIGHTS = [ 0.1633, 0.1531, 0.12245, 0.0918, 0.051 ]

class BlurPass {

	constructor(){

		this.uniforms = {

			tInput		: texture( new Texture() ),

			direction 	: uniform( new Vector2( 0, 0 ) )
		}

		const { tInput, direction } = this.uniforms

		this.material = new NodeMaterial()

		this.material.name = 'BlurPass'

		this.material.depthTest = false

		this.material.depthWrite = false

		this.material.fog = false

		this.material.fragmentNode = Fn( () => {

			const coord = uv()

			const center = sampleRaw( tInput, coord )

			const color = center.rgb.mul( WEIGHTS[ 0 ] ).toVar()

			for( let i = 1; i < WEIGHTS.length; i ++ ) {

				const delta = direction.mul( i )

				color.addAssign( sampleRaw( tInput, coord.sub( delta ) ).rgb.mul( WEIGHTS[ i ] ) )

				color.addAssign( sampleRaw( tInput, coord.add( delta ) ).rgb.mul( WEIGHTS[ i ] ) )
			}

			// rgb is blurred, alpha is kept from the centre texel
			return vec4( color, center.a )

		} )()

		this.mesh = new QuadMesh( this.material )
	}

	blur(input, temp, iteration = 8){

		var currentAutoClear 	= renderer.autoClear

		renderer.autoClear = false

		var currentRenderTarget = renderer.getRenderTarget()

		var currentShadowAutoUpdate = renderer.shadowMap.autoUpdate

		renderer.shadowMap.autoUpdate = false

		this.uniforms.direction.value.set(

			1 / input.width, 0
		)

		this.uniforms.tInput.value = input.texture

		renderer.setRenderTarget( temp )

		this.mesh.render( renderer )

		this.uniforms.direction.value.set(

			0, 1 / input.height
		)

		this.uniforms.tInput.value = temp.texture

		renderer.setRenderTarget( input )

		this.mesh.render( renderer )

		renderer.setRenderTarget( currentRenderTarget )

		renderer.autoClear = currentAutoClear

		renderer.shadowMap.autoUpdate = currentShadowAutoUpdate

	}

}

export default new BlurPass()
