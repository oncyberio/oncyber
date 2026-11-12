import React, { useEffect, useRef, CSSProperties, useMemo } from "react";
import styled from "styled-components";

import IconImg from "@ui/components/IconImg";
import { XY } from "@components/hooks/useDrag";
import { clamp, noop } from "utils/js";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { has } from "lodash";

export interface ClampPad {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
}

export interface FloatbarProps {
    className?: string;
    children?: React.ReactNode;
    clampPad?: ClampPad;
    onChange?: (coords: XY) => void;
    header?: string;
    style?: CSSProperties;
}

const defaultClamp = {
    top: 80,
    bottom: 6,
    left: 20,
    right: 20,
};

export function Floatbar({
    className = "",
    children,
    clampPad: _clamp = {},
    onChange = noop,
    header = "",
    style = {},
}: FloatbarProps) {
    //
    const handleRef = useRef<HTMLDivElement>();
    const elementRef = useRef<HTMLDivElement>();

    const clampPad = { ...defaultClamp, ..._clamp };

    const handleChange = useEventCallback((coords) => {
        const elem = elementRef.current as HTMLElement;

        coords.x = clamp(
            coords.x,
            clampPad.left,
            window.innerWidth - elem.clientWidth - clampPad.right
        );

        coords.y = clamp(
            coords.y,
            clampPad.top,
            window.innerHeight - elem.clientHeight - clampPad.bottom
        );

        onChange?.(coords);
    }, []);

    useEffect(() => {
        //

        if (handleRef.current == null || elementRef.current == null) return;

        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let currentY = 0;

        const onPointerDown = (event: PointerEvent) => {
            event.preventDefault();
            event.stopPropagation();

            const { x, y } = elementRef.current.getBoundingClientRect();

            startX = event.clientX - x;
            startY = event.clientY - y;

            handleRef.current.setPointerCapture(event.pointerId);
            handleRef.current.addEventListener("pointermove", onPointerMove);
        };

        const onPointerMove = (event: PointerEvent) => {
            //
            event.stopPropagation();

            currentX = event.clientX - startX;
            currentY = event.clientY - startY;

            let coords = { x: currentX, y: currentY };

            handleChange?.(coords);

            elementRef.current.style.transform = `translate(${coords.x}px, ${coords.y}px)`;
        };

        const onPointerUp = (event: PointerEvent) => {
            event.stopPropagation();
            handleRef.current.releasePointerCapture(event.pointerId);
            handleRef.current.removeEventListener("pointermove", onPointerMove);
        };

        handleRef.current.addEventListener("pointerdown", onPointerDown);
        handleRef.current.addEventListener("pointerup", onPointerUp);

        return () => {
            //
            handleRef.current?.removeEventListener(
                "pointerdown",
                onPointerDown
            );
            handleRef.current?.removeEventListener("pointerup", onPointerUp);
        };
    }, [handleRef.current, elementRef.current]);

    const hasMounted = useRef(false);

    useEffect(() => {
        //
        if (hasMounted.current) return;

        const bounds = elementRef.current.getBoundingClientRect();

        onChange?.({
            x: bounds.left,
            y: bounds.top,
        });

        elementRef.current.style.transform = `translate(${bounds.left}px, ${bounds.top}px)`;

        hasMounted.current = true;
    }, []);

    const _style = useMemo(() => {
        //
        if (!hasMounted.current) return style;

        // clear style positioning props and use only transform
        return {
            ...style,
            top: 0,
            left: 0,
            bottom: null,
            right: null,
        };
    }, [style, hasMounted.current]);

    return (
        <Container ref={elementRef} className={`${className}`} style={_style}>
            <Header>
                <span>{header}</span>
                <div className="grab" ref={handleRef}>
                    <IconImg name="grab-vert" size={20} />
                </div>
            </Header>

            {children}
        </Container>
    );
}

const Container = styled.div`
    //

    position: fixed !important;
    z-index: 10000 !important;

    user-select: none;
    overflow: hidden;
    background: #1e1e1e;
    box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.15),
        0px 12px 28px rgba(0, 0, 0, 0.11);

    width: 100%;
    max-height: 80vh;
    border-radius: 8px;
    margin: 0;

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    //z-index: 1000000000;
`;

const Header = styled.div`
    width: 100%;

    display: flex;
    padding: 20px;
    user-select: none;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #292929;

    & > span {
        height: 100%;
        margin: 0;
        font-weight: 500;
        font-size: 15px;
        line-height: 100%;
        color: #ffffff;
        text-transform: capitalize;
    }

    & > .grab {
        cursor: move;
        display: flex;
        align-items: center;
    }
`;
