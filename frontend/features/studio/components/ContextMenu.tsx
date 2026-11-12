import { studioMenuItem } from "@features/studio/styles/primitives";
import { useEffect, useState, useRef, ReactNode } from "react";
import { useEventCallback } from "@components/hooks/useEventCallback";
import styled, { css } from "styled-components";
import IconImg from "@ui/components/IconImg";

export interface CMOption<T> {
    value: T;
    title: string;
    icon?: string;
    disabled?: boolean;
}

export interface ContextMenuProps<T> {
    target: HTMLElement;
    options: CMOption<T>[];
    onAction: (value: T) => unknown;
}

export function ContextMenu<T>({
    target,
    options,
    onAction,
}: ContextMenuProps<T>) {
    //
    const [isMenuOn, setMenuOn] = useState(false);

    const menuRef = useRef<HTMLDivElement>(null);

    const [coords, setCoords] = useState({ x: 0, y: 0 });

    const onContextOn = useEventCallback((event: MouseEvent) => {
        //
        if (menuRef.current == null) return;

        if (options?.length) {
            //
            setCoords({ x: event.clientX, y: event.clientY });

            setMenuOn(true);
        }
    }, []);

    useEffect(() => {
        //

        if (!isMenuOn) return;

        const top = coords.y;

        const left = coords.x;

        const contentHeight = menuRef.current.clientHeight;

        const contentWidth = menuRef.current.clientWidth;

        const containerHeight = window.innerHeight;

        const containerWidth = window.innerWidth;

        // console.log("context", top, contentHeight, containerHeight);

        if (top + contentHeight < containerHeight) {
            menuRef.current.style.top = `${top}px`;
        } else {
            menuRef.current.style.top = `${top - contentHeight}px`;
        }

        if (left + contentWidth < containerWidth) {
            menuRef.current.style.left = `${left}px`;
        } else {
            menuRef.current.style.left = `${left - contentWidth}px`;
        }
    }, [isMenuOn, coords]);

    const onClickOutside = useEventCallback((event: MouseEvent) => {
        //
        if (menuRef.current == null) return;

        if ((event.target as any).offsetParent !== menuRef.current) {
            //
            setMenuOn(false);
        }
    }, []);

    const onClickAction = useEventCallback((v: T) => {
        //
        setMenuOn(false);

        onAction(v);
        //
    }, []);

    useEffect(() => {
        //
        if (target == null) return;

        function onContext(e) {
            e.preventDefault();

            setTimeout(() => {
                onContextOn(e);
            }, 100);
        }

        target.addEventListener("contextmenu", onContext);

        document.body.addEventListener("click", onClickOutside);

        return () => {
            //
            target.removeEventListener("contextmenu", onContext);

            document.body.removeEventListener("click", onClickOutside);
        };
    }, [target]);

    return (
        <Menu ref={menuRef} isOn={isMenuOn && !!options?.length}>
            {options?.length &&
                options.map((opt, idx) => {
                    //
                    return (
                        <Option
                            key={idx}
                            disabled={opt.disabled}
                            onClick={() => onClickAction(opt.value)}
                        >
                            <span className="cm-icon">
                                {opt.icon && (
                                    <IconImg
                                        name={opt.icon || ""}
                                        size={14}
                                        style={{ filter: "invert(1)" }}
                                    />
                                )}
                            </span>
                            <span>{opt.title}</span>
                        </Option>
                    );
                })}
        </Menu>
    );
}

const Menu = styled.div<{ isOn: boolean }>`
    position: fixed;
    z-index: 10000;
    min-width: 150px;
    padding: 6px;
    overflow: hidden;
    background: var(--panel-bg);
    border: var(--panel-border);
    box-shadow: var(--panel-shadow);
    border-radius: var(--radius-panel-sm);
    color: var(--panel-text-primary);
    font-size: 13px;
    font-weight: 400;
    transform: scale(0);
    transform-origin: top left;

    ${(props) =>
        props.isOn
            ? css`
                  transform: scale(1);
                  transition: transform 200ms ease-in-out;
              `
            : ""}

    display: ${(props) => (props.isOn ? "flex" : "none")};
    flex-direction: column;
`;

const Option = styled.button.attrs({ type: "button" })<{ disabled?: boolean }>`
    ${studioMenuItem}
    padding: 8px 18px 8px 12px;
    font: 13px/20px var(--studio-font, sans-serif);
    color: var(--panel-text-primary);
    cursor: pointer;

    display: flex;
    gap: 6px;
    align-items: center;

    &:hover {
        background: var(--panel-bg-hover);
    }

    ${(props) =>
        props.disabled
            ? css`
                  pointer-events: none;
                  opacity: 0.3;
              `
            : ""}

    & > .cm-icon {
        flex: 0 0 14px;
    }
`;

export const CMSeparator = styled.div`
    width: 100%;
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
`;
