import { clamp } from "@utils/js";
import React from "react";
import styled from "styled-components";

function _TextInput({ required = false, value = 0, onChange }: any) {
    //

    // const [value, setValue] = React.useState(_value);

    const valueRef = React.useRef(value);

    const startValueRef = React.useRef(value);

    const handleFinishChange = (e) => {
        //
        if (required && !valueRef.current) {
            //
            return;
        }

        startValueRef.current = valueRef.current;

        onChange(valueRef.current, false);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        //
        const value = e.target.value;

        valueRef.current = value;

        // setValue(value);

        onChange(value, true);
    };

    return (
        <Container>
            <input
                data-noundo={true}
                className="input"
                type="text"
                required={required}
                onChange={handleChange}
                onBlur={handleFinishChange}
                onKeyDown={(e) => {
                    //
                    if (e.key === "Enter") {
                        //
                        handleFinishChange(e);
                    } else if (e.key === "Escape") {
                        //
                        e.preventDefault();

                        valueRef.current = startValueRef.current;

                        onChange(valueRef.current, false);

                        //
                    }
                }}
                value={value}
            />
        </Container>
    );
}

export const TextInput = React.memo(_TextInput);

const Container = styled.div`
    width: 100%;
    height: 30px;
    display: flex;
    align-items: center;

    & > .input {
        width: 100%;
        height: 24px;
        background: #3d3f46;
        border-radius: 6px;
        outline: none;
        border: none;
        margin-left: 4px;
        font-weight: 500;
        font-size: 12px;
        line-height: 24px;
        padding: 6px 8px;
        color: #ffffff;

        &.required:invalid {
            border: 1px solid red;
        }
    }
`;
