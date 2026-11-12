import { useEffect, useState, CSSProperties } from "react";
import styled, { css } from "styled-components";

interface SliderProps {
    min: number;
    max: number;
    step: number;
    onChange: Function;
    value: number;
    hideInput?: boolean;
    mode?: "dark" | "light";
    disabled: boolean;
    size: "small" | "medium";
    isLimitless?: boolean;
    style?: CSSProperties;
}

export default function Slider({
    min,
    max,
    step,
    value,
    onChange,
    hideInput,
    mode,
    disabled,
    size,
    isLimitless,
    style,
}: SliderProps) {
    const [_value, setValue] = useState(value);

    const progress = (_value / max) * 100;

    useEffect(() => {
        setValue(value);
    }, [value]);

    return (
        <Container
            size={size}
            disabled={disabled}
            mode={mode}
            progress={progress}
            style={style}
        >
            {!hideInput ? (
                <input
                    className="input"
                    type="number"
                    value={_value}
                    onChange={(e) => {
                        let event = e;
                        let found = false;

                        if (!isLimitless) {
                            if (Number(e.target.value) > max) {
                                setValue(max);
                                event.target.value = String(max);
                                found = true;
                            }

                            if (Number(e.target.value) < min) {
                                setValue(min);
                                event.target.value = String(min);
                                found = true;
                            }
                        }

                        if (!found) {
                            setValue(Number(e.target.value));
                        }

                        onChange(event);
                    }}
                    disabled={disabled}
                />
            ) : null}

            <input
                disabled={disabled}
                style={{
                    backgroundImage: `linear-gradient(90deg,
                    ${
                        disabled
                            ? "#807d7d"
                            : mode === "light"
                            ? "#3d3f46"
                            : "#FFFFFF"
                    } ${progress}%,
                    ${
                        disabled
                            ? "#484646"
                            : mode === "light"
                            ? "#dfdfe4"
                            : "#3d3f46"
                    } ${progress}%)`,
                    boxShadow:
                        "rgb(34 34 43 / 11%) 0px 2px 4px, rgb(34 35 41 / 5%) 0px 1px 1px",
                }}
                className="slider"
                value={_value}
                onChange={(e) => {
                    if (isNaN(Number(e.target.value))) {
                        return;
                    }

                    if (!isLimitless && Number(e.target.value) > max) {
                        return setValue(max);
                    }

                    setValue(Number(e.target.value));

                    onChange(e);
                }}
                type="range"
                step={step}
                min={min}
                max={max}
            />
        </Container>
    );
}

Slider.defaultProps = {
    min: 0,
    max: 100,
    step: 1,
    hideInput: false,
    value: 0,
    mode: "light",
    disabled: false,
    size: "medium",
    isLimitless: false,
};

interface ContainerProps extends SliderProps {
    progress: number;
}

const Container = styled.div<Partial<ContainerProps>>`
    display: flex;
    align-items: center;

    ${(props) =>
        props.disabled &&
        css`
            opacity: 0.4;
        `}

    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    /* Firefox */
    input[type="number"] {
        -moz-appearance: textfield;
    }

    .input {
        border: 2px solid #777980;
        border-radius: 4px;
        width: 50px;
        padding: 8px;

        font-style: normal;
        font-weight: 500;
        font-size: 12px;
        line-height: 100%;
        outline: none;

        margin-right: 16px;
    }

    .slider {
        -webkit-appearance: none;
        width: 100%;
        outline: none;
        border-radius: 100px;
        height: 8px;

        ${(props) =>
            props.size === "small" &&
            css`
                height: 4px;
            `}
    }

    .slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 20px;
        height: 20px;
        border-radius: 50% !important;
        cursor: pointer;
        background: #ffffff;
        box-shadow: 0px 2px 4px rgba(34, 34, 43, 0.26),
            0px 1px 1px rgba(34, 35, 41, 0.23);
        border: none;

        ${(props) =>
            props.size === "small" &&
            css`
                width: 12px;
                height: 12px;
            `}
    }

    .slider::-moz-range-thumb {
        width: 20px;
        height: 20px;
        background: #ffffff;
        box-shadow: 0px 2px 4px rgba(34, 34, 43, 0.26),
            0px 1px 1px rgba(34, 35, 41, 0.23);
        cursor: pointer;

        ${(props) =>
            props.size === "small" &&
            css`
                width: 12px;
                height: 12px;
            `}
    }

    .slider:disabled::-webkit-slider-thumb {
        background: #807d7d;
    }

    .slider:disabled::-moz-range-thumb {
        background: #807d7d;
    }
`;
