import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import Icon from "../landing-carousel/components/Icon";
import { avatarThumb, warmAvatarThumbs } from "./avatarThumb";
import useClickAway from "./useClickAway";
import { baseTokens as base, lobbyTokens as lobby } from "@styles/tokens";
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
    /** Shown on the Owned tab when the visitor has nothing there. */
    ownedHint?: string;
    error?: string;
    onSelect: (item: LobbyAvatarChoice) => void;
    onClose: () => void;
};

export type AvatarTab = "free" | "owned";
const TABS: { id: AvatarTab; label: string }[] = [
    { id: "free", label: "Free" },
    { id: "owned", label: "Owned" },
];
const tabOf = (item: LobbyAvatarChoice): AvatarTab =>
    item.owned ? "owned" : "free";
/** A phone shows four columns; this many avatars or fewer take one row. */
const COLUMNS = 4;
/** Up to seven columns of two rows are on screen; the next page follows. */
const FIRST_SCREEN = 14;
const EAGER = FIRST_SCREEN * 2;

const prefersReducedMotion = () =>
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A card's picture. It asks for the card-sized copy first, falls back to the
 * original if the host refuses to resize it, and to the initial if neither
 * loads. The first screens load at once; the rest wait until they are near.
 */
function Portrait({ item, index }: { item: LobbyAvatarChoice; index: number }) {
    const thumb = avatarThumb(item.img);
    const sources = thumb && thumb !== item.img ? [thumb, item.img] : [thumb];
    const [attempt, setAttempt] = useState(0);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        setAttempt(0);
        setLoaded(false);
    }, [item.img]);
    const src = sources[attempt];
    return (
        <span className="portrait" data-pending={!!src && !loaded}>
            {src ? (
                <img
                    key={src}
                    ref={(image) => {
                        // A picture already in the cache never fires "load".
                        if (image?.complete && image.naturalWidth)
                            setLoaded(true);
                    }}
                    src={src}
                    alt=""
                    loading={index < EAGER ? "eager" : "lazy"}
                    // React 18 only passes the lowercase spelling through.
                    {...(index < FIRST_SCREEN ? { fetchpriority: "high" } : {})}
                    decoding="async"
                    draggable={false}
                    data-loaded={loaded}
                    onLoad={() => setLoaded(true)}
                    onError={() => setAttempt((value) => value + 1)}
                />
            ) : (
                <span className="initial" aria-hidden>
                    {item.name.slice(0, 1)}
                </span>
            )}
        </span>
    );
}

/**
 * Shared avatar cards in a flat grid, split into the free catalog and the
 * visitor's own avatars. Browsing never changes the avatar.
 */
