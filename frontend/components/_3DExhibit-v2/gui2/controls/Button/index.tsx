import IconImg from "@ui/components/IconImg";
import React from "react";
import styled from "styled-components";

function _Button({ label, icon, onAction, disabled }: any) {
    //
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
        //
        e.preventDefault();

        onAction();
    };

    return (
        <Container>
            <button disabled={disabled} type="button" onClick={handleClick}>
                {icon && <IconImg name={icon} size={14} style={{  filter: "invert(1)", marginBottom: 4}}  />}
                {label ? label : null}
            </button>
        </Container>
    );
}

export const Button = React.memo(_Button);

const Container = styled.div`
    flex: 1;
    width: 100%;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;

    & > button {
        display: flex;
        gap: 1em;

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

        &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
    }
`;
