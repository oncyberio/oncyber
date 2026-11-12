import React from "react";
import { noop } from "@utils/js";
import InputNumber from "./Number";
import styled from "styled-components";
import { Range as RangeSlider } from "@components/DesignSystem/input/range";

export default function Range({
    min,
    max,
    step,
    target,
    propName,
    onUpdate,
    onChange,
    inputRef,
    updateDisplays,
    onFinishChange,
}) {
    const value = target[propName];

    const _onUpdateValue = (val: number): void => {
        target[propName] = val;

        updateDisplays();

        onUpdate(val);
        onChange(val);
    };

    const handleMouseLeave = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target?.value);
        onFinishChange(val);
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        _onUpdateValue(value);
    };

    return (
        <Container ref={inputRef}>
            <RangeSlider
                type="range"
                min={min}
                max={max}
                height={24}
                step={step}
                value={value}
                data-bg="#3D3F46"
                background="#3D3F46"
                progressColor="#328DFD"
                onChange={handleSliderChange}
                data-progress-color="#328DFD"
                style={{ borderRadius: "6px" }}
                onMouseUp={onFinishChange ? handleMouseLeave : noop}
            />
            <InputNumber
                min={min}
                max={max}
                name={"x"}
                step={step}
                value={value}
                style={{ width: "66px" }}
                handleChange={(_name, value) => _onUpdateValue(Number(value))}
            />
        </Container>
    );
}

Range.defaultProps = {
    min: 0,
    max: 100,
    step: 1,
    target: {
        default: false,
    },
    propName: "default",
    onChange: noop,
    onUpdate: noop,
    inputRef: noop,
    updateDisplays: noop,
    onFinishChange: undefined,
};

const Container = styled.div`
    gap: 4px;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
`;
