import { useEventCallback } from "@components/hooks/useEventCallback";
import { classes, progressWidth, toNum } from "@utils/js";
import React, { useRef, useState } from "react";
import styled, { css } from "styled-components";
import ChevronRight from "@components/_3DExhibit-v2/ui/TweakPane/icons/ChevronRight";
import ChevronLeft from "@components/_3DExhibit-v2/ui/TweakPane/icons/ChevronLeft";

const MIN = -1000000;
const MAX = 1000000;

const defMin = { x: MIN, y: MIN, z: MIN };
const defMax = { x: MAX, y: MAX, z: MAX };
const defStep = { x: 1, y: 1, z: 1 };

function xyzEqual(prev, next) {
    //
    if (prev == null && next == null) return true;
    if (prev == null || next == null) return false;
    return prev.x === next.x && prev.y === next.y && prev.z === next.z;
}

function arePropsEqual(prevProps, nextProps) {
    //
    return (
        xyzEqual(prevProps.value, nextProps.value) &&
        xyzEqual(prevProps.min, nextProps.min) &&
        xyzEqual(prevProps.max, nextProps.max) &&
        xyzEqual(prevProps.step, nextProps.step) &&
        prevProps.layout === nextProps.layout &&
        prevProps.onChange === nextProps.onChange
    );
}

const distanceThreshold = 5;
const sensitivity = 1;

function _XYZInput({
    value,
    min: _min,
    max: _max,
    step: _step,
    layout,
    onChange,
}: any) {
    //

    // console.log("rendering XYZInput...");

    if (typeof _min === "number") {
        _min = { x: _min, y: _min, z: _min };
    }

    if (typeof _max === "number") {
        _max = { x: _max, y: _max, z: _max };
    }

    if (typeof _step === "number") {
        _step = { x: _step, y: _step, z: _step };
    }

    const hasMinMax = _min && _max;

    const min = { ...defMin, ..._min };
    const max = { ...defMax, ..._max };
    const step = { ...defStep, ..._step };

    const handleChange = useEventCallback((name, inputVal, isProgress) => {
        //
        onChange({ ...value, [name]: inputVal }, isProgress);
    }, []);

    const inline = layout === "inline";

    return (
        <Container className={classes({ inline })}>
            <NumberInput
                name={"x"}
                inline={inline}
                min={min.x}
                max={max.x}
                step={step.x}
                value={value.x}
                hasMinMax={hasMinMax}
                onChange={handleChange}
            />

            {value.y != null && (
                <NumberInput
                    name={"y"}
                    inline={inline}
                    min={min.y}
                    max={max.y}
                    step={step.y}
                    value={value.y}
                    hasMinMax={hasMinMax}
                    onChange={handleChange}
                />
            )}

            {value.z != null && (
                <NumberInput
                    name={"z"}
                    inline={inline}
                    min={min.z}
                    max={max.z}
                    step={step.z}
                    value={value.z}
                    hasMinMax={hasMinMax}
                    onChange={handleChange}
                />
            )}
        </Container>
    );
}

const isNum = (n) => !isNaN(parseFloat(n));

