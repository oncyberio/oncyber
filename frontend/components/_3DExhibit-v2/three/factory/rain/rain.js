import RainGeometry  	from './geometry.js'

import RainMaterial  	from './material.js'

import PipeLineMesh  	from '@3abstract/pipelinemesh'

import emitter 			from  	'@3emitter'

import Events 			from 	'@3events'

export default class RainMesh extends PipeLineMesh {

	constructor( opts ){

		let geometry = new RainGeometry()

		let material = new RainMaterial( opts )

		super(geometry, material, {

			// visibleOnOcclusion : false,

			visibleOnMirror : false
		})

		this.frustumCulled = false
	}

}