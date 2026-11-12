import React from "react";
import styled from "styled-components";

export default function ({ title, children }) {
    return (
        <SectionContainer>
            <h3>{title}</h3>
            {children}
        </SectionContainer>
    );
}

const SectionContainer = styled.section`
    width: 100%;
    margin-bottom: 24px;
    > h3 {
        margin: 0 0 10px;
        color: var(--oc-secondary, #c2c2bd);
        font-weight: 500;
        font-size: 12px;
        line-height: 20px;
    }
`;

export const InnerSection = styled.div`
    width: 100%;
    display: flex;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    margin-bottom: 24px;

    & > span {
        font-weight: 400;
        font-size: 12px;
        line-height: 24px;
        color: #ffffff;
        opacity: 0.5;
    }
`;
