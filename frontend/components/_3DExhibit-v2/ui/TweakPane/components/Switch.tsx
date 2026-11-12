import { noop } from "@utils/js";
import React, { useState, useId } from "react";
import styled from "styled-components";

export default function Switch({
    target,
    propName,
    onUpdate,
    onChange,
    inputRef,
}) {
    const value = target[propName];

    const id = useId();

    const [checked, setChecked] = useState(value);

    const _onUpdateValue = (val: boolean): void => {
        target[propName] = val;

        onUpdate(val);
        onChange(val);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        setChecked(!checked);
        _onUpdateValue(!checked);
    };

    return (
        <Container>
            <input
                ref={inputRef}
                checked={checked}
                type="checkbox"
                className="switch-checkbox"
                id={id}
                onChange={handleChange}
            />
            <label
                className="switch-label"
                htmlFor={id}
                style={{ background: checked ? "#328DFD" : "#3D3F46" }}
            >
                <span className={`switch-button`} />
            </label>
        </Container>
    );
}

Switch.defaultProps = {
    target: {
        default: () => {},
    },
    propName: "default",
    onUpdate: noop,
    onChange: noop,
};

const Container = styled.div`
    width: 100%;
    height: 100%;
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
