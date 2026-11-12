import React, { ChangeEvent, useRef, useState, useId, useEffect } from "react";
import styled, { css } from "styled-components";
import { SketchPicker } from "react-color";
import useOuterClick from "@components/hooks/useOuterClick";

export default function ColorPicker({
    target,
    propName,
    onUpdate,
    onChange,
    inputRef,
}) {
    const colorValue = target[propName];

    const inputColorRef = useRef(null);

    const [color, setColor] = useState(colorValue);
    const [toggleColorPicker, setToggleColorPicket] = useState(false);

    const _onUpdateValue = (hex: string): void => {
        target[propName] = hex;
        onUpdate(hex);
    };

    const handleChange = (value: { hex: string }): void => {
        const hexColor = value.hex;
        setColor(hexColor);

        inputColorRef.current.value = hexColor;

        _onUpdateValue(hexColor);
    };

    const innerRef = useOuterClick((ev) => {
        if (toggleColorPicker) {
            setToggleColorPicket(false);
        }
    });

    const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        const regex = /^#[0-9A-F]{6}$/i;
        if (regex.test(value)) {
            setColor(value);
            _onUpdateValue(value);
        }
    };

    return (
        <Container ref={innerRef}>
            <div style={{ position: "relative" }} ref={inputRef}>
                <BlockPickerWrapper isHidden={!toggleColorPicker}>
                    <SketchPicker color={colorValue} onChange={handleChange} />
                </BlockPickerWrapper>
                <Color
                    value={color}
                    onClick={() =>
                        setToggleColorPicket((prevState) => !prevState)
                    }
                />
            </div>
            <ColorInput
                type="text"
                ref={inputColorRef}
                defaultValue={color}
                onChange={handleInputChange}
            />
        </Container>
    );
}

const Container = styled.div`
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    position: relative;
    justify-content: space-between;

    .sketch-picker {
        background: #292929 !important;

        label {
            color: #fff !important;
        }
    }

    #rc-editable-input-1,
    #rc-editable-input-2,
    #rc-editable-input-3,
    #rc-editable-input-4,
    #rc-editable-input-5 {
        outline: none !important;
        color: #fff !important;
        box-shadow: none !important;
        border-radius: 2px;
        background: #3d3f46 !important;
    }
`;

const Color = styled.div<{ value: string }>`
    width: 42px;
    height: 24px;
    border-radius: 6px;
    margin-right: 6px;
    border: 1px solid #3d3f46;
    cursor: pointer;

    ${(props) =>
        props.value &&
        css`
            background: ${props.value};
        `}
`;

const BlockPickerWrapper = styled.div<{ isHidden?: boolean }>`
    position: absolute;
    cursor: pointer;
    width: 100%;
    top: 2rem;
    right: 6rem;
    z-index: 10000000;
    transition: all 1s ease-in;
    ${({ isHidden }) => isHidden && "display: none"};
`;

const ColorInput = styled.input`
    width: 100%;
    height: 24px;
    background: #3d3f46;
    border-radius: 6px;
    font-weight: 500;
    font-size: 12px;
    line-height: 24px;
    display: flex;
    align-items: center;
    text-align: center;
    color: #ffffff;
    outline: none;
    border: none;
`;
