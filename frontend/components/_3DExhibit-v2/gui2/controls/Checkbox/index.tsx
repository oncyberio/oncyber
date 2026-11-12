import React, { useState, useId } from "react";
import styled from "styled-components";

function _Checkbox({ value, onChange }: any) {
    //
    const id = useId();

    const handleChange = (e: any) => {
        //
        onChange(e.target.checked);
    };

    return (
        <Container>
            <input
                data-noundo={true}
                id={id}
                type="checkbox"
                className="switch-checkbox"
                checked={value}
                onChange={handleChange}
            />
            <label
                className="switch-label"
                htmlFor={id}
                style={{ background: value ? "#328DFD" : "#3D3F46" }}
            >
                <span className={`switch-button`} />
            </label>
        </Container>
    );
}

export const Checkbox = React.memo(_Checkbox);

const Container = styled.div`
    width: 100%;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: flex-end;

    .switch-checkbox {
        height: 0;
        width: 0;
        visibility: hidden;
    }

    .switch-label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        width: 32px;
        height: 16px;
        background: grey;
        position: relative;
        border-radius: 900px;
        transition: background-color 0.2s;
    }

    .switch-label .switch-button {
        content: "";
        position: absolute;
        top: 0px;
        left: 0px;
        width: 16px;
        height: 16px;
        border-radius: 900px;
        transition: 0.1s;
        background: #ffffff;
    }

    .switch-checkbox:checked + .switch-label .switch-button {
        left: calc(100%);
        transform: translateX(-100%);
    }

    .switch-label:active .switch-button {
        width: 32px;
    }
`;
