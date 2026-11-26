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
    /** Chat floats over the world without a panel behind it. */
    chat: {
        /** Desktop width of the chat column, in the lobby and in spaces. */
        width: 280,
        /** Soft lift for lines over the world; not an outline. */
        textShadow: "0 1px 2px #00000073",
        /** Faint dark wash behind the lines above the input. */
        scrim: "linear-gradient(to top, #00000047, #00000024 55%, transparent)",
        /** Fades the wash out at its sides so it has no edge. */
        scrimMask:
            "linear-gradient(to right, transparent, #000 16%, #000 84%, transparent)",
    },
    /** Chat lines shown above the speaker's head in the 3D scene. Stronger
     * than the chat list's shadow: these sit over bright avatars and sky. */
    speech: {
        textShadow: "0 1px 2px #000000d9, 0 0 10px #000000a6",
        backdrop:
            "radial-gradient(closest-side, #000000b3, #00000073 55%, transparent)",
        ink: "#f4f5f8",
        photoShadow: "0 1px 4px #000000a6",
    },
    /**
     * Name tags over avatars, in the lobby and in spaces: browser text in a
     * small glass chip with the visitor's picture, like the menu rows.
     * Sizes are in ems of the tag's font size, which follows distance.
     */
    nameTag: {
        ink: base.color.ink,
        fill: "#14161bb8",
        border: base.color.line.soft,
        /** The pill's 1.5 px rim as the DOM draws it (speech bubbles). */
        rim: "#ffffff4d",
        shadow: "0 1px 6px #00000052",
        photoFill: "#2a2d35",
        /** Text height in world metres, before the screen clamp below. */
        fontMetres: 0.081,
        minPx: 11,
        maxPx: 17,
        photoEm: 1.55,
        gapEm: 0.42,
        /** Longest name before it ends in an ellipsis. */
        maxNameEm: 11,
    },
    control: {
        size: 40,
        touchSize: 36,
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
        /** The worlds and avatars search bars share one width. */
        searchWidth: 480,
        /** The chat scrim's tones as a pool behind unboxed labels. */
        labelWash:
            "radial-gradient(closest-side, #00000047, #00000024 55%, transparent)",
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