export default function AvatarCarousel({
    items: allItems,
    selectedId,
    loading = false,
    ownedLoading = false,
    ownedHint = "Avatars you upload or hold in your wallet show up here.",
    error,
    onSelect,
    onClose,
}: Props) {
    const selected = allItems.find((item) => item.id === selectedId);
    const selectedTab = selected ? tabOf(selected) : undefined;
    const [tab, setTab] = useState<AvatarTab>(selectedTab || "free");
    // Once the visitor picks a tab it stays theirs; until then the picker
    // opens on the tab holding the avatar they wear, which for a wallet
    // avatar is only known when the wallet has loaded.
    const tabChosen = useRef(false);
    const shownTab = useRef(tab);
    const tabs = useRef(new Map<AvatarTab, HTMLButtonElement>());
    const ids = useId();
    const [query, setQuery] = useState("");
    const needle = query.trim().toLowerCase();
    const matches = (item: LobbyAvatarChoice) =>
        !needle || item.name.toLowerCase().includes(needle);
    const items = allItems.filter(
        (item) => tabOf(item) === tab && matches(item)
    );
    // What the search would find behind the other label.
    const elsewhere = needle
        ? allItems.filter((item) => tabOf(item) !== tab && matches(item)).length
        : 0;
    const picker = useRef<HTMLDivElement>(null);
    const search = useRef<HTMLInputElement>(null);
    const close = useRef(onClose);
    close.current = onClose;
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
        if (selectedTab && !tabChosen.current) setTab(selectedTab);
    }, [selectedTab]);

    useEffect(() => {
        setActiveId(selectedId);
        setFocusedId(selectedTargetId);
        // Switching tabs keeps the keyboard on the tab; the cards only
        // scroll to the worn avatar, or back to the start.
        const switched = shownTab.current !== tab && tabChosen.current;
        shownTab.current = tab;
        // Typing a search or stepping along the labels keeps the keyboard
        // where it is; the cards only scroll.
        const busy =
            document.activeElement === search.current ||
            Array.from(tabs.current.values()).includes(
                document.activeElement as HTMLButtonElement
            );
        const focus = !switched && !busy;
        if (selectedTargetId)
            reveal(selectedTargetId, mounted.current && !switched, focus);
        else if (focus) closeButton.current?.focus();
        mounted.current = true;
    }, [selectedId, selectedTargetId, tab, reveal]);

    // The other tab's first screen is fetched while this one is read, so
    // switching shows pictures, not empty cards.
    const otherTabPictures = allItems
        .filter((item) => tabOf(item) !== tab)
        .slice(0, FIRST_SCREEN)
        .map((item) => item.img)
        .join("\n");
    useEffect(() => {
        if (otherTabPictures) warmAvatarThumbs(otherTabPictures.split("\n"));
    }, [otherTabPictures]);

    useClickAway(
        true,
        () => [picker.current],
        () => close.current()
    );

    const chooseTab = (next: AvatarTab, focus = false) => {
        tabChosen.current = true;
        setTab(next);
        if (focus) tabs.current.get(next)?.focus();
    };
    const onTabKeyDown = (event: React.KeyboardEvent, id: AvatarTab) => {
        if (
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.nativeEvent.isComposing ||
            event.keyCode === 229
        )
            return;
        const index = TABS.findIndex((entry) => entry.id === id);
        let next = index;
        if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
        else if (event.key === "ArrowLeft")
            next = (index - 1 + TABS.length) % TABS.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = TABS.length - 1;
        else if (event.key === "ArrowDown") {
            const card = cards.current.get(focusedId);
            if (!card) return;
            event.preventDefault();
            event.stopPropagation();
            card.focus({ preventScroll: true });
            return;
        } else return;
        // The world behind the picker also listens for arrow keys.
        event.preventDefault();
        event.stopPropagation();
        chooseTab(TABS[next].id, true);
    };

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
        if (event.key === "/" && event.target !== search.current) {
            event.preventDefault();
            event.stopPropagation();
            search.current?.focus();
            search.current?.select();
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
            <div className="avatar-picker" ref={picker}>
                {error && (
                    <p className="avatar-error" role="alert">
                        {error}
                    </p>
                )}
                <header className="avatar-heading">
                    <h2 className="avatar-title">Avatars</h2>
                    <div
                        className="avatar-tabs"
                        role="tablist"
                        aria-label="Avatars to show"
                    >
                        {TABS.map(({ id, label }) => (
                            <button
                                key={id}
                                ref={(element) => {
                                    if (element) tabs.current.set(id, element);
                                    else tabs.current.delete(id);
                                }}
                                id={`${ids}tab-${id}`}
                                type="button"
                                role="tab"
                                aria-selected={tab === id}
                                aria-controls={`${ids}panel`}
                                tabIndex={tab === id ? 0 : -1}
                                onClick={() => chooseTab(id)}
                                onKeyDown={(event) => onTabKeyDown(event, id)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
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
                <div
                    className="strip-mask"
                    id={`${ids}panel`}
                    role="tabpanel"
                    aria-labelledby={`${ids}tab-${tab}`}
                >
                    {!items.length && (needle || tab === "owned") && (
                        <p className="avatar-empty">
                            {needle
                                ? `No ${tab} avatars match “${query.trim()}”.${
                                      elsewhere
                                          ? ` ${elsewhere} in ${
                                                tab === "owned"
                                                    ? "Free"
                                                    : "Owned"
                                            }.`
                                          : ""
                                  }`
                                : ownedLoading
                                ? "Finding your avatars…"
                                : ownedHint}
                        </p>
                    )}
                    <div
                        className="strip"
                        hidden={!items.length && (!!needle || tab === "owned")}
                        // A handful of avatars reads left to right on one
                        // row; the panel keeps its two-row height.
                        style={
                            items.length <= COLUMNS
                                ? ({
                                      "--avatar-rows": 1,
                                  } as React.CSSProperties)
                                : undefined
                        }
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
                                <Portrait item={item} index={index} />
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
                    <span className="search-mark" aria-hidden>
                        <Icon name="search" size={18} />
                    </span>
                    <form
                        role="search"
                        aria-label="Search avatars"
                        onSubmit={(event) => event.preventDefault()}
                    >
                        <input
                            ref={search}
                            type="search"
                            aria-label="Search avatars by name"
                            placeholder="Search avatars…"
                            enterKeyHint="search"
                            autoComplete="off"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={(event) => {
                                if (
                                    event.nativeEvent.isComposing ||
                                    event.keyCode === 229
                                )
                                    return;
                                if (event.key === "Escape" && query) {
                                    // The first Escape empties the field;
                                    // the next one closes the picker.
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setQuery("");
                                } else if (event.key === "ArrowDown") {
                                    const card = cards.current.get(
                                        items.find(
                                            (item) => item.id === focusedId
                                        )?.id ?? items[0]?.id
                                    );
                                    if (!card) return;
                                    event.preventDefault();
                                    event.stopPropagation();
                                    card.focus({ preventScroll: true });
                                }
                            }}
                        />
                        {query ? (
                            <button
                                type="button"
                                className="search-clear"
                                aria-label="Clear avatar search"
                                onClick={() => {
                                    setQuery("");
                                    search.current?.focus();
                                }}
                            >
                                <Icon name="close" size={14} />
                            </button>
                        ) : (
                            <kbd aria-hidden="true">/</kbd>
                        )}
                    </form>
                    <span
                        className="panel-status"
                        role="status"
                        aria-live="polite"
                        data-busy={loading || ownedLoading || undefined}
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
                                        {allItems.find(
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
    /* 89 px on a desktop, where six columns show; four share a phone. */
    --card-width: min(89.4px, calc((100vw - 104px) / 4 * 0.9));
    --avatar-rows: 2;
    /* A card is its picture, a 28.8 px caption and its border. Naming the
       heights keeps the panel the same size on both tabs, however many
       avatars each holds, so the tabs never move under the pointer. */
    --portrait-height: calc((var(--card-width) - 2px) * 78 / 128);
    --strip-padding: 16px;
    --strip-height: calc(
        var(--avatar-rows) * (var(--portrait-height) + 30.8px) +
            (var(--avatar-rows) - 1) * var(--lobby-panel-gap) + 2 *
            var(--strip-padding)
    );
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
    /* The tabs name the panel on screen; the heading stays for readers. */
    .avatar-title {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
    }
    /* Two plain labels in the middle of the heading; the hint sits to
       their left and the page arrows to their right. */
    .avatar-heading {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    }
    .avatar-hint {
        grid-area: 1 / 1;
        justify-self: start;
    }
    .avatar-heading nav {
        grid-area: 1 / 3;
        justify-self: end;
    }
    .avatar-tabs {
        grid-area: 1 / 2;
        position: relative;
        isolation: isolate;
        display: flex;
        gap: 4px;
    }
    /* The chat's soft wash, so the labels read over a bright world. It
       fades out all round and has no edge. */
    .avatar-tabs::before {
        content: "";
        position: absolute;
        inset: -10px -36px;
        z-index: -1;
        pointer-events: none;
        background: ${lobby.panel.labelWash};
    }
    .avatar-tabs [role="tab"] {
        position: relative;
        height: 32px;
        padding: 0 12px;
        border-radius: ${lobby.panel.iconRadius}px;
        background: transparent;
        color: ${base.color.muted};
        font-size: 13px;
        font-weight: 500;
        line-height: 20px;
        text-shadow: ${lobby.glass.textShadow};
        transition: color ${base.motion.fast}ms ease;
    }
    .avatar-tabs [role="tab"]:hover {
        color: ${lobby.color.secondary};
    }
    .avatar-tabs [role="tab"][aria-selected="true"] {
        color: ${lobby.color.ink};
    }
    /* A short line marks the current label; nothing is filled or boxed. */
    .avatar-tabs [role="tab"]::after {
        content: "";
        position: absolute;
        left: 50%;
        bottom: 3px;
        width: 14px;
        height: 1.5px;
        border-radius: 1px;
        background: ${lobby.color.ink};
        opacity: 0;
        transform: translateX(-50%) scaleX(0.4);
        transition: opacity ${base.motion.fast}ms ease,
            transform ${base.motion.fast}ms ease;
    }
    .avatar-tabs [role="tab"][aria-selected="true"]::after {
        opacity: 1;
        transform: translateX(-50%);
    }
    .avatar-empty {
        display: grid;
        place-items: center;
        box-sizing: border-box;
        height: var(--strip-height);
        margin: 0;
        padding: 16px 40px;
        text-align: center;
        color: ${lobby.color.secondary};
        font-size: 12px;
        line-height: 1.5;
        text-shadow: ${lobby.glass.textShadow};
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
        min-height: var(--strip-height);
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
        padding: var(--strip-padding) 24px;
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
    .strip[hidden] {
        display: none;
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
        height: var(--portrait-height);
        overflow: hidden;
        border-radius: 12px 12px 0 0;
        background: transparent;
    }
    .portrait img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        opacity: 0;
        transition: opacity ${base.motion.fast}ms ease;
    }
    .portrait img[data-loaded="true"] {
        opacity: 1;
    }
    /* A quiet block holds the picture's place until it arrives. */
    .portrait[data-pending="true"] {
        background: ${base.color.line.faint};
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
    /* The same bar as the worlds search: close, the search mark, the
       field, then its key hint. */
    footer {
        ${lobbyPanelFooter}
        width: min(${lobby.panel.searchWidth}px, 100%);
    }
    .search-mark {
        display: grid;
        place-items: center;
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        color: ${lobby.color.secondary};
    }
    footer form {
        display: flex;
        align-items: center;
        flex: 1;
        gap: 8px;
        min-width: 0;
        height: 100%;
        color: ${base.color.muted};
    }
    footer input {
        width: 100%;
        min-width: 0;
        padding: 0;
        border: 0;
        background: none;
        color: ${lobby.color.ink};
        font: inherit;
        font-size: 14px;
        line-height: 20px;
        text-overflow: ellipsis;
        outline: none;
        pointer-events: auto;
    }
    footer input::placeholder {
        color: ${base.color.muted};
    }
    footer input::-webkit-search-cancel-button {
        display: none;
    }
    footer kbd {
        flex-shrink: 0;
        padding: 1px 5px;
        border: 1px solid ${base.color.line.subtle};
        border-radius: 5px;
        font-family: var(--oc-mono, "SFMono-Regular", monospace);
        font-size: 11px;
    }
    .search-clear {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 30px;
        height: 30px;
        padding: 0;
        border-radius: 9px;
        background: none;
        color: ${base.color.muted};
    }
    .search-clear:hover {
        background: ${base.color.line.faint};
        color: ${lobby.color.ink};
    }
    /* The status line is for screen readers, and shows only while
       something is loading. */
    footer .panel-status {
        flex: 0 0 auto;
        padding: 0 6px 0 0;
    }
    footer .panel-status:not([data-busy]) {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
    }
    /* On a touch screen a tap puts the avatar on and the brighter border
       says which one is worn; there is no box to tick. */
    @media (max-width: 540px), (hover: none) and (pointer: coarse) {
        .check {
            display: none;
        }
    }
    @media (max-width: 540px) {
        .avatar-hint {
            display: none;
        }
        .avatar-tabs [role="tab"] {
            height: 44px;
        }
        .avatar-tabs [role="tab"]::after {
            bottom: 8px;
        }
        .arrow {
            width: 44px;
            height: 44px;
        }
        footer {
            height: 44px;
        }
        footer input {
            /* Below 16 px, iOS zooms the page into a focused field. */
            font-size: 16px;
        }
        footer kbd,
        footer .panel-status > span:not(.panel-spinner) {
            display: none;
        }
    }
    @media (max-height: 540px) {
        .avatar-picker {
            gap: 4px;
        }
        --portrait-height: clamp(
            28.8px,
            calc((100dvh - 240px) / 2 * 0.9),
            70.2px
        );
        --strip-padding: 8px;
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
