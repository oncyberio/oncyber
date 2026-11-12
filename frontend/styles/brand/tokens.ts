/** Oncyber UI foundations. See docs/brand/README.md for usage and provenance. */
import { baseTokens as base } from "@styles/tokens/base";
import { landingTokens as landing } from "@styles/tokens/landing";

/** Landing-flavoured view over the shared base; kept for existing imports. */
export const brandTokens = {
    color: {
        ...landing.color,
        accent: base.color.accent,
        createAccent: base.color.accentCreate,
        actionBlue: base.color.accent,
        actionBlueStart: base.color.accentStart,
        actionBlueEnd: base.color.accentEnd,
        selectionStart: base.color.selectionStart,
        selectionEnd: base.color.selectionEnd,
    },
    radius: landing.radius,
    motion: {
        fast: base.motion.fast,
        standard: base.motion.standard,
        enter: base.motion.enter,
    },
} as const;
