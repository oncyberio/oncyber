import { useState } from "react";
import styled, { css } from "styled-components";

export default function CuratorNotes({ text }) {
    const [fullText, setFullText] = useState(false);

    return (
        <Container fullText={fullText}>
            <p className="scrollbar light">{text}</p>
            {text.length >= 313 && !fullText ? (
                <span onClick={() => setFullText(true)}>Read more.</span>
            ) : null}
        </Container>
    );
}

const Container = styled.div<{
    fullText: boolean;
}>`
    height: 100%;

    p {
        margin: 0;
        display: inline-block;
        overflow-y: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 5;
        line-clamp: 5;
        -webkit-box-orient: vertical;
        margin-bottom: 0;
        font-size: 16px;
        color: #c2c2c2;

        ${(props) =>
            props.fullText &&
            css`
                -webkit-line-clamp: initial;
                line-clamp: initial;
                overflow-y: auto;
                height: 100%;
            `}
    }

    span {
        cursor: pointer;
    }
`;
