import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useEventCallback } from "@components/hooks/useEventCallback";
import dynamic from "next/dynamic";
import { useIsoLayoutEffect } from "@components/hooks/useIsoLayoutEffect";

const Portal = dynamic(() => import("@components/Snackbar/Portal"), {
    ssr: false,
});

export interface DropdownRenderProps {
    toggle: (b?: boolean) => unknown;
    setAutoClose: (b: boolean) => unknown;
}

export interface CaptionRenderProps {
    toggled: boolean;
}

export interface CustomDropdownProps {
    caption: React.ReactNode | ((props: CaptionRenderProps) => React.ReactNode);
    toggleRef?: React.MutableRefObject<any>;
    placement?: "top" | "bottom" | "auto" | "free";
    align?: "left" | "right" | "center";
    padding?: number;
    children: (props: DropdownRenderProps) => React.ReactNode;
    onOpen?: () => unknown;
    onClose?: () => unknown;
    style?: React.CSSProperties;
    className?: string;
    toggleAuth?: (b?: boolean) => void;
    addTogglerRef?: any;
    /**
     * A fixed stacking level, for a dropdown that acts as a modal and must
     * cover every other panel while open. Without it, each opened dropdown
     * goes above the ones opened before it.
     */
    zIndex?: string;
    /**
     * A selector for an ancestor of the caption to place the dropdown
     * against, when the visible control is wider than the caption.
     */
    anchor?: string;
}

const captionsMap = new WeakMap<Element, Element>();

let zIndexCounter = 1000001;

function formatPlacement(x: number | null, min = -Infinity, max = Infinity) {
    //

    return x == null ? "unset" : `${Math.min(Math.max(min, x), max)}px`;
}

