import { css } from "styled-components";
import { studioTokens as studio } from "@styles/tokens";

export const studioFocus = css`
    &:focus-visible {
        outline: ${studio.focus.width}px solid
            var(--studio-ink, ${studio.color.ink});
        outline-offset: ${studio.focus.offset}px;
    }
`;

export const studioField = css`
    min-width: 0;
    min-height: ${studio.field.minHeight}px;
    padding: ${studio.field.paddingY}px ${studio.field.paddingX}px;
    border: 1px solid var(--studio-line, ${studio.color.line});
    border-radius: var(--studio-radius-control, ${studio.radius.control}px);
    background: var(--studio-inset, ${studio.color.inset});
    color: var(--studio-ink, ${studio.color.ink});
    font: ${studio.font.body} var(--studio-font, ${studio.font.sans});
    letter-spacing: 0;
    outline: none;
    transition: border-color
        var(--studio-control-motion, ${studio.motion.control}ms)
        var(--studio-control-ease, ${studio.motion.ease});
    &::placeholder {
        color: var(--studio-muted, ${studio.color.muted});
    }
    &:focus {
        border-color: var(--studio-muted, ${studio.color.muted});
    }
    &:disabled {
        opacity: ${studio.field.disabledOpacity};
        cursor: not-allowed;
    }
`;

export const studioAction = css`
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: ${studio.action.gap}px;
    min-height: ${studio.action.minHeight}px;
    padding: ${studio.action.paddingY}px ${studio.action.paddingX}px;
    border: 1px solid transparent;
    border-radius: var(--studio-radius-control, ${studio.radius.control}px);
    color: var(--studio-ink, ${studio.color.ink});
    background: transparent;
    font: ${studio.font.action} var(--studio-font, ${studio.font.sans});
    letter-spacing: 0;
    text-decoration: none;
    cursor: pointer;
    transition: background-color
            var(--studio-control-motion, ${studio.motion.control}ms)
            var(--studio-control-ease, ${studio.motion.ease}),
        color var(--studio-control-motion, ${studio.motion.control}ms)
            var(--studio-control-ease, ${studio.motion.ease});
    &:hover:not(:disabled) {
        background: var(--studio-hover, ${studio.color.hover});
    }
    &:disabled {
        opacity: ${studio.action.disabledOpacity};
        cursor: not-allowed;
    }
    ${studioFocus}
`;

export const studioPanel = css`
    border: 1px solid var(--studio-line, ${studio.color.line});
    border-radius: var(--studio-radius-panel, ${studio.radius.panel}px);
    background: var(--studio-panel, ${studio.color.panel});
    color: var(--studio-ink, ${studio.color.ink});
    font-family: var(--studio-font, ${studio.font.sans});
    box-shadow: var(--panel-shadow, ${studio.shadow.panel});
`;

export const studioHeading = css`
    margin: 0;
    font: ${studio.font.heading} var(--studio-font, ${studio.font.sans});
    letter-spacing: 0;
`;

export const studioTab = css`
    ${studioAction}
    min-height: ${studio.tab.minHeight}px;
    padding: 0;
    border: 0;
    border-bottom: 1px solid transparent;
    border-radius: 0;
    margin-bottom: -1px;
    color: var(--studio-muted, ${studio.color.muted});
    &:hover:not(:disabled) {
        background: transparent;
        color: var(--studio-ink);
    }
    &[aria-pressed="true"],
    &[aria-selected="true"] {
        color: var(--studio-ink, ${studio.color.ink});
        border-bottom-color: currentColor;
    }
`;

export const studioMenuItem = css`
    ${studioAction}
    justify-content: flex-start;
    width: 100%;
    padding: ${studio.menuItem.paddingY}px ${studio.menuItem.paddingX}px;
    text-align: left;
    font-weight: 400;
`;
