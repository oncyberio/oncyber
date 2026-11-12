import { noop } from "@utils/js";
import React from "react";
import styled from "styled-components";

export default function List({
    target,
    propName,
    items,
    inputRef,
    onUpdate,
    onChange,
}) {
    const value = target[propName];

    const _onUpdateValue = (val: string | number): void => {
        target[propName] = val;

        onUpdate(val);
        onChange(val);
    };

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        _onUpdateValue(value);
    };

    return (
        <Container>
            <select
                ref={inputRef}
                onChange={handleChange}
                defaultValue={typeof value === "object" ? value?.id : value}
            >
                {items.map((item, index) => {
                    const isObject = typeof item === "object";
                    return isObject ? (
                        <option key={index} value={item?.id}>
                            {item?.name}
                        </option>
                    ) : (
                        <option key={index} value={item}>
                            {item}
                        </option>
                    );
                })}
            </select>
        </Container>
    );
}

List.defaultProps = {
    items: [],
    target: {
        default: false,
    },
    onChange: noop,
    onUpdate: noop,
    inputRef: noop,
    propName: "default",
};

const Container = styled.div`
    width: 100%;
    height: 100%;
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
