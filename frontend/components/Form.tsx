import styled from "styled-components";

export const Input = styled.input`
    border: 2px solid #f2eee8;
    width: 100%;
    height: 40px;
    font-size: 16px;
    padding: 2px 10px;
    background: #fff;
    color: #425466;
    outline: none;
    transition: 0.2s;
    box-shadow: none !important;

    &:focus {
        border: 2px solid #00ffd4;
    }

    @media (max-width: 600px) {
        font-size: 14px;
    }
`;

export const Select = styled.select`
    border: 2px solid #f2eee8;
    width: 100%;
    height: 40px;
    font-size: 16px;
    padding: 2px 10px;
    background: transparent;
    color: #425466;
    outline: none;
    transition: 0.2s;
    box-shadow: none !important;

    &:focus {
        border: 2px solid #00ffd4;
    }
`;

export const TextArea = styled.textarea`
    border: 2px solid #f2eee8;
    width: 100%;
    min-height: 70px;
    font-size: 14px;
    margin-top: 4px;
    resize: vertical;
    padding: 8px;
    background: white;
    color: #000;
    outline: none;
    transition: 0.2s;
    box-shadow: none !important;

    @media (max-width: 600px) {
        height: 40px;
        font-size: 12px;
    }

    &:focus {
        border: 2px solid #00ffd4;
    }
`;

export const NormalButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    // margin-bottom: 20px;
    padding: 10px 32px;
    border-radius: 10px;
    font-size: 18px;
    line-height: 1.133;
    text-align: center;
    user-select: none;
    appearance: none;
    cursor: pointer;
    background-color: transparent;
    border: 1px solid rgba(0, 0, 0, 0.1);
    color: #000;
    transition: 0.4s;
    outline: none;
    height: 48px;
    overflow: hidden;
    font-weight: 400;
    cursor: pointer;
    // position: fixed;
    // bottom: 3%;
    // right: 3%;
    white-space: nowrap;

    img {
        width: 40px;
        margin: 0 10px 0 0px;
    }

    @media (max-width: 600px) {
        font-size: 14px;
        padding: 8px 10px;

        img {
            width: 12px;
            display: none !important;
            margin: 0 5px 0 5px;
        }
    }

    transition: 0.2s;

    &:hover {
        &:not(:disabled) {
            background: #f1f3f4;
        }
    }

    :disabled {
        cursor: not-allowed;
    }
`;

export const LinkButton = styled.a`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    // margin-bottom: 20px;
    padding: 10px 24px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 18px;
    line-height: 1.133;
    text-align: center;
    user-select: none;
    appearance: none;
    cursor: pointer;
    background-color: transparent;
    border: 1px solid rgba(0, 0, 0, 0.1);
    color: #000;
    transition: 0.4s;
    outline: none;
    height: 48px;
    overflow: hidden;
    font-weight: 400 !important;
    cursor: pointer;

    img {
        width: 40px;
        margin: 0 10px 0 0px;
    }

    &:hover {
        // background: linear-gradient(270deg, rgb(255, 220, 36) 3%, rgb(255, 92, 0) 100%);
        border-color: transparent;
        box-shadow: rgb(0 0 0 / 25%) 0px 4px 7px;
        transform: translateY(-1px);
    }

    @media (max-width: 600px) {
        font-size: 14px;
        padding: 8px 15px;

        img {
            width: 20px;
            margin: 0 5px 0 5px;
        }
    }
`;

export const Button = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    // margin-bottom: 20px;
    padding: 10px 24px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 18px;
    line-height: 1.133;
    text-align: center;
    user-select: none;
    appearance: none;
    cursor: pointer;
    background-color: transparent;
    border: 1px solid rgba(0, 0, 0, 0.1);
    color: #000;
    transition: 0.2s;
    outline: none;
    height: 48px;
    overflow: hidden;
    font-weight: 400;
    cursor: pointer;

    img {
        width: 40px;
        margin: 0 10px 0 0px;
    }

    &:hover:enabled {
        // background: linear-gradient(270deg, rgb(255, 220, 36) 3%, rgb(255, 92, 0) 100%);
        box-shadow: rgb(0 0 0 / 25%) 0px 2px 3px;
        transform: translateY(-2px);
        // border-color: #010103;
        background: #010103;
        color: white;
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.45;
    }
`;

