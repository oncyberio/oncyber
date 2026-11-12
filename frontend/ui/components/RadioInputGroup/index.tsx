import { noop } from "@utils/js";
import { CSSProperties, MouseEventHandler } from "react";
import styled from "styled-components";
import RadioBox from "../RadioBox";

interface RadioBoxProps {
    style?: CSSProperties;
    item: {
        title?: string;
        description: string;
    };
    selected: boolean;
    clickableLabel?: boolean;
    onClick: MouseEventHandler<HTMLDivElement>;
}

export default function RadioInputGroup({
    style = {},
    item,
    selected,
    onClick,
    clickableLabel,
}: RadioBoxProps) {
    const { title, description } = item;

    return (
        <Container style={style}>
            {title && <h1>{title}</h1>}
            <Wrapper className="radio-wrapper">
                <span
                    className="radio-wrapper-span"
                    style={clickableLabel ? { cursor: "pointer" } : {}}
                    onClick={clickableLabel ? onClick : noop}
                >
                    {description}
                </span>
                <CircleWrapper
                    className="radio-circle-wrapper"
                    selected={selected}
                    onClick={onClick}
                >
                    <RadioBoxCircle
                        selected={selected}
                        className="box-radio-circle"
                    />
                </CircleWrapper>
            </Wrapper>
        </Container>
    );
}

RadioInputGroup.defaultProps = {
    selected: false,
    item: {
        value: "",
        title: "hello",
        description: "this is description",
    },
};

const CircleWrapper = styled.div<{
    selected: boolean;
}>`
    border: 1px solid #7a7a7a;
    border-radius: 50%;
    width: 14px;
    height: 14px;
    padding: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 8px;

    ${({ selected }) => {
        if (selected) {
            return `
                border: 1px solid #ffffff;
            `;
        }
    }}
`;

const Wrapper = styled.div`
    width: 100%;
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;

    & > span {
        font-size: 12px;
        width: 90%;
        line-height: 16px;
        color: #ffffff;
        opacity: 0.5;
        font-weight: 400;
    }
`;

const Container = styled.div`
    display: flex;
    width: 100%;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;

    & > h1 {
        font-weight: 500;
        font-size: 14px;
        line-height: 24px;
        display: flex;
        margin: 0px;
        color: #ffffff;
    }
`;

const RadioBoxCircle = styled.div<{
    selected: boolean;
}>`
    width: 6px;
    height: 6px;
    min-width: 6px;
    min-height: 6px;
    border-radius: 50%;

    ${({ selected }) => {
        if (selected) {
            return `
                background: #FFFFFF;
            `;
        }
    }}
`;
