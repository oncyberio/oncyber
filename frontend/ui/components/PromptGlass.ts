import { css } from "styled-components";
import { baseTokens as base, lobbyTokens } from "@styles/tokens";

const glass = lobbyTokens.glass;

/** Bounded floating surfaces: a flat dark tint, one blur and a single hairline. */
export const promptGlass = css`
    color: ${base.color.white};
    background: ${glass.fallback};
    box-shadow: inset 0 0 0 1px ${base.color.line.default}, ${glass.shadow};
    text-shadow: ${glass.textShadow};

    @supports (
        (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))
    ) {
        background: ${glass.tint};
        -webkit-backdrop-filter: blur(
            var(--prompt-glass-blur, ${glass.blur}px)
        );
        backdrop-filter: blur(var(--prompt-glass-blur, ${glass.blur}px));
    }
    /* Content stacking that panels already rely on. */
    & > * {
        position: relative;
        z-index: 1;
    }

    @media (prefers-reduced-transparency: reduce) {
        background: ${glass.fallback};
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
        &::before,
        &::after {
            display: none;
        }
    }
    @media (forced-colors: active) {
        background: Canvas;
        color: CanvasText;
        outline: 1px solid CanvasText;
        box-shadow: none;
        text-shadow: none;
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
        &::before,
        &::after {
            display: none;
        }
    }
`;
