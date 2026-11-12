import styled from "styled-components";
import { studioTokens as studio } from "@styles/tokens";

export const Label = styled.div`
    font: ${studio.font.label} var(--studio-font, ${studio.font.sans});
    color: var(--studio-muted, ${studio.color.muted});
`;
