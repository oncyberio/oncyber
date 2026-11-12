import { createGlobalStyle } from "styled-components";
import { studioTokens as studio } from "@styles/tokens";
import { studioFontFaces, studioVariables } from "./foundation";
import {
    StyledWrapper as InputWrapper,
    StypedInput as InputControl,
} from "@ui/components/Input/styles";

// Mounted with the studio so portalled menus share the same visual system.
export const StudioTheme = createGlobalStyle`
    ${studioFontFaces}
    :root:root {
        ${studioVariables}
    }

    body {
        font: ${studio.font.body} var(--studio-font);
        letter-spacing: 0;
        font-kerning: normal;
        font-variant-ligatures: common-ligatures;
        font-synthesis: none;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        background: var(--studio-bg);
    }
    :where(button, input, textarea, select) {
        font: inherit;
        letter-spacing: inherit;
    }
    [data-studio-surface] {
        color: var(--studio-ink);
        font: var(--studio-font-body);
    }
    [data-studio-surface] ${InputWrapper} {
        border-radius: var(--studio-radius-control);
        background: var(--studio-inset);
        &:focus-within {
            outline: 1px solid var(--studio-muted);
            outline-offset: 0;
        }
    }
    [data-studio-surface] ${InputControl} {
        font-family: var(--studio-font);
        font-size: ${studio.font.size.md}px;
        background: var(--studio-inset);
        border-radius: inherit;
        &::placeholder {
            color: var(--studio-muted);
        }
    }
`;
