const AWAY = 100000

import {

	IS_MOBILE

} from '@3constants'

const CANVAS_SIZE = {

	w: 256 * ( IS_MOBILE ? 1 : 2 ) ,

	h: 50  * ( IS_MOBILE ? 1 : 2 ),

	aspect : 1,

	fontSize: 27 * ( IS_MOBILE ? 1 : 2 )
}

CANVAS_SIZE.aspect = CANVAS_SIZE.w / CANVAS_SIZE.h

export {

	CANVAS_SIZE,
	
	AWAY
}

