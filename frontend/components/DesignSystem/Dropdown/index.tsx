import styled from "styled-components";
import React, { useState } from "react";
import SelectorIcon from "@components/Icons/SelectorIcon";

type DropdownProps = Partial<{
    width: string;
    height: string | number;
    margin: string;
    padding: string;
    background: string;
    borderColor: string;
}>;

export const Dropdown = styled.div<DropdownProps>`
    width: ${({ width }) => width};
    position: relative;
    margin: ${({ margin }) => margin};
    padding: ${({ padding }) => padding};
    width: ${({ width }) => width};
    height: ${({ height }) => height}px;
    color: ${({ color }) => color || "#fff"};

    & > button {
        height: 100%;
        border: none;
        width: 100%;
        cursor: pointer;
        text-align: left;
        border-radius: 07px;
        position: relative;
        border-radius: 0.375rem;
        color: ${({ color }) => color || "#fff"};
        background: ${({ background }) => background};
        border: ${({ borderColor }) => `1px solid ${borderColor}`};

        &:focus {
            outline: 1px solid #000 !important;
        }

        & > div {
            display: flex;
            justify-content: flex-start;
            align-items: center;
            padding: 0 8px;
            color: ${({ color }) => color || "#fff"};

            & > span {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
        }

        & > span {
            display: flex;
            position: absolute;
            top: 0;
            bottom: 0;
            right: 0;
            padding-right: 0.5rem;
            margin-left: 0.75rem;
            display: flex;
            align-items: center;
            pointer-events: none;
            color: ${({ color }) => color || "#fff"};

            & > svg {
                width: 1.25rem;
                height: 1.25rem;
            }
        }

        @media (min-width: 640px) {
            font-size: 0.875rem;
            line-height: 1.25rem;
        }
    }
`;

Dropdown.defaultProps = {
    width: "100%",
    height: 32,
    padding: "0px",
    margin: "10px 0px",
    background: "#1a1919",
    borderColor: "#393b45",
};

type DropdownItemsProps = Partial<{
    top: string;
    isEmpty: boolean;
    isHidden: boolean;
    background: string;
}>;

export const Items = styled.ul<DropdownItemsProps>`
    overflow: auto;
    position: absolute;
    z-index: 10;
    top: ${({ top }) => top};
    ${({ isEmpty }) => !isEmpty && "padding: 0.25px"};
    background: ${({ background }) => background};
    font-size: 1rem;
    line-height: 1.5rem;
    width: 100%;
    max-height: 14rem;
    border-radius: 0.375rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
        0 4px 6px -2px rgba(0, 0, 0, 0.05);
    transition: all 1s ease-in;
    ${({ isHidden }) => isHidden && "display: none !important"};

    @media (max-width: 800px) {
        font-size: 12px;
    }

    &::-webkit-scrollbar {
        width: 5px !important;
    }

    &::-webkit-scrollbar-thumb {
        border-radius: 8px;
        background-color: #333 !important;
    }

    & > li {
        width: 100%;
        padding-top: 0.5rem;
        padding-bottom: 0.5rem;
        padding-right: 2.25rem;
        color: ${({ color }) => color};
        cursor: pointer;
        user-select: none;
        list-style-type: none;

        &:hover {
            opacity: 0.6;
        }

        & > span {
            margin-left: 0.75rem;
            font-weight: 400;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;

            @media (max-width: 800px) {
                font-size: 12px;
            }
        }
    }

    @media (min-width: 640px) {
        font-size: 0.875rem;
        line-height: 1.25rem;
    }
`;

Items.defaultProps = {
    top: "1.238rem",
    background: "#1a1919",
};

export default function ({ items }): React.ReactElement {
    const [toggleMenu, setToggleMenu] = useState(true);

    const [selectedItem, setSelectedItem] = useState(items[0]);

    const handleMenuToggle = () => {
        setToggleMenu((prevState) => !prevState);
    };

    const handleChange = (value: string) => () => {
        setSelectedItem(value);
        setToggleMenu((prev) => !prev);
    };

    return (
        <Dropdown width="160px">
            <button type="button" onClick={handleMenuToggle}>
                <div>
                    <span>{selectedItem}</span>
                </div>
                <span>
                    <SelectorIcon />
                </span>
            </button>
            <Items isHidden={toggleMenu} isEmpty={items.length === 0}>
                {items.map((item, index) => (
                    <li key={index} onClick={handleChange(item)}>
                        <span>{item}</span>
                    </li>
                ))}
            </Items>
        </Dropdown>
    );
}
