import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import ChevronLeft from "../icons/ChevronLeft";
import ChevronRight from "../icons/ChevronRight";

export default function InputNumber({
    min,
    max,
    step,
    value,
    handleChange,
    name,
    style = {},
}) {
    const ref = useRef<HTMLInputElement>(null);

    const [chevronLeftActive, setChevronLeftActive] = useState(false);
    const [chevronRightActive, setChevronRightActive] = useState(false);

    const [inputStep, setInputStep] = useState(step);

    useEffect(() => {
        const handleKeyDown = (event) => {
            setInputStep(event.shiftKey ? 0.0001 : step);
        };

        const handleKeyUp = (event) => {
            setInputStep(step);
        };

        document.addEventListener("keyup", handleKeyUp);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.addEventListener("keyup", handleKeyUp);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    const onStepUp = () => {
        ref.current.stepUp(1);
        handleChange(name, ref.current.value);
    };

    const onStepDown = () => {
        ref.current.stepDown(1);
        handleChange(name, ref.current.value);
    };

    return (
        <Container style={style}>
            <ChevronLeft
                width="6"
                height="8"
                onClick={onStepDown}
                className="icon-left"
                onMouseDown={() => {
                    setChevronLeftActive(true);
                }}
                onMouseLeave={() => {
                    setChevronLeftActive(false);
                }}
                stoke={chevronLeftActive ? "#fff" : "#A7A7A7"}
            />

            <ChevronRight
                width="6"
                height="8"
                onClick={onStepUp}
                className="icon-right"
                onMouseDown={() => {
                    setChevronRightActive(true);
                }}
                onMouseLeave={() => {
                    setChevronRightActive(false);
                }}
                stoke={chevronRightActive ? "#fff" : "#A7A7A7"}
            />

            <Input
                name={name}
                min={min}
                max={max}
                step={inputStep}
                value={value}
                ref={ref}
                //onWheel={handleScroll}
                onChange={(e) => handleChange(name, e.target.value)}
            />
        </Container>
    );
}

const Container = styled.div`
    width: 100%;
    height: 24px;
    position: relative;
    background: #3d3f46;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;

    & > .icon-left {
        position: absolute;
        top: 9px;
        left: 4.5px;
        visibility: hidden;
    }

    & > .icon-right {
        position: absolute;
        top: 9px;
        right: 4.5px;
        visibility: hidden;
    }

    &:hover {
        .icon-left,
        .icon-right {
            visibility: visible;
        }
    }
`;

const Input = styled.input.attrs({ type: "number" })`
    width: 100%;
    height: 100%;
    border: none;
    outline: none;
    max-width: calc(100% - 5px);
    text-align: center;
    font-weight: 500;
    font-size: 12px;
    line-height: 24px;
    background: transparent;
    color: rgba(255, 255, 255, 0.4);

    -webkit-user-select: none; /* Safari */
    -ms-user-select: none; /* IE 10 and IE 11 */
    user-select: none; /* Standard syntax */

    appearance: none;
    -moz-appearance: textfield;

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
        margin: 0;
        -webkit-appearance: none;
    }
`;
