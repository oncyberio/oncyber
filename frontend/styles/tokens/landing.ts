import { actionTokens as action } from "./action";
import { baseTokens as base } from "./base";

/** 2D landing page (`/`, `/landing-carousel`): quiet canvas, paper cards, blue actions. */
export const landingTokens = {
    color: {
        canvas: "#101010",
        panel: "#191919",
        surface: "#242424",
        hover: "#2c2c2c",
        ink: base.color.ink,
        secondary: base.color.secondary,
        muted: base.color.muted,
        line: base.color.line.subtle,
        lineStrong: base.color.line.default,
        paper: base.color.paper,
        paperInk: base.color.paperInk,
        paperMuted: "#6b6b65",
    },
    radius: {
        card: base.radius.panel,
        compactCard: base.radius.card,
        control: base.radius.control,
        inset: base.radius.inset,
    },
    shadow: {
        card: "0 12px 32px #00000026, 0 2px 6px #00000014",
        action: `inset 0 1px 0 #ffffff33, 0 2px 8px ${base.color.accentGlow}`,
    },
    /** The app-wide action spec (`actionTokens`), kept for existing imports. */
    action: {
        minHeight: action.size.minHeight,
        paddingY: action.size.paddingY,
        paddingX: action.size.paddingX,
        gap: action.size.gap,
        compactGap: action.size.compactGap,
        font: action.type.font,
    },
} as const;
