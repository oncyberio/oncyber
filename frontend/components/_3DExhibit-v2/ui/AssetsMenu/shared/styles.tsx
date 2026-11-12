import styled, { css } from "styled-components";

export const Flex = styled.div<{
    small?: boolean;
    inverse?: boolean;
}>`
    display: grid;
    grid-template-columns: ${({ small, inverse }) =>
        small ? (inverse ? "3fr 10fr" : "10fr 3fr") : "1fr"};
    grid-gap: 4px;
    margin-top: 0px;
    input {
        height: 30px;
    }
    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
    /* Firefox */
    input[type="number"] {
        -moz-appearance: textfield;
    }
    button {
        font-size: 15px;
        border-radius: 3px;
        margin-top: 8px;
    }
    .replaceBtn {
        background: rgb(22, 22, 22);
        border-radius: 3px;
        color: white;
        height: 40px;
        transition: 0.2s;
        &:hover {
            background: #000;
        }
    }
    .deleteBtn {
        height: 40px;
    }
    @media (max-width: 800px) {
        grid-template-columns: ${({ small }) =>
            small ? "6fr 3fr" : "1fr 1fr"};

        &.single {
            grid-template-columns: 1fr;
        }

        .replaceBtn,
        .deleteBtn {
            font-size: 14px;
            height: 35px;
            margin-top: 0;
        }
    }
`;

export const Range = styled.input`
    width: 100%;
    -webkit-appearance: none;
    background-color: #ddd;
    height: 30px;
    overflow: hidden;
    margin: 0;
    &::-webkit-slider-runnable-track {
        -webkit-appearance: none;
        height: 30px;
    }
    &::-webkit-slider-thumb {
        -webkit-appearance: none;
        background: #000;
        box-shadow: -210px 0 0 200px #252525;
        cursor: pointer;
        height: 30px;
        width: 15px;
        border: 0;
        cursor: ew-resize;
    }
    &::-moz-range-thumb {
        background: #333;
        border-radius: 50%;
        box-shadow: -1010px 0 0 1000px #252525;
        cursor: pointer;
        height: 20px;
        width: 20px;
        border: 0;
    }
    &::-moz-range-track {
        background-color: #ddd;
    }
    &::-moz-range-progress {
        background-color: #252525;
        height: 20px;
    }
    &::-ms-fill-upper {
        background-color: #ddd;
    }
    &::-ms-fill-lower {
        background-color: #252525;
    }
`;

export const Separator = styled.div`
    width: 100%;
    height: 1.3px;
    background: #f1f1f7;
    margin-bottom: 20px;
`;

export const CoordsWrapper = styled.div`
    display: flex;
    align-items: center;
    margin-bottom: 12px;

    p {
        margin-right: 12px;
        font-weight: 500;
        font-size: 14px;
        color: #070707;
        opacity: 1;
        width: auto;
        padding: 0;
    }
`;

export const Buttons = styled.div`
    display: flex;
    align-items: center;
    margin-top: 8px;

    div:not(:last-child) {
        margin-right: 24px;
    }
`;

export const NavButton = styled.div<{
    active?: boolean;
}>`
    font-weight: 500;
    font-size: 13px;
    line-height: 24px;

    display: flex;
    align-items: center;

    color: #999999;
    border-right: none;
    cursor: pointer;

    transition: all 0.3s ease;
    opacity: 0.4;

    span {
        margin-left: 4px;
    }

    svg {
        margin-right: 4px;
    }

    svg {
        path {
            stroke: #999999 !important;
        }
    }

    &:hover {
        color: #070707;

        svg {
            path {
                stroke: #070707 !important;
            }
        }
    }

    ${({ active }) => {
        return (
            active &&
            css`
                svg {
                    path {
                        stroke: #070707 !important;
                    }
                }
                color: #070707;
            `
        );
    }}
`;
