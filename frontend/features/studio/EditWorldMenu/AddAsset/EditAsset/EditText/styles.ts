import styled from "styled-components";
import { studioField } from "@features/studio/styles/primitives";

export const TextSelect = styled.select`
    ${studioField}
    width: 100%;
    height: 38px;
    min-height: 38px;
    padding: 6px 10px;
    font-size: 12px;
    color-scheme: dark;
    cursor: pointer;

    @media (max-width: 600px) {
        height: 44px;
    }
`;
