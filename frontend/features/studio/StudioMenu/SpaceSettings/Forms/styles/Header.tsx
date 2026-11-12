import styled from "styled-components";
import { studioHeading } from "@features/studio/styles/primitives";

export const Header = styled.h2`
    ${studioHeading}
    margin: 12px 0 16px 0;
    color: var(--text-color);
`;

export const HeaderInfo = styled.div`
    font-weight: 400;
    font-size: 13px;
    line-height: 20px;
    color: var(--studio-muted, #a1a1a8);
    max-width: 450px;
    text-align: left;
`;
