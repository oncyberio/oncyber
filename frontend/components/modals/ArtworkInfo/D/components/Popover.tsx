import useOuterClick from "@components/hooks/useOuterClick";
import { IS_TOUCH } from "@components/_3DExhibit-v2/three/constants";
import React, { useEffect, useRef } from "react";
import styled from "styled-components";

export type PopoverPlacement = "top" | "left";

export type PopoverTrigger = "click" | "hover";

const PADDING = 40;

export interface PopoverProps {
    // onToggle: () => unknown;
    className?: string;
    placement: PopoverPlacement;
    triggerRef: React.MutableRefObject<HTMLElement>;
    children: React.ReactNode;
    trigger: PopoverTrigger | null;
}

let baseZIndex = 100;
let baseZIndexHover = 200;

export function Popover({
    children,
    className,
    placement,
    triggerRef,
    trigger = IS_TOUCH ? "click" : "hover",
}: //parentRef,
PopoverProps) {
    //

    const ref = useRef<HTMLDivElement>(null);

    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        //
        if (!ref.current || !triggerRef.current) return;

        overlayRef.current.style.zIndex = String(
            trigger === "hover" ? ++baseZIndexHover : ++baseZIndex
        );

        ref.current.style.zIndex = String(
            trigger === "hover" ? ++baseZIndexHover : ++baseZIndex
        );

        function toggle(visible?: "visible" | "hidden") {
            visible ??=
                ref.current.style.visibility === "hidden"
                    ? "visible"
                    : "hidden";
            ref.current.style.visibility = visible;
            overlayRef.current.style.visibility = visible;
        }

        function handleTriggerClick(e) {
            toggle();
        }

        function handleOuterClick(e) {
            if (
                !ref.current.contains(e.target) &&
                !triggerRef.current.contains(e.target)
            ) {
                toggle("hidden");
            }
        }

        function handleMouseEnter() {
            toggle("visible");
            const padding = PADDING;
            const bounds = ref.current.getBoundingClientRect();
            overlayRef.current.style.top = `${bounds.top - padding / 2}px`;
            overlayRef.current.style.left = `${bounds.left - padding / 2}px`;
            overlayRef.current.style.width = `${bounds.width + padding}px`;
            overlayRef.current.style.height = `${bounds.height + padding}px`;
        }

        function handleMouseLeave(event: MouseEvent) {
            //
            const bounds = overlayRef.current.getBoundingClientRect();

            const mouseInside =
                event.clientX >= bounds.left &&
                event.clientX <= bounds.right &&
                event.clientY >= bounds.top &&
                event.clientY <= bounds.bottom;

            if (!mouseInside) {
                toggle("hidden");
            }
        }

        if (trigger === "click") {
            document.addEventListener("pointerdown", handleOuterClick);
            triggerRef.current.addEventListener(
                "pointerdown",
                handleTriggerClick
            );

            return () => {
                document.removeEventListener("pointerdown", handleOuterClick);
                triggerRef.current?.removeEventListener(
                    "pointerdown",
                    handleTriggerClick
                );
            };
        } else if (trigger === "hover") {
            triggerRef.current.addEventListener("mouseenter", handleMouseEnter);
            triggerRef.current.addEventListener("mouseleave", handleMouseLeave);
            overlayRef.current.addEventListener("mouseleave", handleMouseLeave);

            //overlayRef.current.addEventListener("mouseenter", handleMouseEnter);

            return () => {
                triggerRef.current?.removeEventListener(
                    "mouseenter",
                    handleMouseEnter
                );
                triggerRef.current?.removeEventListener(
                    "mouseleave",
                    handleMouseLeave
                );

                // overlayRef.current?.removeEventListener(
                //     "mouseenter",
                //     handleMouseEnter
                // );
                overlayRef.current?.removeEventListener(
                    "mouseleave",
                    handleMouseLeave
                );
            };
        }
    }, [ref.current, triggerRef.current, trigger]);

    return (
        <>
            <Overlay ref={overlayRef} style={{ visibility: "hidden" }} />
            <Container
                style={{ visibility: "hidden" }}
                className={`${placement} ${trigger} ${className}`}
                ref={ref}
            >
                {children}
            </Container>
        </>
    );
}

const Container = styled.div`
    background: #1d1d1d;
    border-radius: 8px;
    padding: 24px;
    position: absolute;
    box-shadow: 0px 10px 20px 0px rgb(0 0 0 / 60%);

    & > .dummy {
        position: absolute;
        top: 100%;
        background-color: yellow;
    }

    &.top {
        bottom: calc(100% + 8px);
        left: 0;
    }

    &.top::after {
        position: absolute;
        content: "";
        top: 100%;
        left: 20px;
        border-style: solid;
        border-width: 10px;
        border-color: #1d1d1d transparent transparent transparent;
    }

    &.left {
        left: calc(100% + 20px);
        bottom: 0;
    }

    &.left::after {
        position: absolute;
        content: "";
        right: 100%;
        bottom: 20px;
        border-style: solid;
        border-width: 10px;
        border-color: transparent #1d1d1d transparent transparent;
    }
`;

const Overlay = styled.div`
    position: fixed;
    left: 0;
    bottom: 0;
    background: none;
    // background-color: rgb(255 255 0 / 20%);
`;
