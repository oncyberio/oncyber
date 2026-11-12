import { baseTokens as base } from "./base";

/**
 * Studio editor: dense, flat, neutral greys; no glass.
 * Numeric dimensions are CSS pixels, durations are milliseconds.
 * Use StudioTheme on editor routes, or studioFoundation on a scoped surface.
 * See docs/brand/tokens.md#building-studio-features and /dev/tokens#studio.
 */
export const studioTokens = {
    font: {
        sans: '"Studio Aeonik", "Helvetica Neue", Arial, sans-serif',
        mono: '"Studio Space Mono", "SFMono-Regular", monospace',
        body: `${base.font.weight.regular} ${base.font.size.md}px/20px`,
        tooltipSize: base.font.size.sm,
        size: { sm: base.font.size.sm, md: base.font.size.md },
        action: `${base.font.weight.medium} ${base.font.size.md}px/20px`,
        heading: `${base.font.weight.medium} 16px/22px`,
        label: `${base.font.weight.regular} ${base.font.size.sm}px/24px`,
        numeric: `${base.font.weight.regular} ${base.font.size.xs}px/18px`,
    },
    color: {
        bg: "#111111",
        panel: "#181818",
        card: "#1c1c1c",
        inset: "#101010",
        surface: "#222222",
        hover: "#2a2a2a",
        selected: "#303030",
        ink: "#f1f1f1",
        secondary: "#c6c6c6",
        muted: "#a0a0a0",
        line: "#2c2c2c",
        lineStrong: "#484848",
        accent: base.color.accent,
    },
    radius: {
        panel: 18,
        control: 10,
        card: 12,
        preview: base.radius.inset,
        compact: base.radius.inset,
        circle: "50%",
        track: 100,
    },
    space: { panelPadding: 14, gridGap: 8, fieldGap: 8, sectionGap: 12 },
    field: { minHeight: 40, paddingX: 12, paddingY: 9, disabledOpacity: 0.45 },
    action: {
        minHeight: 38,
        paddingX: 14,
        paddingY: 8,
        gap: 8,
        disabledOpacity: 0.4,
    },
    tab: { minHeight: 44 },
    menuItem: { paddingX: 12, paddingY: 8 },
    layout: { inspectorWidth: 340, closeSize: 32, touchTarget: 44 },
    breakpoint: { compact: 600 },
    focus: { width: base.focus.width, offset: base.focus.offsetLoose },
    // Keep the editor's existing quick control feedback independent of travel motion.
    motion: { control: 150, ease: "ease" },
    shadow: {
        edge: "inset 0 1px 0 #ffffff04",
        panel: "0 12px 32px #00000026",
    },
    // Compatibility-only slider colors; new controls should use semantic colors above.
    legacy: {
        disabledTrack: "#484646",
        trackLight: "#3d3f46",
        trackLightBg: "#dfdfe4",
    },
} as const;

export type StudioTokens = typeof studioTokens;
