import { css } from "styled-components";
import { baseTokens as base, studioTokens as studio } from "@styles/tokens";

export const studioFontFaces = css`
    /* Keep studio weights independent of the legacy Aeonik/local font mappings. */
    @font-face {
        font-family: "Studio Aeonik";
        src: url("${base.font.files.regular}") format("opentype");
        font-weight: 400;
        font-style: normal;
        font-display: swap;
    }
    @font-face {
        font-family: "Studio Aeonik";
        src: url("${base.font.files.medium}") format("opentype");
        font-weight: 500;
        font-style: normal;
        font-display: swap;
    }
    @font-face {
        font-family: "Studio Aeonik";
        src: url("${base.font.files.bold}") format("opentype");
        font-weight: 700;
        font-style: normal;
        font-display: swap;
    }
    @font-face {
        font-family: "Studio Aeonik";
        src: url("${base.font.files.regularItalic}") format("opentype");
        font-weight: 400;
        font-style: italic;
        font-display: swap;
    }
    @font-face {
        font-family: "Studio Aeonik";
        src: url("${base.font.files.mediumItalic}") format("opentype");
        font-weight: 500;
        font-style: italic;
        font-display: swap;
    }
    @font-face {
        font-family: "Studio Aeonik";
        src: url("${base.font.files.boldItalic}") format("opentype");
        font-weight: 700;
        font-style: italic;
        font-display: swap;
    }
    @font-face {
        font-family: "Studio Space Mono";
        src: url("${base.font.files.mono}") format("woff2");
        font-weight: 400;
        font-style: normal;
        font-display: swap;
    }
`;

/** Shared by StudioTheme and scoped surfaces, including the token reference. */
export const studioVariables = css`
    --studio-bg: ${studio.color.bg};
    --studio-panel: ${studio.color.panel};
    --studio-card: ${studio.color.card};
    --studio-inset: ${studio.color.inset};
    --studio-surface: ${studio.color.surface};
    --studio-hover: ${studio.color.hover};
    --studio-selected: ${studio.color.selected};
    --studio-ink: ${studio.color.ink};
    --studio-secondary: ${studio.color.secondary};
    --studio-muted: ${studio.color.muted};
    --studio-tooltip-size: ${studio.font.tooltipSize}px;
    --studio-line: ${studio.color.line};
    --studio-line-strong: ${studio.color.lineStrong};
    --studio-radius-panel: ${studio.radius.panel}px;
    --studio-radius-control: ${studio.radius.control}px;
    --studio-radius-card: ${studio.radius.card}px;
    --studio-radius-preview: ${studio.radius.preview}px;
    --studio-panel-padding: ${studio.space.panelPadding}px;
    --studio-grid-gap: ${studio.space.gridGap}px;
    --studio-edge: ${studio.shadow.edge};
    --studio-font: ${studio.font.sans};
    --studio-mono: ${studio.font.mono};
    --panel-bg: var(--studio-panel);
    --panel-bg-hover: var(--studio-hover);
    --panel-border: 1px solid var(--studio-line);
    --panel-shadow: var(--studio-edge), ${studio.shadow.panel};
    --panel-text-primary: var(--studio-ink);
    --panel-text-secondary: var(--studio-secondary);
    --panel-text-muted: var(--studio-muted);
    --panel-accent: var(--studio-ink);
    --world-builder-bg: var(--studio-bg);
    --radius-panel: var(--studio-radius-panel);
    --radius-panel-sm: var(--studio-radius-control);
    --radius-pill: var(--studio-radius-control);
    --glass-bg: var(--studio-surface);
    --glass-bg-hover: var(--studio-hover);
    --glass-border: 1px solid var(--studio-line-strong);
    --glass-border-subtle: 1px solid var(--studio-line);
    --glass-blur: none;
    --glass-blur-sm: none;
    --glass-shadow: none;
    --studio-accent: ${studio.color.accent};
    --studio-font-body: ${studio.font.body} var(--studio-font);
    --studio-font-action: ${studio.font.action} var(--studio-font);
    --studio-font-heading: ${studio.font.heading} var(--studio-font);
    --studio-font-label: ${studio.font.label} var(--studio-font);
    --studio-font-numeric: ${studio.font.numeric} var(--studio-mono);
    --studio-control-motion: ${studio.motion.control}ms;
    --studio-control-ease: ${studio.motion.ease};
`;

/** Apply to a Studio surface outside the full editor; does not restyle the page. */
export const studioFoundation = css`
    ${studioFontFaces}
    ${studioVariables}
    color: var(--studio-ink);
    font: var(--studio-font-body);
    letter-spacing: 0;
    font-kerning: normal;
    font-variant-ligatures: common-ligatures;
    font-synthesis: none;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
`;
