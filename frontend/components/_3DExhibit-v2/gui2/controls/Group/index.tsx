import React from "react";
import styled from "styled-components";

export function Group({ children, style = {} }: any) {
    //

    return <Container style={style}>{children}</Container>;
}

const Container = styled.div`
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    user-select: none;
`;
