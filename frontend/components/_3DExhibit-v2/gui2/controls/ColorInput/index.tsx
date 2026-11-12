import React, { ChangeEvent, useRef, useState, useId, useEffect } from "react";
import styled, { css } from "styled-components";
import { SketchPicker } from "react-color";
// import useOuterClick from "@components/hooks/useOuterClick";
import { CustomDropdown } from "@features/studio/components/CustomDropdown";

//let frame = 0;

function _ColorPicker({ value: color, onChange }) {
    //
    //console.log("render frame", ++frame);

    const handleChange = (color: { hex: string }): void => {
        //
        const hexColor = color.hex;

        onChange(hexColor);
    };

    const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        //
        const color = event.target.value;

        const regex = /^#[0-9A-F]{6}$/i;

        if (regex.test(color)) {
            onChange(color);
        }
    };

    const caption = (
        <Container>
            <Color value={color} />
            <ColorInput
                data-noundo={true}
                type="text"
                value={color}
                onChange={handleInputChange}
            />
        </Container>
    );

    return (
        <CustomDropdown caption={caption}>
            {({ toggle }) => {
                //
                return (
                    <div>
                        <BlockPickerWrapper>
                            <SketchPicker
                                color={color}
                                onChange={handleChange}
                            />
                        </BlockPickerWrapper>
                    </div>
                );
            }}
        </CustomDropdown>
    );
}

export const ColorPicker = React.memo(_ColorPicker);

const Container = styled.div`
    width: 100%;
    height: 30px;
    display: flex;
    align-items: center;
    position: relative;
    justify-content: space-between;
`;

const Color = styled.div<{ value: string }>`
    width: 42px;
    height: 24px;
    border-radius: 6px;
    margin-right: 6px;
    cursor: pointer;

    ${(props) =>
        props.value &&
        css`
            background: ${props.value};
        `}
`;

const BlockPickerWrapper = styled.div<{ isHidden?: boolean }>`
    /* position: absolute;
    cursor: pointer; */
    width: 100%;
    /* top: 2rem;
    right: 6rem;
    z-index: 10000000; */
    transition: all 1s ease-in;
    /* ${({ isHidden }) => isHidden && "display: none"}; */

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
