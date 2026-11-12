import React from "react";
import styled, { css } from "styled-components";
import { arePropsEqual, isSelectedOption } from "./common";

function _Tabbed({ nullable, value, items, onChange }: any) {
    //
    // console.log("rendering Tabbed...");

    const handleToggle = (item) => {
        //
        if (!isSelectedOption(item, value)) {
            onChange(item);
        } else {
            //
            if (nullable) {
                onChange(null);
            }
        }
    };

    return (
        <Container>
            {items.map((item, index) => {
                //
                const label =
                    typeof item === "object" ? item?.label || item?.name : item;

                return (
                    <OptionBtn
                        key={index}
                        isActive={isSelectedOption(item, value)}
                        aria-pressed={isSelectedOption(item, value)}
                        type="button"
                        onClick={() => {
                            handleToggle(item);
                        }}
                    >
                        {label}
                    </OptionBtn>
                );
            })}
        </Container>
    );
}

export const Tabbed = React.memo(_Tabbed, arePropsEqual);

const Container = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: space-between;
`;

export const OptionBtn = styled.button<{ isActive?: boolean }>`
    width: 100%;
    border: none;
    &:focus-visible {
        outline: 2px solid white;
        outline-offset: 2px;
    }
    height: 24px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 500;
    font-size: 12px;
    line-height: 24px;

    ${(props) =>
        props.isActive
            ? css`
                  color: #ffffff;
                  background: #328dfd;
              `
            : css`
                  color: #ffffff;
                  background: #3d3f46;
              `}
`;
