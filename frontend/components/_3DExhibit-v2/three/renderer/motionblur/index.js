import { CameraMotionBlur } from "./cameraMotionBlur"

import { pageMotionBlurOptions } from "./settings"

// One blur for the space's main view, created on first use when the page
// asks for it (?motionblur=1, see settings.ts).
const options = pageMotionBlurOptions()

let instance = null

/** The space's motion blur, or null when the page didn't turn it on. */
export function spaceMotionBlur() {

	if ( !options.enabled ) return null

	if ( !instance ) {

		instance = new CameraMotionBlur( options )

		// For measuring: `await __motionBlur.benchmark()` in the console.
		if ( typeof window !== "undefined" ) window.__motionBlur = instance
	}

	return instance
}

/** True while the last drawn frame was blurred: draw one more, sharp. */
export function motionBlurSettling() {

	return instance?.settling === true
}
