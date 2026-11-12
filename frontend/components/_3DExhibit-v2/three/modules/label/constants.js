// @ts-check


export const LABEL_ICONS = {
    PRESS_E      : "https://cyber.mypinata.cloud/ipfs/QmQyP5jBXS6rggQvAwBxfyRUZYEaEX9tqkdZF6rjhnDoEi?filename=the_E_iwmmk5.png",

    PRESS_C      : "/images/textures/click-door.png",

    CLICK_DOOR   : "/images/textures/click-door.png",

    DOOR_OPENED  : "/images/textures/door-opened.png",

    PRESS_F      : "https://cyber.mypinata.cloud/ipfs/QmfDcFUuz1qDShE4puce5ZT982iPkUfQKWyvJyM4Bjjy9a?filename=the_F_ckjvno.png",

    TAP          : "/images/textures/tapp.png",

    PRESS_O      : "https://cyber.mypinata.cloud/ipfs/QmVAJgBskt9S8oumMaJ3q8eaVqJ1qX5DWxQsJCjrVXNQCr?filename=the_O_qdjyeo.png",
}

export const LABEL_STATES = {

    ATTACHED: /** @type {const} */ ("ATTACHED"),

    DETACHED: /** @type {const} */ ("DETACHED"),

    SHOWING: /** @type {const} */ ("SHOWING"),

    HIDING: /** @type {const} */ ("HIDING"),
}


export const MESSAGE_STATES = {

    ENTER : 'ENTER',
    OPEN  : 'OPEN',
    NOT_OWNED : 'NOT_OWNED',
    BACK : 'BACK'
}

export const MESSAGES = {



	ENTER : {
		DESKTOP : "You can now walk in!",
		MOBILE  : "Tap to enter"
	},

	NOT_OWNED : {

		DESKTOP : "Space not in deployer's wallet anymore",
		MOBILE  : "Space not in deployer's wallet anymore"
	},
	BACK : {

		DESKTOP : "Press F to go back anytime",
		MOBILE  : "Press F to go back anytime"
	}
}
