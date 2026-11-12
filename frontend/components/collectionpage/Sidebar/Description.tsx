import styled from "styled-components";
import Markdown from "markdown-to-jsx";

export default function Description({ text }) {
    if (!text) return null;

    return (
        <Container>
            <Markdown>{text}</Markdown>
        </Container>
    );
}

const Container = styled.div`
    color: rgba(0, 0, 0, 0.6);
    line-height: 1.5;

    a {
        font-weight: 500;
        text-decoration: underline;
    }
`;
