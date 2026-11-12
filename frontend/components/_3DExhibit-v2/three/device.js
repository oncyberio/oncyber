// @ts-check

// Device and browser flags read from the user agent. Like shellconstants.js
// this module must stay free of three.js and other engine code so the app
// shell can import it; `three/constants.js` re-exports every name here.

import { UAParser } from "./utils/uaparser.js";

import { IS_FRONTEND_ENV } from "@utils/isFrontend";

// Same checks as isMacMobile / isIOS in utils/platform.js, which also
// imports detect-gpu and so cannot be imported from here.
const APPLE_MOBILE_PLATFORMS = [
    "iPad Simulator",
    "iPhone Simulator",
    "iPod Simulator",
    "iPad",
    "iPhone",
    "iPod",
];

function isMacMobile() {
    return (
        APPLE_MOBILE_PLATFORMS.includes(navigator.platform) ||
        // iPad on iOS 13 detection
        (navigator.userAgent.includes("Mac") && "ontouchend" in document)
    );
}

function isIOS() {
    return APPLE_MOBILE_PLATFORMS.includes(navigator.platform);
}

export const FRONT_END = IS_FRONTEND_ENV;

const uaParser = FRONT_END ? new UAParser() : null;

if (uaParser != null) {
    uaParser.setUA(navigator.userAgent);
}

const deviceType = FRONT_END ? uaParser.getDevice().type : null;

export const UA_RESULT = FRONT_END ? uaParser.getResult() : null;

export const IS_IOS = FRONT_END && isIOS();

export const IS_MAC_MOBILE = FRONT_END && isMacMobile();

export var isTouchDevice = FRONT_END
    ? "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-ignore
      navigator.msMaxTouchPoints > 0
    : null;

export var IS_DESKTOP = deviceType != "tablet" && deviceType != "mobile";

export var IS_MOBILE = IS_DESKTOP == false;

if (IS_MAC_MOBILE) {
    IS_DESKTOP = false;

    IS_MOBILE = true;
} else if (IS_DESKTOP == true) {
    isTouchDevice = false;
}

export const IS_MAC = FRONT_END
    ? /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform)
    : null;

export const IS_ANDROID = FRONT_END
    ? /(android)/i.test(navigator.userAgent)
    : null;

export const BROWSER = FRONT_END ? uaParser.getBrowser() : null;

export const IS_SAFARI = FRONT_END ? BROWSER.name == "Safari" : null;

export const IS_CHROME = FRONT_END
    ? BROWSER?.name?.toLowerCase() === "chrome"
    : false;

export const DELETE_KEY = IS_MAC ? "Backspace" : "Delete";

export const IS_TOUCH = isTouchDevice;
