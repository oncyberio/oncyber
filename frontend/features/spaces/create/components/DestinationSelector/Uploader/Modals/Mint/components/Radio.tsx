import { MouseEventHandler } from "react";
import styled from "styled-components";

interface RadioBoxProps {
    item: {
        value: any;
        title: string;
    };
    selected: boolean;
    onClick: MouseEventHandler<HTMLDivElement>;
}

export default function RadioBox({ item, selected, onClick }: RadioBoxProps) {
    return (
        <Container selected={selected} onClick={onClick}>
            <CircleWrapper selected={selected} />
            <span>{item.title}</span>
        </Container>
    );
}

RadioBox.defaultProps = {
    selected: false,
    item: {
        value: "",
        title: "hello",
    },
};

const Container = styled.div<{
    selected: boolean;
}>`
    display: flex;
    cursor: pointer;
    align-items: center;
    justify-content: flex-start;
    margin-right: 24px;

    @media (max-width: 800px) {
        align-items: flex-start;
    }

    span {
        font-weight: 500;
        font-size: 14px;
        line-height: 24px;
        color: var(--radio-ink, #070707);

        @media (max-width: 800px) {
            font-size: 12px;
            line-height: 100%;
        }
    }
`;

const CircleWrapper = styled.div<{
    selected: boolean;
}>`
    background: var(--radio-fill, #ffffff);
    border: 1px solid var(--radio-line, #c0c0c6);
    border-radius: 50%;
    width: 16px;
    height: 16px;
    min-width: 16px;
    min-height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 8px;

    ${({ selected }) => {
        if (selected) {
            return `
                border: 5px solid var(--radio-selected, #000000);
            `;
        }
    }}
`;
