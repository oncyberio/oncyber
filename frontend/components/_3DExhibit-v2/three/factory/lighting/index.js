import {

	Object3D

} from 'three'

import LightingWrapper from './wrapper.js'

const SHADOW_MAP_WIDTH = 2048

class Lighting {

	constructor() {

	}

	get( opts, scene ){

		return new LightingWrapper( opts, scene )
	}
}

export default new Lighting()