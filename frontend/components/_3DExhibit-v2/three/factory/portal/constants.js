import { IS_DESKTOP, IS_MOBILE, IS_VR } from "@3constants"

import { LABEL_ICONS } from "@3modules/label/constants";

export const STATES = {

    EMPTY: "empty",

	// at the start if we got the data
	LOADING 	: 'loading',

	// when another portal is open
	CLOSE 		: 'close',

	// need raycast on it  + user action
	OPENING 	: 'opening',

	// when opening is done
	OPEN 		: 'open'

}

export const NOT_OWNED = "NOT_OWNED"

const NOT_OWNED_MESSAGE = "Space not in deployer's wallet anymore";

const OPENING_TEXT = "Opening portal ..."

// label of a portal that failed while opening; the next press tries again
export const OPEN_FAILED_MESSAGE = "Couldn't open. Try again."

export const BACK_PORTAL_MESSAGE = {
    message: "Press F to go back anytime",
    iconUrl: LABEL_ICONS.PRESS_F
}

export const DESKTOP_LABEL_MESSAGES = {

    [STATES.CLOSE]: {
        message: "Press 'E' to open portal",
        iconUrl: LABEL_ICONS.PRESS_E,
    },
    [STATES.OPEN]: {
        message: "You can now walk in!",
        iconUrl: LABEL_ICONS.DOOR_OPENED,
    },

    NOT_OWNED: {
        message: NOT_OWNED_MESSAGE,
    }
};

export const MOBILE_LABEL_MESSAGES = {

    [STATES.CLOSE]: {
        message: "Tap to open Portal",
        iconUrl: LABEL_ICONS.CLICK_DOOR,
    },
    [STATES.OPEN]: {
        message: "You can now walk in!",
        iconUrl: LABEL_ICONS.DOOR_OPENED,
    },

    NOT_OWNED: {
        message: NOT_OWNED_MESSAGE,
    }

};

// TODO: We'll add this when set vr mode in constants

export const VR_LABEL_MESSAGES = {

    [STATES.CLOSE]: {
        message: "Shoot to open Portal",
        iconUrl: LABEL_ICONS.CLICK_DOOR,
    },
    [STATES.OPEN]: {
        message:  "Shoot to enter!",
        iconUrl: LABEL_ICONS.DOOR_OPENED,
    },

    NOT_OWNED: {
        message: NOT_OWNED_MESSAGE,
    }
};


export class LABEL_MESSAGES {


    static getMessageConfig() {

        return IS_MOBILE ? MOBILE_LABEL_MESSAGES : IS_VR ? VR_LABEL_MESSAGES : DESKTOP_LABEL_MESSAGES

    }

    static get [STATES.CLOSE]() {

        return this.getMessageConfig()[STATES.CLOSE]
    }

    static get [STATES.OPEN]() {

        return this.getMessageConfig()[STATES.OPEN]
    }

    static get NOT_OWNED() {

        return this.getMessageConfig()[NOT_OWNED]
    }

}

export const MESSAGE_STATES = {

    ENTER : 'enter',
    OPEN  : 'open',
    OWNED : 'not_owned'
}
