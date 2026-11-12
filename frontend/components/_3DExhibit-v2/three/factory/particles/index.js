import PipeLineMesh from '@3abstract/pipelinemesh'

import Geometry 		from './geometry.js'

import Material 		from './material/index.js'


class Particles {

	constructor(){

		// this.lines = LinesFactory.get({

		// 	count: 5,
		// 	res: [
		// 		30,60,15,5,20
		// 	],
		// 	width : [
		// 		1, 3, 5, 2, 0.5
		// 	],
		// 	colors : 
		// 	[
		// 		[ 0.845, 0.126, 0.029 	],
		// 		[ 0.845, 0.586, 0.0 	],
		// 		[ 0.845, 0.459, 0.364  	],
		// 		[ 0.0, 0.063, 1 		],
		// 		[ 0.845, 0.258, 0.724 	]
		// 	]
		// })


	}

	get( config ){

		// console.log(config)

		this.geometry = new Geometry( config )

		this.material = new Material()

		let mesh = new PipeLineMesh(this.geometry, this.material, {

			occlusionMaterial: new Material({occlusion: true}),
			visibleOnMirror: false
		} )

		mesh.frustumCulled = false

		mesh.renderOrder = 10000000

		mesh.scale.set(3.7,3.7,3.7)

		// mesh.scale.set()

		return mesh
	}
}

export default new Particles()