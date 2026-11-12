import {

	CylinderGeometry,

	PlaneGeometry,

	Vector3

} from 'three'

import {

	CANVAS_SIZE

} from './constants.js'

const BASE_GEOMETRY = new PlaneGeometry(1 * CANVAS_SIZE.aspect * 0.4,1 * 0.4,1,1)

export default BASE_GEOMETRY