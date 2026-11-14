const AWAY = 100000

import {

	IS_MOBILE

} from '@3constants'

// Name tags draw at this multiple of 256 x 50 pixels. Up close a tag covers
// a few hundred pixels of a retina screen, so it needs the extra resolution
// or the letters show their pixels.
const CANVAS_SCALE = IS_MOBILE ? 2 : 4

const CANVAS_SIZE = {

	w: 256 * CANVAS_SCALE,

	h: 50  * CANVAS_SCALE,

	aspect : 1,

	fontSize: 27 * CANVAS_SCALE,

	scale: CANVAS_SCALE
}

// The name tag atlas: 2 x 10 tags whatever the canvas scale.
const ATLAS_SIZE = 512 * CANVAS_SCALE

CANVAS_SIZE.aspect = CANVAS_SIZE.w / CANVAS_SIZE.h

export {

	CANVAS_SIZE,

	ATLAS_SIZE,
	
	AWAY
}

