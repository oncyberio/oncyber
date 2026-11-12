import { useEventCallback } from "@components/hooks/useEventCallback";
import { useEffect, useState, useRef, CSSProperties } from "react";
import styled, { css } from "styled-components";

interface SliderProps {
    min: number;
    max: number;
    onChange: (value: number, isDragging: boolean) => unknown;
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
    value,
    onChange,
    hideInput,
    mode,
    disabled,
    size,
    isLimitless,
    style,
}: SliderProps) {
    //

    const isDraggingRef = useRef(false);

    const progress = (value / max) * 100;

    const handleChange = useEventCallback(
        //
        (e) => {
            //
            const target = e.target as HTMLInputElement;

            let newValue = Number(target.value);

            if (isNaN(newValue)) return;

            if (!isLimitless && newValue > max) {
                newValue = max;
            }

            onChange(newValue, isDraggingRef.current);
        },
        []
    );

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
                    type="text"
                    value={value}
                    onChange={handleChange}
                    disabled={disabled}
                />
            ) : null}

            <input
                disabled={disabled}
                style={{
                    backgroundImage: `linear-gradient(90deg,
                    ${
                        disabled
                            ? "var(--studio-muted)"
                            : mode === "light"
                            ? "var(--studio-secondary)"
                            : "var(--studio-ink)"
                    } ${progress}%,
                    ${
                        disabled
                            ? "var(--studio-line)"
                            : mode === "light"
                            ? "var(--studio-line)"
                            : "var(--studio-line)"
                    } ${progress}%)`,
                    boxShadow:
                        "rgb(34 34 43 / 11%) 0px 2px 4px, rgb(34 35 41 / 5%) 0px 1px 1px",
                }}
                className="slider"
                value={value}
                onPointerDown={(e) => {
                    isDraggingRef.current = true;
                }}
                onPointerUp={(e) => {
                    isDraggingRef.current = false;
                    handleChange(e);
                }}
                onChange={handleChange}
                type="range"
                min={min}
                max={max}
            />
        </Container>
    );
}

Slider.defaultProps = {
    min: 0,
    max: 100,
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

    .input {
        border: 1px solid var(--studio-line);
        outline: none;
        border-radius: 8px;
        width: 44px;
        min-height: 32px;
        text-align: center;
        padding: 4px;
        background-color: var(--studio-inset);
        color: var(--studio-ink);

        font: 11px/18px var(--studio-mono, monospace);
        margin-right: 12px;
        &:focus-visible {
            border-color: var(--studio-muted);
        }
    }

    .slider {
        -webkit-appearance: none;
        width: 100%;
        outline: none;
        border-radius: 100px;
        height: 4px;
        &:focus-visible {
            outline: 2px solid var(--studio-muted);
            outline-offset: 5px;
        }

        ${(props) =>
            props.size === "small" &&
            css`
                height: 4px;
            `}
    }

    .slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
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
        width: 14px;
        height: 14px;
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
