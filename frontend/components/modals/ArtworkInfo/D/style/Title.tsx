import styled from "styled-components";

export const Title = styled.p`
    flex: 0;
    font-size: 24px;
    font-weight: 500;
    margin: 0 0 1rem 0;
    // white-space: nowrap;
    // text-overflow: ellipsis;
    // overflow-x: clip;
    width: 100%;
    padding-right: 100px;

    @media (max-width: 830px) {
        font-weight: 500;
        font-size: 24px;
        margin-bottom: 0px;
    }

    @media (max-width: 600px) {
        /* white-space: nowrap;
        text-overflow: ellipsis;
        overflow-x: clip; */
    }
`;
