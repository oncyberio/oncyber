import React, { useState } from "react";
import { noop } from "@utils/js";
import styled from "styled-components";
import InputNumber from "./Number";

export default function Vector({
    target,
    propName,
    min,
    max,
    step,
    onUpdate,
    onChange,
    inputRef,
}) {
    const value = target[propName] || { x: 0, y: 0, z: 0 };

    const [position, setPosition] = useState(
        target[propName] || { x: 0, y: 0, z: 0 }
    );

    const _onUpdateValue = (val: boolean): void => {
        target[propName] = val;

        onUpdate(val);
        onChange(val);
    };

    const handleChange = (name, value): void => {
        let newState = Number(value);

        const payload = { ...position, [name]: newState };

        if (max?.[name] && newState > max?.[name]) {
            payload[name] = max[name];
        }

        if (min?.[name] && newState < min?.[name]) {
            payload[name] = min?.[name];
        }

        setPosition(payload);

        _onUpdateValue(payload);
    };

    return (
        <Container ref={inputRef}>
            {value?.x !== undefined && (
                <InputNumber
                    name={"x"}
                    min={min?.x}
                    max={max?.x}
                    step={step?.x}
                    value={position?.x}
                    handleChange={handleChange}
                />
            )}
            {value?.y !== undefined && (
                <InputNumber
                    name={"y"}
                    min={min?.y}
                    max={max?.y}
                    step={step?.y}
                    value={position?.y}
                    handleChange={handleChange}
                />
            )}
            {value?.z !== undefined && (
                <InputNumber
                    name={"z"}
                    min={min?.z}
                    max={max?.z}
                    step={step?.z}
                    value={position?.z}
                    handleChange={handleChange}
                />
            )}
        </Container>
    );
}

Vector.defaultProps = {
    target: {
        default: false,
    },
    step: {
        x: 1,
        y: 1,
        z: 1,
    },
    onChange: noop,
    onUpdate: noop,
    inputRef: noop,
    propName: "default",
};

const Container = styled.div`
    width: 100%;
    height: 100%;
    gap: 4px;
    display: flex;
    align-items: center;
    justify-content: space-between;
`;
