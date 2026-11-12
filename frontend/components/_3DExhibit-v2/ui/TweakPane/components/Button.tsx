import { noop } from "@utils/js";
import React from "react";
import styled from "styled-components";

export default function Button({ label, target, propName }) {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
        e.preventDefault();
        const fn = target[propName];
        if (typeof fn === "function") {
            target[propName].call(target);
        }
    };

    return (
        <Container>
            <button type="button" onClick={handleClick}>
                {label}
            </button>
        </Container>
    );
}

Button.defaultProps = {
    items: [],
    target: {
        default: false,
    },
    onChange: noop,
    onUpdate: noop,
    inputRef: noop,
    propName: "default",
};

const Container = styled.div`
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;

    & > button {
        display: flex;
        width: 100%;
        height: 24px;
        border: none;
        outline: none;
        cursor: pointer;
        font-size: 12px;
        color: #ffffff;
        font-weight: 500;
        line-height: 24px;
        border-radius: 6px;
        align-items: center;
        background: #3d3f46;
        justify-content: center;
        text-transform: capitalize;
        white-space: nowrap;
    }
`;
