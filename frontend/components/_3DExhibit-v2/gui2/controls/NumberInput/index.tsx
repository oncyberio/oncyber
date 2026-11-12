import { clamp } from "@utils/js";
import React from "react";
import styled from "styled-components";

const progressWidth = (value, min, max) => {
    return clamp(((value - min) * 100) / (max - min), 0, 100);
};

function _NumberInput({
    min = 0,
    max = 100,
    step = 1,
    value = 0,
    onChange,
}: any) {
    //

    // const [value, setValue] = React.useState(_value);

    const valueRef = React.useRef(value);

    const startValueRef = React.useRef(value);

    const handleFinishChange = (e) => {
        //
        startValueRef.current = valueRef.current;

        onChange(valueRef.current, false);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        //
        const value = Number(e.target.value) || 0;

        valueRef.current = value;

        // setValue(value);

        onChange(value, true);
    };

    const progress = progressWidth(value, min, max);

    const style = {
        background: `linear-gradient(to right, #328DFD 0%, #328DFD ${progress}%, #3D3F46 ${progress}%, #3D3F46 100%)`,
    };

    // console.log("style", style);

    return (
        <Container>
            <input
                data-noundo={true}
                className="slider"
                style={style}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={handleChange}
                onMouseUp={handleFinishChange}
            />
            <input
                data-noundo={true}
                className="input"
                type="text"
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
                    } else if (e.key === "ArrowUp") {
                        //
                        e.preventDefault();

                        const value = valueRef.current + step;

                        valueRef.current = value;

                        onChange(value, true);
                    } else if (e.key === "ArrowDown") {
                        //
                        e.preventDefault();

                        const value = valueRef.current - step;

                        valueRef.current = value;
                    }
                }}
                value={value}
            />
        </Container>
    );
}

export const NumberInput = React.memo(_NumberInput);

const Container = styled.div`
    width: 100%;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: flex-end;

    & > .slider {
        -webkit-appearance: none;
        -moz-appearance: none;
        outline: 0;
        padding: 0px;
        width: 100%;
        height: 24px;
        margin: 0px;
        border-radius: 6px;
        cursor: pointer;

        ::-webkit-slider-thumb {
            opacity: 0;
        }

        ::-moz-range-thumb {
            opacity: 0;
        }
    }

    & > .input {
        width: 38px;
        height: 24px;
        background: #3d3f46;
        border-radius: 6px;
        outline: none;
        border: none;
        margin-left: 4px;
        font-weight: 500;
        font-size: 12px;
        line-height: 24px;
        text-align: center;
        color: #ffffff;
    }
`;
