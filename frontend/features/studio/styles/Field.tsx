import styled, { css } from "styled-components";
import { studioTokens as studio } from "@styles/tokens";

export const Field = styled.div<{ inline?: boolean }>`
    display: flex;
    ${(props) =>
        !props.inline
            ? css`
                  flex-direction: column;
              `
            : css`
                  flex-direction: row;
                  align-items: center;
              `};
    gap: ${studio.space.fieldGap}px;
`;
