import React, { useCallback, useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import Icon from "../landing-carousel/components/Icon";
import {
    lobbyPanelTokens,
    lobbyPanelHeading,
    lobbyPanelCard,
    lobbyPanelFooter,
    lobbyPanelIconButton,
} from "./lobbyPanelStyles";

export type LobbyAvatarChoice = {
    id: string;
    name: string;
    url: string;
    img?: string;
    owned?: boolean;
};

type Props = {
    items: LobbyAvatarChoice[];
    selectedId?: string;
    loading?: boolean;
    ownedLoading?: boolean;
    error?: string;
    onSelect: (item: LobbyAvatarChoice) => void;
    onClose: () => void;
};

const prefersReducedMotion = () =>
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Shared avatar cards in a flat grid. Browsing never changes the avatar. */
export default function AvatarCarousel({
    items,
    selectedId,
    loading = false,
    ownedLoading = false,
    error,
    onSelect,
    onClose,
}: Props) {
    const [activeId, setActiveId] = useState(selectedId);
    const [focusedId, setFocusedId] = useState(selectedId);
    const [edges, setEdges] = useState({ start: true, end: false });
    const strip = useRef<HTMLDivElement>(null);
    const cards = useRef(new Map<string, HTMLButtonElement>());
    const closeButton = useRef<HTMLButtonElement>(null);
    const scrollFrame = useRef<number>();
    const mounted = useRef(false);
    const pointer = useRef<{
        id: number;
        x: number;
        left: number;
        moved: boolean;
    }>(null);
    const suppressClick = useRef(false);
    const selectedTargetId =
        items.find((item) => item.id === selectedId)?.id ?? items[0]?.id;
    const focusedIndex = Math.max(
        0,
        items.findIndex((item) => item.id === focusedId)
    );

    const updateScrollState = useCallback(() => {
        scrollFrame.current = undefined;
        const viewport = strip.current;
        if (!viewport) return;
        const width = viewport.clientWidth;
        const left = viewport.scrollLeft;
        const max = Math.max(0, viewport.scrollWidth - width);
        const start = left <= 1;
        const end = left >= max - 1;
        setEdges((previous) =>
            previous.start === start && previous.end === end
                ? previous
                : { start, end }
        );
    }, []);
    const scheduleScrollState = useCallback(() => {
        if (scrollFrame.current === undefined)
            scrollFrame.current = requestAnimationFrame(updateScrollState);
    }, [updateScrollState]);

    const reveal = useCallback((id: string, animate = true, focus = true) => {
        const card = cards.current.get(id);
        const viewport = strip.current;
        if (!card || !viewport) return;
        if (focus) card.focus({ preventScroll: true });
        const inset = 24;
        const left = card.offsetLeft - inset;
        const right = card.offsetLeft + card.offsetWidth + inset;
        const target =
            left < viewport.scrollLeft
                ? left
                : right > viewport.scrollLeft + viewport.clientWidth
                ? right - viewport.clientWidth
                : viewport.scrollLeft;
        viewport.scrollTo?.({
            left: Math.max(0, target),
            behavior: animate && !prefersReducedMotion() ? "smooth" : "auto",
        });
    }, []);

    useEffect(() => {
        setActiveId(selectedId);
        setFocusedId(selectedTargetId);
        if (selectedTargetId)
            reveal(
                mounted.current
                    ? selectedTargetId
                    : items.find((item) => item.owned)?.id || selectedTargetId,
                mounted.current
            );
        else closeButton.current?.focus();
        mounted.current = true;
    }, [selectedId, selectedTargetId, reveal]);

    const firstOwnedId = items.find((item) => item.owned)?.id;
    useEffect(() => {
        if (firstOwnedId) {
            setFocusedId(firstOwnedId);
            reveal(firstOwnedId, false);
        }
    }, [firstOwnedId, reveal]);

    useEffect(() => {
        const viewport = strip.current;
        scheduleScrollState();
        const observer =
            typeof ResizeObserver === "function"
                ? new ResizeObserver(scheduleScrollState)
                : null;
        observer?.observe(viewport);
        window.addEventListener("resize", scheduleScrollState);
        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", scheduleScrollState);
            if (scrollFrame.current !== undefined)
                cancelAnimationFrame(scrollFrame.current);
            scrollFrame.current = undefined;
        };
    }, [items, scheduleScrollState]);

    useEffect(() => {
        const viewport = strip.current;
        const wheel = (event: WheelEvent) => {
            if (
                event.ctrlKey ||
                event.shiftKey ||
                Math.abs(event.deltaX) >= Math.abs(event.deltaY)
            )
                return;
            const units =
                event.deltaMode === 1
                    ? 16
                    : event.deltaMode === 2
                    ? viewport.clientWidth
                    : 1;
            const next = Math.max(
                0,
                Math.min(
                    viewport.scrollWidth - viewport.clientWidth,
                    viewport.scrollLeft + event.deltaY * units
                )
            );
            if (next === viewport.scrollLeft) return;
            event.preventDefault();
            viewport.scrollLeft = next;
        };
        viewport?.addEventListener("wheel", wheel, { passive: false });
        return () => viewport?.removeEventListener("wheel", wheel);
    }, []);

    const select = (index: number) => {
        const item = items[index];
        if (!item) return;
        setActiveId(item.id);
        setFocusedId(item.id);
        reveal(item.id);
        if (item.id !== activeId) onSelect(item);
    };
    const page = (direction: number) => {
        const viewport = strip.current;
        if (!viewport) return;
        // Four columns, including the gap before the next page. Using the
        // viewport keeps fractional card widths aligned on narrow screens.
        // CSS snapping would instead align projected 3D bounds and drift.
        const distance = viewport.clientWidth - 48 + 8;
        viewport.scrollTo?.({
            left: Math.max(
                0,
                Math.min(
                    viewport.scrollWidth - viewport.clientWidth,
                    viewport.scrollLeft + direction * distance
                )
            ),
            behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
    };
    const onKeyDown = (event: React.KeyboardEvent) => {
        if (
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.nativeEvent.isComposing ||
            event.keyCode === 229
        )
            return;
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
            return;
        }
        const index = items.findIndex(
            (item) => cards.current.get(item.id) === event.target
        );
        if (index < 0) return;
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            select(index);
            return;
        }
        const rows =
            Number.parseInt(
                getComputedStyle(strip.current).getPropertyValue(
                    "--avatar-rows"
                ),
                10
            ) || 2;
        let next = index;
        if (event.key === "ArrowRight") {
            if (
                Math.floor(index / rows) < Math.floor((items.length - 1) / rows)
            )
                next += rows;
        } else if (event.key === "ArrowLeft") {
            if (index >= rows) next -= rows;
        } else if (event.key === "ArrowUp") {
            if (index % rows > 0) next--;
        } else if (event.key === "ArrowDown") {
            if (index % rows < rows - 1) next++;
        } else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = items.length - 1;
        else return;
        event.preventDefault();
        event.stopPropagation();
        next = Math.max(0, Math.min(items.length - 1, next));
        setFocusedId(items[next].id);
        reveal(items[next].id);
    };

    const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        suppressClick.current = false;
        if (event.pointerType === "touch" || event.button !== 0) return;
        pointer.current = {
            id: event.pointerId,
            x: event.clientX,
            left: event.currentTarget.scrollLeft,
            moved: false,
        };
    };
    const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = pointer.current;
        if (!drag || drag.id !== event.pointerId) return;
        const distance = drag.x - event.clientX;
        if (!drag.moved && Math.abs(distance) < 5) return;
        drag.moved = true;
        suppressClick.current = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        event.currentTarget.dataset.dragging = "true";
        event.currentTarget.scrollLeft = drag.left + distance;
        event.preventDefault();
    };
    const pointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = pointer.current;
        if (!drag || drag.id !== event.pointerId) return;
        pointer.current = null;
        if (event.currentTarget.hasPointerCapture?.(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        delete event.currentTarget.dataset.dragging;
    };

    return (
        <Shell aria-label="Choose your avatar" onKeyDown={onKeyDown}>
            <div className="avatar-picker">
                {error && (
                    <p className="avatar-error" role="alert">
                        {error}
                    </p>
                )}
                <header className="avatar-heading">
                    <h2>Avatars</h2>
                    <span className="avatar-hint">
                        Scroll to browse · click to choose
                    </span>
                    <nav aria-label="Browse avatars">
                        <button
                            className="arrow"
                            type="button"
                            aria-label="Previous avatars"
                            disabled={edges.start || !items.length}
                            onClick={() => page(-1)}
                        >
                            <Icon name="back" size={16} />
                        </button>
                        <button
                            className="arrow next"
                            type="button"
                            aria-label="Next avatars"
                            disabled={edges.end || !items.length}
                            onClick={() => page(1)}
                        >
                            <Icon name="forward" size={16} />
                        </button>
                    </nav>
                </header>
                <div className="strip-mask">
                    <div
                        className="strip"
                        ref={strip}
                        role="listbox"
                        aria-label="Available avatars"
                        onScroll={scheduleScrollState}
                        onPointerDown={pointerDown}
                        onPointerMove={pointerMove}
                        onPointerUp={pointerEnd}
                        onPointerCancel={pointerEnd}
                        onLostPointerCapture={pointerEnd}
                        onClickCapture={(event) => {
                            if (!suppressClick.current) return;
                            event.preventDefault();
                            event.stopPropagation();
                            suppressClick.current = false;
                        }}
                    >
                        {items.map((item, index) => (
                            <button
                                className="avatar-card"
                                type="button"
                                role="option"
                                aria-label={item.name}
                                aria-selected={item.id === activeId}
                                tabIndex={index === focusedIndex ? 0 : -1}
                                key={item.id}
                                ref={(element) => {
                                    if (element)
                                        cards.current.set(item.id, element);
                                    else cards.current.delete(item.id);
                                }}
                                onFocus={() => setFocusedId(item.id)}
                                onClick={() => select(index)}
                            >
                                <span className="portrait">
                                    {item.img ? (
                                        <img
                                            src={item.img}
                                            alt=""
                                            loading="lazy"
                                            decoding="async"
                                            draggable={false}
                                        />
                                    ) : (
                                        <span className="initial" aria-hidden>
                                            {item.name.slice(0, 1)}
                                        </span>
                                    )}
                                </span>
                                <span className="caption">
                                    <span>{item.name}</span>
                                    <span className="check" aria-hidden>
                                        ✓
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
                <footer>
                    <button
                        ref={closeButton}
                        className="panel-close"
                        type="button"
                        aria-label="Close avatars"
                        onClick={onClose}
                    >
                        <Icon name="close" size={16} />
                    </button>
                    <span
                        className="panel-status"
                        role="status"
                        aria-live="polite"
                    >
                        {(loading || ownedLoading) && (
                            <span className="panel-spinner" aria-hidden />
                        )}
                        <span>
                            {loading ? (
                                "Loading avatar…"
                            ) : ownedLoading ? (
                                "Finding your avatars…"
                            ) : (
                                <>
                                    <strong>
                                        {items.find(
                                            (item) => item.id === activeId
                                        )?.name || "Choose an avatar"}
                                    </strong>
                                    {items.length > 1 &&
                                        ` · ${items.length} avatars`}
                                </>
                            )}
                        </span>
                    </span>
                </footer>
            </div>
        </Shell>
    );
}

const enter = keyframes`
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
`;
const Shell = styled.section`
    ${lobbyPanelTokens}
    --card-width: min(131.4px, calc((100vw - 104px) / 4 * 0.9));
    --avatar-rows: 2;
    position: absolute;
    z-index: 12;
    inset: 0;
    color: #f3f3f1;
    font-family: var(--oc-font, sans-serif);
    pointer-events: none;
    button {
        appearance: none;
        font: inherit;
        color: inherit;
        cursor: pointer;
        border: 0;
        pointer-events: auto;
    }
    button:focus-visible {
        outline: 2px solid var(--oc-accent, #2567ff);
        outline-offset: 2px;
    }
    .avatar-picker {
        position: absolute;
        bottom: max(20px, calc(env(safe-area-inset-bottom) + 8px));
        left: 0;
        right: 0;
        width: min(var(--lobby-panel-width), calc(100% - 32px));
        margin-inline: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
        animation: ${enter} 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .avatar-error {
        margin: 0;
        padding-inline: 16px;
        text-align: center;
        color: #c2c2bd;
        font-size: 12px;
        line-height: 1.5;
    }
    .avatar-heading {
        ${lobbyPanelHeading}
    }
    h2 {
        margin: 0;
        font-size: 12px;
        font-weight: 500;
    }
    .avatar-hint {
        font-size: 11px;
        color: #c2c2bd;
    }
    nav {
        display: flex;
        gap: 4px;
        margin-left: auto;
    }
    .strip-mask {
        overflow: hidden;
        margin-inline: 16px;
        /* Feather only the scrolling cards; headings and controls stay crisp. */
        -webkit-mask-image: linear-gradient(
            to right,
            transparent,
            #000 28px,
            #000 calc(100% - 28px),
            transparent
        );
        mask-image: linear-gradient(
            to right,
            transparent,
            #000 28px,
            #000 calc(100% - 28px),
            transparent
        );
    }
    .strip {
        position: relative;
        width: calc(100% + 32px);
        margin-inline: -16px;
        box-sizing: border-box;
        display: grid;
        grid-auto-flow: column;
        grid-template-rows: repeat(var(--avatar-rows), max-content);
        grid-auto-columns: var(--card-width);
        gap: var(--lobby-panel-gap);
        padding: 16px 24px;
        overflow-x: auto;
        overflow-anchor: none;
        overflow-y: hidden;
        overscroll-behavior-x: contain;
        scroll-padding-inline: 24px;
        scrollbar-width: none;
        touch-action: pan-x;
        cursor: grab;
        pointer-events: auto;
    }
    .strip::-webkit-scrollbar {
        display: none;
    }
    .strip[data-dragging],
    .strip[data-dragging] .avatar-card {
        cursor: grabbing;
    }
    .avatar-card {
        ${lobbyPanelCard}
        position: relative;
        box-sizing: border-box;
        min-width: 0;
        padding: 0;
        overflow: hidden;
        border: 1px solid #ffffff2e;
        border-radius: 12px;
        transition: border-color 120ms;
        user-select: none;
    }
    .avatar-card:hover,
    .avatar-card:focus-visible {
        border-color: #ffffff66;
    }
    .avatar-card:focus-visible {
        outline-offset: 1px;
    }
    .avatar-card[aria-selected="true"] {
        border-color: #ffffff99;
    }
    .avatar-card[aria-selected="true"]::before {
        border-top-color: #ffffff66;
        border-left-color: #ffffff3d;
    }
    .portrait {
        display: grid;
        place-items: center;
        width: 100%;
        aspect-ratio: 128 / 78;
        overflow: hidden;
        border-radius: 12px 12px 0 0;
        background: transparent;
    }
    .portrait img {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }
    .initial {
        font-size: 26px;
        color: #f3f3f1;
    }
    .caption {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        padding: 6.4px 7.2px;
        border-radius: 0 0 12px 12px;
        background: linear-gradient(180deg, #0a0d1200, #0a0d1238);
        box-shadow: inset 0 1px 0 #ffffff0a;
        font-family: var(--oc-mono, "SFMono-Regular", monospace);
        font-size: 11px;
        letter-spacing: -0.02em;
        line-height: 16px;
        text-align: left;
    }
    .caption > span:first-child {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        flex: 1;
    }
    .check {
        display: grid;
        place-items: center;
        flex: 0 0 14px;
        height: 14px;
        border: 1px solid #ffffff26;
        border-radius: 4px;
        font-size: 10px;
        color: transparent;
    }
    [aria-selected="true"] .check {
        background: #e8e9ec;
        color: #15171c;
    }
    .arrow {
        ${lobbyPanelIconButton}
    }
    footer {
        ${lobbyPanelFooter}
    }
    @media (max-width: 540px) {
        .avatar-hint {
            display: none;
        }
        .arrow {
            width: 44px;
            height: 44px;
        }
        footer {
            height: 44px;
        }
    }
    @media (max-height: 540px) {
        .avatar-picker {
            gap: 4px;
        }
        .portrait {
            height: clamp(28.8px, calc((100dvh - 240px) / 2 * 0.9), 70.2px);
            aspect-ratio: auto;
        }
        .strip {
            padding-block: 8px;
        }
    }
    @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
            animation: none;
            transition: none;
        }
    }
`;