function NumberInput({
    name,
    min,
    max,
    step,
    value,
    inline = false,
    onChange,
    hasMinMax,
}: any) {
    //

    const ref = useRef<HTMLInputElement>(null);

    const [chevronLeftActive, setChevronLeftActive] = useState(false);
    const [chevronRightActive, setChevronRightActive] = useState(false);

    const isDraggingRef = useRef(false);
    const startX = useRef(null);

    const [state, setState] = React.useState({
        startValue: value,
        input: value,
        isEditing: false,
    });

    const validate = (input) => {
        //
        if (!isNum(input)) return value;

        return Math.max(min, Math.min(max, toNum(input, value)));
    };

    const handleChange = useEventCallback((input, isProgress) => {
        //

        const val = validate(input);

        const isEditing = isProgress && !isDraggingRef.current;

        setState((prev) => ({
            ...prev,
            input: isEditing ? input : val,
            isEditing,
        }));

        if (val !== value || !isProgress) {
            //
            onChange(name, val, isProgress);
        }
    }, []);

    const handleInputDrag = (event) => {
        event.preventDefault();

        const { input } = state;

        if (isDraggingRef.current) {
            const currentX = event.clientX || event.touches[0].clientX;
            const deltaX = currentX - startX.current;
            const normalizedDeltaX = deltaX / sensitivity;

            if (Math.abs(normalizedDeltaX) >= distanceThreshold) {
                const valueChange = Math.sign(normalizedDeltaX) * step;

                handleChange(validate(input) + valueChange, true);

                startX.current = currentX;
            }
        }
    };

    const handleFinishDragging = (e) => {
        isDraggingRef.current = false;

        startX.current = null;

        const value = e.target.value;

        handleChange(value, false);
    };

    const onKeyDown = useEventCallback((e) => {
        //
        const { startValue, input } = state;

        if (e.key === "Enter") {
            //
            handleChange(input, false);
            //
        } else if (e.key === "Escape") {
            //
            e.preventDefault();

            handleChange(startValue, false);

            //
        } else if (e.key === "ArrowUp") {
            //
            e.preventDefault();

            handleChange(validate(input) + step, false);
            //
        } else if (e.key === "ArrowDown") {
            //
            e.preventDefault();

            handleChange(validate(input) - step, false);
        }
    }, []);

    const handleInputChange = useEventCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            //
            const value = e.target.value;

            handleChange(value, true);
            //
        },
        []
    );

    const handleFinishChange = useEventCallback((e) => {
        //
        const value = e.target.value;

        handleChange(value, false);
        //
    }, []);

    const handleFocus = useEventCallback(() => {
        //
        setState({
            startValue: value,
            input: value,
            isEditing: true,
        });
        //
    }, []);

    const onStepUp = () => {
        const { input } = state;

        handleChange(validate(input) + step, false);
    };

    const onStepDown = () => {
        const { input } = state;

        handleChange(validate(input) - step, false);
    };

    const handleStartDragging = useEventCallback((e) => {
        isDraggingRef.current = true;
        startX.current = e.clientX || e.touches[0].clientX;
    }, []);

    const handleBlur = useEventCallback(() => {
        //
        console.log("state.input", state.input);
        handleChange(state.input, false);
        //
    }, []);

    const { isEditing, input } = state;

    const progress = progressWidth(value, min, max);

    const style = {
        background: `linear-gradient(to right, #328DFD 0%, #328DFD ${progress}%, #3D3F46 ${progress}%, #3D3F46 100%)`,
    };

    const beginSliding = useEventCallback((e) => {
        if (!ref.current) return;

        ref.current.setPointerCapture(e.pointerId);
    }, []);

    const stopSliding = useEventCallback((e) => {
        if (!ref.current) return;

        ref.current.onpointermove = null;
        ref.current.releasePointerCapture(e.pointerId);
    }, []);

    const conditionalProps = !hasMinMax
        ? {
              onPointerDown: beginSliding,
              onPointerUp: stopSliding,
              onTouchStart: handleStartDragging,
              onMouseDown: handleStartDragging,
              onMouseMove: handleInputDrag,
              onTouchMove: handleInputDrag,
              onDragStart: (e) => e.preventDefault(),
              onMouseUp: handleFinishDragging,
              onTouchEnd: handleFinishDragging,
          }
        : {};

    return (
        <InputWraper className={classes({ inline })}>
            {!inline && <label>{name}</label>}

            <div>
                {hasMinMax && (
                    <input
                        data-noundo={true}
                        className="slider"
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        style={style}
                        onChange={handleInputChange}
                        onMouseUp={handleFinishChange}
                    />
                )}

                <InputContainer style={{ width: hasMinMax ? "90px" : "100%" }}>
                    <ChevronLeft
                        width="6"
                        height="8"
                        onClick={onStepDown}
                        className="icon-left"
                        onMouseDown={() => {
                            setChevronLeftActive(true);
                        }}
                        onMouseLeave={() => {
                            setChevronLeftActive(false);
                        }}
                        stoke={chevronLeftActive ? "#fff" : "#A7A7A7"}
                    />

                    <ChevronRight
                        width="6"
                        height="8"
                        onClick={onStepUp}
                        className="icon-right"
                        onMouseDown={() => {
                            setChevronRightActive(true);
                        }}
                        onMouseLeave={() => {
                            setChevronRightActive(false);
                        }}
                        stoke={chevronRightActive ? "#fff" : "#A7A7A7"}
                    />

                    <Input
                        ref={ref}
                        data-noundo={true}
                        name={"z"}
                        min={min}
                        max={max}
                        hasMinMax={hasMinMax}
                        step={step}
                        value={isEditing ? input : value}
                        onChange={handleInputChange}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        onKeyDown={onKeyDown}
                        className={isDraggingRef?.current ? "hide-caret" : ""}
                        {...conditionalProps}
                    />
                </InputContainer>
            </div>
        </InputWraper>
    );
}

export const XYZInput = React.memo(_XYZInput, arePropsEqual);

const Container = styled.div`
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
    justify-content: space-between;

    &.inline {
        flex-direction: row;
        align-items: center;
        justify-content: stretch;
    }
`;

const InputWraper = styled.div`
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;

    & > label {
        width: 100px;
        min-width: 100px;
        color: #a7a7a7;
        font-family: Aeonik;
        font-size: 12px;
        font-style: normal;
        font-weight: 400;
        line-height: 24px;
        text-transform: uppercase;
    }

    & > div {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 4px;

        & > .slider {
            -webkit-appearance: none;
            -moz-appearance: none;
            outline: 0;
            padding: 0px;
            width: 100%;
            height: 24px;
            margin: 0px;
            border-radius: 6px;
            cursor: pointer;

            ::-webkit-slider-thumb {
                opacity: 0;
            }

            ::-moz-range-thumb {
                opacity: 0;
            }
        }
    }
`;

const Input = styled.input.attrs({ type: "number" })<{ hasMinMax: boolean }>`
    -webkit-touch-callout: none; /* iOS Safari */
    -webkit-user-select: none; /* Safari, Chrome, Opera, Samsung */
    -khtml-user-select: none; /* Konqueror HTML */
    -moz-user-select: none; /* Firefox */
    -ms-user-select: none; /* Edge, IE */
    user-select: none; /* Modern browsers */

    ${(props) =>
        props.hasMinMax
            ? css`
                  width: calc(100% - 20px);
              `
            : css`
                  width: calc(100% - 40px);
                  cursor: col-resize;
              `}

    background: #3d3f46;
    border-radius: 6px;
    height: 24px;
    border: none;
    outline: none;
    text-align: center;
    font-weight: 500;
    font-size: 12px;
    line-height: 24px;
    color: rgba(255, 255, 255, 0.4);
    -moz-appearance: textfield;

    &.hide-caret {
        caret-color: transparent !important;
    }

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
`;

const InputContainer = styled.div`
    user-select: all;
    display: flex;
    height: 24px;
    position: relative;
    background: #3d3f46;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;

    & > .icon-left {
        position: absolute;
        top: 9px;
        left: 4.5px;
        visibility: hidden;
    }

    & > .icon-right {
        position: absolute;
        top: 9px;
        right: 4.5px;
        visibility: hidden;
    }

    &:hover {
        .icon-left,
        .icon-right {
            visibility: visible;
        }
    }
`;
