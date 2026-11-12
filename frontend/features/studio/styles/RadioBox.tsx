import { MouseEventHandler } from "react";
import styled from "styled-components";
import { Label } from "./Label";
import { color, radius } from "./tokens";

interface RadioBoxProps {
    item: {
        value: any;
        title?: string;
    };
    hideLabel?: boolean;
    selected: boolean;
    selectedColor?: string;
    onClick?: MouseEventHandler<HTMLDivElement>;
}

export default function RadioBox({
    item,
    hideLabel = false,
    selected,
    onClick = null,
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
            {!hideLabel && <Label>{item?.title}</Label>}
        </Container>
    );
}

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
                    color: ${color.white};
                }
            `;
        }
    }}
`;

const CircleWrapper = styled.div<{
    selected: boolean;
}>`
    border: 2px solid ${color.textSecondary};
    border-radius: ${radius.circle};
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
                border: 2px solid ${color.white};
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
    border-radius: ${radius.circle};

    ${({ selected, selectedColor }) => {
        if (selected) {
            return `
                background: ${selectedColor || color.white};
            `;
        }
    }}
`;