export const DeleteButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 50px;
    margin-top: -10px;
    float: right;
    // margin-bottom: 20px;
    padding: 10px 24px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 18px;
    line-height: 1.133;
    text-align: center;
    user-select: none;
    appearance: none;
    cursor: pointer;
    background-color: transparent;
    border: 1px solid rgba(0, 0, 0, 0.1);
    color: #000;
    transition: 0.4s;
    outline: none;
    height: 48px;
    overflow: hidden;
    font-weight: 400;
    cursor: pointer;

    img {
        width: 40px;
        margin: 0 10px 0 0px;
    }

    &:hover {
        border: 1px solid red;
    }

    @media (max-width: 600px) {
        font-size: 14px;
        padding: 4px;
        height: auto;
        margin-top: 0px;

        img {
            width: 16px !important;
        }
    }
`;

export const Radio = styled.div<{ checked: boolean }>`
    display: flex;
    align-items: center;
    // margin: 16px 5px 16px 0;
    width: 100%;

    label {
        font-size: 15px;
    }

    span {
        margin-right: 5px;
        height: 15px;
        width: 15px;
        cursor: pointer;
        padding: 2px;
        border-radius: 100%;

        background: ${(props) => (props.checked ? "#000" : "white")};
        border: 1px solid #dedede;
    }
`;

export const RadioGroup = styled.div`
    display: flex;
    width: 200px;
    padding: 16px;
`;

export const RadioItem = styled.button<{ active: boolean }>`
    display: flex;
    text-align: center;
    padding: 8px 16px;
    border: 1px solid ${(props) => (props.active ? "#010103" : "#AEAEAE")};
    border-radius: 3px;
    margin-right: 10px;
    cursor: pointer;

    background: ${(props) => (props.active ? "black" : "transparent")};
    color: ${(props) => (props.active ? "white" : "black")};
    font-size: 18px;
    align-items: center;
    justify-content: center;

    :focus {
        outline: none;
        box-shadow: -2px 2px #333, 2px 2px #333, 2px -2px #333, -2px -2px #333;
        border: 1px solid #333;
    }

    img {
        max-width: 20px;
        max-height: 20px;
        margin-right: 8px;
    }

    @media (max-width: 1100px) {
        font-size: 18px;
        padding: 10px;
    }

    @media (max-width: 640px) {
        font-size: 13px;
        padding: 10px 10px;

        .hiddenMobile {
            display: none;
        }

        img {
            width: 24px;
        }
    }
`;

export const CheckBoxWrapper = styled.div`
    position: relative;
`;
export const CheckBoxLabel = styled.label`
    position: absolute;
    top: 0;
    left: 0;
    width: 42px;
    height: 26px;
    border-radius: 15px;
    background: #bebebe;
    cursor: pointer;
    &::after {
        content: "";
        display: block;
        border-radius: 50%;
        width: 18px;
        height: 18px;
        margin: 3px;
        background: #ffffff;
        box-shadow: 1px 3px 3px 1px rgba(0, 0, 0, 0.2);
        transition: 0.2s;
    }
`;

export const CheckBox = styled.input`
    cursor: pointer;
    opacity: 0;
    z-index: 1;
    border-radius: 15px;
    width: 42px;
    height: 26px;
    margin: 0;
    &:checked + ${CheckBoxLabel} {
        background: #00ffd4;
        &::after {
            content: "";
            display: block;
            border-radius: 50%;
            width: 18px;
            height: 18px;
            margin-left: 21px;
            transition: 0.2s;
        }
    }
`;

export const Coordinates = styled.div`
    margin-top: 8px;
    display: grid;

    grid-template-columns: 1fr 1fr 1fr;
    grid-gap: 12px;
    input {
        padding: 0 5.5px;
        border-color: #dadce0;
        border-width: 1px;
        font-size: 0.8em;
    }
    p {
        margin: 0;
        padding: 0 8px;
        width: 100%;
        text-align: right;
        opacity: 0.5;
        font-size: 12px;
    }
`;
