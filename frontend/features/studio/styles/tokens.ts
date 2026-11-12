import { studioTokens as studio } from "@styles/tokens";

/** Compatibility names for existing controls; new features use @styles/tokens. */
export const color = {
    white: `var(--studio-ink, ${studio.color.ink})`,
    black: `var(--studio-bg, ${studio.color.bg})`,
    textSecondary: `var(--studio-muted, ${studio.color.muted})`,
    bgField: `var(--studio-surface, ${studio.color.surface})`,
    bgHover: `var(--studio-hover, ${studio.color.hover})`,
    border: `var(--studio-line, ${studio.color.line})`,
    borderMuted: `var(--studio-line, ${studio.color.line})`,
    textOnPrimary: `var(--studio-bg, ${studio.color.bg})`,
    disabled: `var(--studio-muted, ${studio.color.muted})`,
    ...studio.legacy,
};
export const radius = {
    field: `${studio.radius.compact}px`,
    circle: studio.radius.circle,
    trackPill: `${studio.radius.track}px`,
    buttonPill: `${studio.radius.compact}px`,
};
export const fontSize = {
    sm: `${studio.font.size.sm}px`,
    md: `${studio.font.size.md}px`,
};
