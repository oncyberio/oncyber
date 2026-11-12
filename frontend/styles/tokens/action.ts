import { baseTokens as base } from "./base";

/**
 * Action buttons, on every surface. One spec: the same type, border width,
 * height and padding whether the button is a pill or a rounded rectangle.
 * Shape changes the corner radius only. Blue is for important actions
 * (sign in, publish); an ordinary main action is solid white; everything
 * else is the outline. See docs/brand/README.md and styles/brand/index.ts.
 */
export const actionTokens = {
    size: {
        minHeight: 40,
        paddingY: 10,
        paddingX: 16,
        gap: 10,
        compactGap: 7,
        borderWidth: 1,
    },
    radius: { rectangle: base.radius.control, pill: 999 },
    type: {
        font: `${base.font.weight.medium} ${base.font.size.md}px/1.35`,
        /**
         * Also resolves outside a `brandFoundation` root: "Aeonik" is the
         * app-wide registration of the same font files.
         */
        family: '"Oncyber Sans", "Aeonik", "Helvetica Neue", Arial, sans-serif',
    },
    /** Important actions only: sign in and publish. */
    blue: {
        ink: base.color.white,
        start: base.color.accentStart,
        fill: base.color.accent,
        end: base.color.accentEnd,
    },
    /** An ordinary main action on a dark surface. */
    white: {
        ink: base.color.paperInk,
        fill: base.color.paper,
        hover: "#e7e7e2",
        pressed: "#dcdcd6",
    },
    /** Everything else on a dark surface. */
    outline: {
        ink: base.color.ink,
        border: base.color.line.selected,
        hoverFill: base.color.line.soft,
        hoverBorder: base.color.white,
        pressedFill: base.color.line.default,
    },
    state: {
        focusRing: base.color.accent,
        focusWidth: base.focus.width,
        focusOffset: base.focus.offsetLoose,
        disabledOpacity: 0.45,
    },
} as const;
