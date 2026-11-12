import {

	CylinderGeometry,

	Vector3

} from 'three'

import {

	USER_HEIGHT

} from '@3constants'

const scale = 0.3;

const BASE_GEOMETRY = new CylinderGeometry( scale, scale, scale * 0.2, 32 );

BASE_GEOMETRY.rotateX(Math.PI / 2);

BASE_GEOMETRY.rotateZ(Math.PI / 2);

BASE_GEOMETRY.computeBoundingBox()

BASE_GEOMETRY.centerPoint = new Vector3()

BASE_GEOMETRY.centerPoint.set(
	(BASE_GEOMETRY.boundingBox.max.x + BASE_GEOMETRY.boundingBox.min.x) / 2,
	(BASE_GEOMETRY.boundingBox.max.y + BASE_GEOMETRY.boundingBox.min.y) / 2,
	(BASE_GEOMETRY.boundingBox.max.z + BASE_GEOMETRY.boundingBox.min.z) / 2
)


export default BASE_GEOMETRY