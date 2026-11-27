/**
 * How the compare tool frames what it draws, shared by the page that draws
 * and the command that lays pictures out. No imports: both load it as is.
 */

/** What a close-up of an eye takes in round it, in eye widths. */
export const EYE_VIEW = { inwards: 0.42, outwards: 1.53, down: 0.49, up: 1.09 };

/** How much of the figure a view of the face shows, top to bottom, metres. */
export const FACE_SPAN = 0.36;
/** The same with hair tried on: more room above the head. */
export const FACE_SPAN_WITH_HAIR = 0.46;

/** The views there are, and the size of the picture of each, pixels. */
export const VIEWS: Record<string, [number, number]> = {
    face: [900, 900],
    "three-quarter": [900, 900],
    side: [900, 900],
    back: [900, 900],
    "eye-left": [860, 697],
    "eye-right": [860, 697],
    body: [640, 1040],
    "body-back": [640, 1040],
};
