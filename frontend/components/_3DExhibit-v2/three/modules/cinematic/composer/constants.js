export const LAYOUT_TYPES 	= {

	SQUARE 		: 'SQUARE',

	LANDSCAPE	: 'LANDSCAPE',

	PORTRAIT 	: 'PORTRAIT'
}

export const LAYOUT_OPTIONS = {

	SQUARE: {

		w: 1440,

		h: 1440
	},

	LANDSCAPE : {

		w: 1920,

		h: 1090
	},

	PORTRAIT : {

		w: 1080 * 0.75,

		h: 1920 * 0.75
	}
}

export const LAYOUT_CURRENT = LAYOUT_TYPES.SQUARE