export function CustomDropdown({
    caption,
    toggleRef,
    placement = "auto",
    align = "left",
    padding = 10,
    children,
    onOpen,
    onClose,
    style = {},
    className = "",
    toggleAuth,
    addTogglerRef,
    zIndex,
    anchor,
}: CustomDropdownProps) {
    //
    const captionRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const autoClose = useRef(true);

    const [isDropdownShoing, _toggleDropdown] = useState(false);

    const toggleDropdown = useEventCallback((b) => {
        if (isDropdownShoing === b) return;
        // console.trace("toggleDropdown", b);
        _toggleDropdown(b);
    }, []);

    const handleClick = useEventCallback((e: React.MouseEvent) => {
        //

        if (toggleRef && e.target !== toggleRef.current) return;

        if (typeof toggleAuth === "function") {
            toggleAuth();
            return;
        }

        toggleDropdown(!isDropdownShoing);

        if (!isDropdownShoing) {
            //
            onOpen?.();
        }
    }, []);

    const setAutoClose = useEventCallback((b: boolean) => {
        //
        autoClose.current = b;
    }, []);

    const place = useEventCallback(() => {
        //
        if (
            !isDropdownShoing ||
            dropdownRef.current == null ||
            placement === "free"
        )
            return;

        const anchorEl =
            (anchor && captionRef.current?.closest(anchor)) ||
            captionRef.current;
        if (anchorEl == null) return;
        const captionBounds = anchorEl.getBoundingClientRect();

        const contentHeight = dropdownRef.current.clientHeight;

        const contentWidth = dropdownRef.current.clientWidth;

        const containerHeight = window.innerHeight;

        const containerWidth = window.innerWidth;

        let _top = captionBounds.top + captionBounds.height + padding;

        let _bottom = containerHeight - captionBounds.top + padding;

        const spaceBelow = containerHeight - (_top + contentHeight);

        const spaceAbove = containerHeight - (_bottom + contentHeight);

        let top, bottom, left, right;

        if (placement === "auto") {
            //
            if (spaceBelow > 0) {
                //
                top = _top;
                bottom = null;
            } else if (spaceAbove > 0) {
                top = null;
                bottom = _bottom;
            } else {
                //
                top = (containerHeight - contentHeight) / 2;
                bottom = null;
            }
        } else if (placement === "bottom") {
            //
            top = _top;
            bottom = null;
            //
        } else if (placement === "top") {
            //
            top = null;
            bottom = _bottom;
            //
        }

        if (align === "left") {
            left = captionBounds.left - 5;
            right = null;
        } else if (align === "right") {
            left = null;
            // Line the dropdown's right edge up with its caption's.
            right = containerWidth - captionBounds.right;
        } else if (align === "center") {
            const width = contentWidth;
            // Centre the dropdown under the middle of its caption.
            left = width
                ? captionBounds.left +
                  captionBounds.width / 2 -
                  contentWidth / 2
                : captionBounds.left + 5;
            right = null;
        }

        dropdownRef.current.style.top = formatPlacement(
            top,
            5,
            containerHeight - contentHeight - 5
        );

        dropdownRef.current.style.bottom = formatPlacement(
            bottom,
            5,
            containerHeight - contentHeight - 5
        );

        dropdownRef.current.style.left = formatPlacement(
            left,
            5,
            containerWidth - contentWidth - 5
        );

        dropdownRef.current.style.right = formatPlacement(
            right,
            5,
            containerWidth - contentWidth - 5
        );
        //
    }, []);

    // The dropdown mounts in a lazily loaded portal and its content can load
    // after it opens, so place it again whenever it or its caption resizes.
    const [dropdownEl, setDropdownEl] = useState<HTMLDivElement>(null);

    const setDropdownRef = useEventCallback((el: HTMLDivElement) => {
        dropdownRef.current = el;
        if (el) setDropdownEl(el);
        if (typeof addTogglerRef === "function") addTogglerRef(el);
    }, []);

    useIsoLayoutEffect(() => {
        if (!isDropdownShoing || dropdownEl == null) return;
        dropdownEl.style.zIndex = String(zIndexCounter++);
        place();
        const observer =
            typeof ResizeObserver === "undefined"
                ? null
                : new ResizeObserver(() => place());
        observer?.observe(dropdownEl);
        const anchorEl =
            (anchor && captionRef.current?.closest(anchor)) ||
            captionRef.current;
        if (anchorEl) observer?.observe(anchorEl);
        window.addEventListener("resize", place);
        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", place);
        };
    }, [isDropdownShoing, dropdownEl]);

    useEffect(() => {
        //
        if (
            captionRef.current == null ||
            dropdownRef.current == null ||
            !isDropdownShoing
        )
            return;

        document.addEventListener("pointerdown", handleClick, {
            capture: true,
        });

        captionsMap.set(dropdownRef.current, captionRef.current);

        return () => {
            //
            document.removeEventListener("pointerdown", handleClick, {
                capture: true,
            });
        };

        function handleClick(e: MouseEvent) {
            //
            const target = e.target as HTMLElement;

            let toggler = toggleRef ?? captionRef;

            if (
                !autoClose?.current ||
                target === captionRef.current ||
                toggler.current.contains(target) ||
                target === dropdownRef.current ||
                dropdownRef.current.contains(target)
            )
                return;

            const parentDropdown = target.closest(".m-dropdown");

            if (parentDropdown) {
                //
                let caption = captionsMap.get(parentDropdown);

                const t = e.currentTarget;

                if (caption != null && dropdownRef.current.contains(caption))
                    return;
            }
            // console.log("handle doc click", target, parentDropdown);

            toggleDropdown(false);
        }
    }, [captionRef.current, dropdownRef.current, isDropdownShoing]);

    return (
        <>
            <Container
                style={style}
                className={className}
                onKeyDown={(event) => {
                    if (
                        event.key !== "Escape" ||
                        !isDropdownShoing ||
                        !autoClose.current
                    )
                        return;
                    event.preventDefault();
                    event.stopPropagation();
                    toggleDropdown(false);
                    const trigger =
                        toggleRef?.current ??
                        captionRef.current?.querySelector<HTMLElement>(
                            "button, a, [tabindex]"
                        );
                    trigger?.focus();
                }}
            >
                <div ref={captionRef} className="caption" onClick={handleClick}>
                    {typeof caption === "function"
                        ? caption({ toggled: isDropdownShoing })
                        : caption}
                </div>

                <Portal>
                    <DropdownContent
                        data-studio-surface
                        ref={setDropdownRef}
                        className={`m-dropdown m-dropdown m-${className}`}
                        style={
                            !isDropdownShoing
                                ? { display: "none" }
                                : zIndex != null
                                ? { zIndex }
                                : {}
                        }
                    >
                        {isDropdownShoing &&
                            children({ toggle: toggleDropdown, setAutoClose })}
                    </DropdownContent>
                </Portal>
            </Container>
        </>
    );
}

const Container = styled.div``;

const DropdownContent = styled.div`
    position: absolute;
    left: 0;
    top: 0;
`;
