import { MouseEventHandler } from "react";
import styled from "styled-components";

interface RadioBoxProps {
    item: {
        value: any;
        title?: string;
    };
    selected: boolean;
    selectedColor?: string;
    onClick: MouseEventHandler<HTMLDivElement>;
}

export default function RadioBox({
    item,
    selected,
    onClick,
    selectedColor,
}: RadioBoxProps) {
    return (
        <Container selected={selected} onClick={onClick}>
            <CircleWrapper selected={selected}>
                <RadioBoxCircle
                    selected={selected}
                    selectedColor={selectedColor}
                />
            </CircleWrapper>
            <span>{item?.title}</span>
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

    span {
        font-style: normal;
        font-weight: 500;
        font-size: 15px;
    }

    ${({ selected }) => {
        if (selected) {
            return `
                span {
                    color: #000000;
                }
            `;
        } else {
            return `
                span {
                    color: #99999F;
                }
            `;
        }
    }}
`;

const CircleWrapper = styled.div<{
    selected: boolean;
}>`
    background: #ffffff;
    border: 1px solid #c0c0c6;
    border-radius: 50%;
    width: 12px;
    height: 12px;
    min-width: 16px;
    min-height: 16px;
    padding: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 8px;

    ${({ selected }) => {
        if (selected) {
            return `
                border: 1px solid #000000;
            `;
        }
    }}
`;

const RadioBoxCircle = styled.div<{
    selected: boolean;
    selectedColor?: string;
}>`
    width: 12px;
    height: 12px;
    min-width: 12px;
    min-height: 12px;
    border-radius: 50%;

    ${({ selected, selectedColor }) => {
        if (selected) {
            return `
                background: ${selectedColor || "#00ccaa"};
            `;
        }
    }}
`;
