import { baseTokens as base } from "./base";

/**
 * Lobby UI that floats over the 3D scene: glass panels, the experience dock,
 * curved card pickers and chat. Cooler greys than the landing so text stays
 * readable over moving world backgrounds.
 */
export const lobbyTokens = {
    color: {
        ink: base.color.ink,
        secondary: base.color.secondary,
        controlInk: "#e8e9ec",
        tooltipInk: "#c2c5cc",
        chatInk: "#e4e7ee",
        noticeInk: "#ced3dc",
        noticeStrong: "#f0f1f5",
        noticeAction: "#e9edf5",
        noticeMuted: "#a4adbb",
        meta: "#969daa",
        metaSoft: "#9ba4b2",
    },
    glass: {
        fallback: "#16191f",
        tint: "rgba(10, 13, 18, 0.66)",
        sheen: "linear-gradient(135deg, #ffffff0e, #ffffff02 38%, transparent 62%, #bddbff08)",
        blur: 8,
        panelBlur: 4,
        shadow: "0 6px 18px #00000030",
        textShadow: "0 1px 2px #00000080",
    },
    control: {
        size: 40,
        touchSize: 44,
        radius: base.radius.control,
        background: "#14161bcc",
        hover: "#22252de6",
        pressed: "#292d36",
        dockPressed: "#2b2f38e6",
        border: base.color.line.soft,
        hoverBorder: "#ffffff2b",
        pressedBorder: "#ffffff38",
        dockPressedBorder: "#ffffff45",
        tooltip: "#14161bf2",
        chip: "#16191fcc",
        notice: "#15181eed",
    },
    panel: {
        width: 656,
        compactWidth: 368,
        gap: 8,
        perspective: 1000,
        dockHeight: 40,
        radius: base.radius.card,
        cardRadius: base.radius.control,
        iconRadius: 10,
        border: base.color.line.strong,
        cardHover: base.color.line.hover,
        cardSelected: base.color.line.selected,
    },
    /** Convex cylinder used by the dock's card pickers (degrees). */
    curve: { edgeAngle: 7, maxAngle: 10, viewportInset: 48 },
    /**
     * UI in 3D: type drawn inside the lobby scene. Sizes are world metres,
     * tracking is in em. Used by the travel backdrop behind the avatar.
     */
    world: {
        ink: base.color.ink,
        secondary: base.color.secondary,
        /** Destination name, standing behind the avatar. */
        title: {
            capHeight: 0.5,
            tracking: -0.015,
            maxGlyphs: 48,
            opacity: 0.94,
        },
        /** Loading stage above the name, in mono caps. */
        status: { capHeight: 0.065, tracking: 0.24, gap: 0.17, opacity: 0.72 },
        /** Distance behind the avatar, cap-centre height, and phone fit. */
        backdrop: { distance: 2.6, height: 0.7, maxWidthRatio: 0.86 },
    },
} as const;
