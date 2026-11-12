// @ts-check

import {

	Mesh ,

	SphereGeometry

} from 'three'

import Camera from '@3camera'

import Material from './material'

export default class PanoramaMesh extends Mesh {

	constructor(){

		super(new SphereGeometry(1,64, 64), new Material())

		this.onBeforeRender = ()=>{

			this.position.copy(Camera.current.position)
		}

		this.scale.set(20,20,20)

		this.renderOrder = 100000000000

		this.frustumCulled = false
	}

	reset(){

		this.material.reset()

		this.visible = false
	}

	show(){

		this.visible = true

		this.material.show()
	}

	hide() {

		this.material.hide().then(()=>{

			this.visible = false
		})
	}
}
