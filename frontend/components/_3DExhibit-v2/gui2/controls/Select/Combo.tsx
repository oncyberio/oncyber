import React from "react";
import styled, { css } from "styled-components";
import { arePropsEqual } from "./common";

function _Combo({ nullable, value, items, onChange }: any) {
    //
    // console.log("rendering Combo...");

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        //
        const option = e.target.value;

        let value;

        if (option === "null") {
            value = null;
        } else {
            //
            value = items.find((item) => item === option || item.id === option);
        }

        onChange(value || null);
    };

    return (
        <Container>
            <select
                data-noundo={true}
                onChange={handleChange}
                value={typeof value === "object" ? value?.id : value}
            >
                {nullable && <option value="null">None</option>}

                {items.map((item, index) => {
                    //
                    const isObject = typeof item === "object";

                    const id = isObject ? item?.id : item;

                    const label = isObject ? item?.label || item?.name : item;

                    return (
                        <option key={id} value={id}>
                            {label}
                        </option>
                    );
                })}
            </select>
        </Container>
    );
}

export const Combo = React.memo(_Combo, arePropsEqual);

const Container = styled.div`
    width: 100%;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;

    & > select {
        width: 100%;
        height: 24px;
        border: none;
        outline: none;
        text-align: left;
        background: #3d3f46;
        border-radius: 6px;
        font-weight: 500;
        font-size: 12px;
        line-height: 24px;
        color: #ffffff;
        padding: 0px 5px;
        border-right: 5px solid transparent;
    }
`;

export const OptionBtn = styled.div<{ isActive?: boolean }>`
    width: 100%;
    border: none;
    outline: none;
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
