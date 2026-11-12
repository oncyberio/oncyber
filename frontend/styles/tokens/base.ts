/**
 * Shared base for every Oncyber surface. Landing, lobby and studio each build
 * their own set on top of these values. See docs/brand/tokens.md.
 */
export const baseTokens = {
    font: {
        sans: '"Oncyber Sans", "SpaceGrotesk", "SpaceGrotesk Fallback", "Helvetica Neue", Arial, sans-serif',
        mono: '"Oncyber Mono", "SpaceMono Fallback", "SFMono-Regular", monospace',
        /**
         * Same files, served under each surface's own family name. Aeonik is
         * licensed and not in the repo (see docs/fonts.md); without it the
         * stacks fall back to Space Grotesk.
         */
        files: {
            regular: "/fonts/licensed/Aeonik-Regular.otf",
            medium: "/fonts/licensed/Aeonik-Medium.otf",
            bold: "/fonts/licensed/Aeonik-Bold.otf",
            regularItalic: "/fonts/licensed/Aeonik-RegularItalic.otf",
            mediumItalic: "/fonts/licensed/Aeonik-MediumItalic.otf",
            boldItalic: "/fonts/licensed/Aeonik-BoldItalic.otf",
            mono: "/fonts/SpaceMono/SpaceMono-Regular.woff2",
        },
        size: { micro: 10, xs: 11, sm: 12, md: 13, body: 14 },
        weight: { regular: 400, medium: 500, bold: 700 },
    },
    color: {
        white: "#fff",
        black: "#000",
        ink: "#f3f3f1",
        secondary: "#c2c2bd",
        muted: "#93938e",
        /** Light surface and its ink: paper cards and solid white actions. */
        paper: "#fafaf8",
        paperInk: "#20201e",
        accent: "#2567ff",
        accentStart: "#3975ff",
        accentEnd: "#1854e8",
        accentGlow: "#2567ff26",
        /** Create accent; with the lobby green and action blue it reads as RGB. */
        accentCreate: "#ff4b4b",
        selectionStart: "#38efce",
        selectionEnd: "#ceef00",
        /** White hairlines on dark surfaces, by strength. */
        line: {
            faint: "#ffffff0a",
            subtle: "#ffffff12",
            soft: "#ffffff18",
            default: "#ffffff24",
            strong: "#ffffff2e",
            hover: "#ffffff66",
            selected: "#ffffff99",
        },
    },
    radius: { inset: 8, control: 12, card: 16, panel: 24 },
    motion: {
        fast: 120,
        standard: 180,
        enter: 220,
        ease: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    },
    focus: { width: 2, offset: 2, offsetLoose: 3 },
    breakpoint: { phone: 550, compact: 700 },
} as const;

export type BaseTokens = typeof baseTokens;
