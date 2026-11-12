import React, { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import {
    lobbyPanelTokens,
    lobbyPanelHeading,
    lobbyPanelCard,
    lobbyPanelFooter,
    lobbyPanelIconButton,
} from "./lobbyPanelStyles";
import Icon from "../landing-carousel/components/Icon";
import EmotePosePreview from "./EmotePosePreview";
import { NativePanelFrame } from "@features/content-host/NativeVisitorPanel";
import { isSelectableEmote, useEmoteShortcuts } from "./emoteShortcuts";

export type EmotePanelProps = {
    id?: string;
    mobile?: boolean;
    items: readonly { name: string }[];
    onSelect: (index: number, name: string) => void;
    onStop?: () => void;
    onClose: () => void;
    panelRef?: React.Ref<HTMLElement>;
    returnFocusRef?: { current: HTMLElement | null };
};

const DRAG_TYPE = "application/x-oncyber-emote";
// One two-row grid filled column by column: shortcuts 1–9 come first, so the
// first unassigned move sits directly under 9 and the rest follow.
const ROWS = 2;
const labelFor = (name: string) => {
    const labels: Record<string, string> = {
        WAVING: "Wave",
        HIPHOP: "Hip hop",
        CHAABI2: "Chaabi 2",
        WANNAROCK: "Wanna rock",
        FLOORSITTING: "Floor sitting",
    };
    return (
        labels[name.toUpperCase()] ||
        name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
    );
};

export default function EmotePanel({
    id = "emote-panel",
    mobile = false,
    items,
    onSelect,
    onStop,
    onClose,
    panelRef,
    returnFocusRef,
}: EmotePanelProps) {
    const { shortcuts, assignShortcut } = useEmoteShortcuts();
    const available = items
        .map((item, index) => ({ ...item, index }))
        .filter((item) => isSelectableEmote(item.name));
    // The lower row only lists moves that are not already on a shortcut.
    const library = available.filter((item) => !shortcuts.includes(item.name));
    const panel = useRef<HTMLElement>(null);
    const rail = useRef<HTMLDivElement>(null);
    const buttons = useRef<HTMLButtonElement[]>([]);
    const slotButtons = useRef<HTMLButtonElement[]>([]);
    const dragName = useRef<string | null>(null);
    const [selected, setSelected] = useState(0);
    const [selectedSlot, setSelectedSlot] = useState(0);
    const [hovered, setHovered] = useState<string | null>(null);
    const [focused, setFocused] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<number | null>(null);
    const [assigning, setAssigning] = useState(false);
    const [pending, setPending] = useState<string | null>(null);
    const [announcement, setAnnouncement] = useState("");
    const focusItem = (
        index: number,
        row: "library" | "shortcuts" = "library"
    ) => {
        const next = Math.max(
            0,
            Math.min(
                (row === "library" ? library.length : shortcuts.length) - 1,
                index
            )
        );
        const target = (row === "library" ? buttons : slotButtons).current[
            next
        ];
        if (row === "library") setSelected(next);
        else setSelectedSlot(next);
        target?.focus({ preventScroll: true });
        const viewport = rail.current;
        if (!target || !viewport) return;
        // Reveal using layout bounds, not the perspective-projected rectangle.
        const left = target.offsetLeft - 8;
        const right = target.offsetLeft + target.offsetWidth + 8;
        const nextLeft =
            left < viewport.scrollLeft
                ? left
                : right > viewport.scrollLeft + viewport.clientWidth
                ? right - viewport.clientWidth
                : viewport.scrollLeft;
        viewport.scrollLeft = Math.max(0, nextLeft);
    };
    const play = (name: string) => {
        const item = available.find((item) => item.name === name);
        if (item) onSelect(item.index, item.name);
    };
    const assign = (slot: number, name: string) => {
        if (!available.some((item) => item.name === name)) return;
        const previous = shortcuts[slot];
        const from = shortcuts.indexOf(name);
        assignShortcut(slot, name);
        setPending(null);
        setDropTarget(null);
        setAnnouncement(
            from >= 0 && from !== slot
                ? `${labelFor(name)} is shortcut ${slot + 1}. ${labelFor(
                      previous
                  )} moved to shortcut ${from + 1}.`
                : `${labelFor(name)} is shortcut ${slot + 1}.`
        );
    };
    const dragStart = (
        event: React.DragEvent<HTMLButtonElement>,
        name: string
    ) => {
        dragName.current = name;
        event.dataTransfer.effectAllowed = "copyMove";
        event.dataTransfer.setData(DRAG_TYPE, name);
        event.dataTransfer.setData("text/plain", name);
    };
    const dragEnd = () => {
        dragName.current = null;
        setDropTarget(null);
    };
    const navigate = (
        event: React.KeyboardEvent<HTMLButtonElement>,
        index: number,
        row: "library" | "shortcuts"
    ) => {
        if (
            event.nativeEvent.isComposing ||
            event.keyCode === 229 ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            event.shiftKey
        )
            return;
        // Shortcuts and library are one sequence laid out column by column.
        const total = shortcuts.length + library.length;
        const position = row === "library" ? shortcuts.length + index : index;
        let next = position;
        if (event.key === "ArrowRight") next += ROWS;
        else if (event.key === "ArrowLeft") next -= ROWS;
        else if (event.key === "ArrowDown") {
            if (position % ROWS < ROWS - 1) next++;
        } else if (event.key === "ArrowUp") {
            if (position % ROWS > 0) next--;
        } else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = total - 1;
        else return;
        if (next < 0 || next >= total) next = position;
        const nextRow = next < shortcuts.length ? "shortcuts" : "library";
        if (nextRow === "library") next -= shortcuts.length;
        event.preventDefault();
        event.stopPropagation();
        focusItem(next, nextRow);
    };
    const preview = (name: string, key: string) => (
        <>
            <span className="animation-pose">
                <EmotePosePreview
                    name={name}
                    active={
                        hovered !== null ? hovered === key : focused === key
                    }
                />
            </span>
            <span className="animation-name">{labelFor(name)}</span>
        </>
    );

    useEffect(() => {
        const element = panel.current;
        const opener =
            returnFocusRef?.current || (document.activeElement as HTMLElement);
        buttons.current[0]?.focus({ preventScroll: true });
        return () => {
            const restore =
                !document.activeElement ||
                document.activeElement === document.body ||
                element?.contains(document.activeElement);
            if (restore)
                queueMicrotask(() => {
                    if (
                        opener?.isConnected &&
                        (!document.activeElement ||
                            document.activeElement === document.body)
                    )
                        opener.focus({ preventScroll: true });
                });
        };
    }, []);

    useEffect(() => {
        // Assigning a shortcut shrinks the lower row; keep its tab stop valid.
        if (mobile) return;
        buttons.current.length = library.length;
        if (selected > 0 && selected >= library.length)
            setSelected(Math.max(0, library.length - 1));
    }, [library.length, selected, mobile]);

    if (mobile)
        return (
            <PhonePanel
                id={id}
                ref={(element) => {
                    panel.current = element;
                    if (typeof panelRef === "function") panelRef(element);
                    else if (panelRef)
                        (
                            panelRef as React.MutableRefObject<HTMLElement>
                        ).current = element;
                }}
                role="dialog"
                aria-label="Animations"
                onPointerDown={(event) => event.stopPropagation()}
                onTouchMove={(event) => event.stopPropagation()}
                onWheel={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                    event.stopPropagation();
                    if (
                        event.key === "Escape" &&
                        !event.nativeEvent.isComposing
                    ) {
                        event.preventDefault();
                        onClose();
                    }
                }}
            >
                <div className="native-panel-heading">
                    <h2>Animations</h2>
                    <button
                        type="button"
                        aria-label="Close animations"
                        onClick={onClose}
                    >
                        <Icon name="close" size={16} />
                    </button>
                </div>
                <div className="native-panel-body">
                    <div
                        className="phone-animation-grid"
                        role="group"
                        aria-label="Animations"
                    >
                        {available.map((item, index) => {
                            const key = `phone:${item.name}`;
                            return (
                                <button
                                    type="button"
                                    key={item.name}
                                    ref={(element) => {
                                        buttons.current[index] = element;
                                    }}
                                    aria-label={`Play ${labelFor(item.name)}`}
                                    onFocus={() => setFocused(key)}
                                    onBlur={() => setFocused(null)}
                                    onClick={() => play(item.name)}
                                >
                                    {preview(item.name, key)}
                                </button>
                            );
                        })}
                    </div>
                </div>
                {onStop && (
                    <div className="phone-animation-footer">
                        <button type="button" onClick={onStop}>
                            Stop animation
                        </button>
                    </div>
                )}
            </PhonePanel>
        );

    return (
        <Panel
            id={id}
            ref={(element) => {
                panel.current = element;
                if (typeof panelRef === "function") panelRef(element);
                else if (panelRef)
                    (panelRef as React.MutableRefObject<HTMLElement>).current =
                        element;
            }}
            role="dialog"
            aria-label="Animations"
            aria-describedby={`${id}-instructions`}
            onKeyDown={(event) => {
                if (
                    event.nativeEvent.isComposing ||
                    event.keyCode === 229 ||
                    event.ctrlKey ||
                    event.metaKey ||
                    event.altKey
                )
                    return;
                if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    if (dragName.current) {
                        dragEnd();
                        setAnnouncement("Shortcut drag cancelled.");
                    } else if (assigning) {
                        setAssigning(false);
                        setPending(null);
                        setAnnouncement("Shortcut assignment cancelled.");
                    } else onClose();
                    return;
                }
                const digit =
                    event.code?.match(/^Digit([1-9])$/)?.[1] ||
                    event.key.match(/^[1-9]$/)?.[0];
                if (!digit) return;
                const slot = Number(digit) - 1;
                const source = (
                    event.target as HTMLElement
                ).closest<HTMLElement>("[data-emote-library]");
                event.preventDefault();
                event.stopPropagation();
                if (event.shiftKey) {
                    if (!source) return;
                    assign(slot, source.dataset.emoteName);
                    // The move leaves the lower row, so follow it up to its slot.
                    focusItem(slot, "shortcuts");
                } else play(shortcuts[slot]);
            }}
        >
            <div className="animation-heading">
                <h2>Animations</h2>
                <span
                    className="animation-instructions"
                    id={`${id}-instructions`}
                >
                    Drag a move onto 1–9 · Shift + 1–9 to assign
                </span>
                <div
                    className="animation-navigation"
                    role="group"
                    aria-label="Browse animations"
                >
                    <button
                        type="button"
                        className="animation-icon"
                        aria-label="Previous animations"
                        disabled={selected === 0}
                        onClick={() => focusItem(selected - 1)}
                    >
                        <Icon name="back" size={16} />
                    </button>
                    <button
                        type="button"
                        className="animation-icon"
                        aria-label="Next animations"
                        disabled={selected >= library.length - 1}
                        onClick={() => focusItem(selected + 1)}
                    >
                        <Icon name="forward" size={16} />
                    </button>
                </div>
            </div>
            <div className="animation-content">
                <div
                    className="animation-grid"
                    ref={rail}
                    role="group"
                    aria-label="Animations"
                >
                    {shortcuts.map((name, slot) => {
                        const key = `shortcut:${slot}`;
                        return (
                            <button
                                type="button"
                                className="animation-tile"
                                key={slot}
                                ref={(element) => {
                                    slotButtons.current[slot] = element;
                                }}
                                data-shortcut-slot={slot}
                                data-drop-target={
                                    dropTarget === slot || undefined
                                }
                                data-emote-name={name}
                                draggable={true}
                                tabIndex={selectedSlot === slot ? 0 : -1}
                                disabled={
                                    !available.some(
                                        (item) => item.name === name
                                    )
                                }
                                aria-label={`Shortcut ${slot + 1}: ${labelFor(
                                    name
                                )}${
                                    assigning && pending
                                        ? `. Assign ${labelFor(pending)} here`
                                        : ""
                                }`}
                                aria-keyshortcuts={String(slot + 1)}
                                onDragStart={(event) => dragStart(event, name)}
                                onDragEnd={dragEnd}
                                onDragOver={(event) => {
                                    if (
                                        !dragName.current &&
                                        !Array.from(
                                            event.dataTransfer.types
                                        ).some(
                                            (type) =>
                                                type === DRAG_TYPE ||
                                                type === "text/plain"
                                        )
                                    )
                                        return;
                                    event.preventDefault();
                                    event.dataTransfer.dropEffect = "move";
                                    setDropTarget(slot);
                                }}
                                onDragLeave={(event) => {
                                    if (
                                        !event.currentTarget.contains(
                                            event.relatedTarget as Node
                                        )
                                    )
                                        setDropTarget(null);
                                }}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    const name =
                                        event.dataTransfer.getData(DRAG_TYPE) ||
                                        event.dataTransfer.getData(
                                            "text/plain"
                                        ) ||
                                        dragName.current;
                                    if (name) assign(slot, name);
                                    dragEnd();
                                }}
                                onMouseEnter={() => setHovered(key)}
                                onMouseLeave={() => setHovered(null)}
                                onFocus={() => {
                                    setHovered(null);
                                    setSelectedSlot(slot);
                                    setFocused(key);
                                }}
                                onBlur={() => setFocused(null)}
                                onKeyDown={(event) =>
                                    navigate(event, slot, "shortcuts")
                                }
                                onClick={() => {
                                    if (assigning) {
                                        if (pending) assign(slot, pending);
                                        else
                                            setAnnouncement(
                                                "Choose an animation from the row below, then tap a shortcut."
                                            );
                                    } else play(name);
                                }}
                            >
                                {preview(name, key)}
                                <kbd aria-hidden="true">{slot + 1}</kbd>
                            </button>
                        );
                    })}
                    {library.map((item, position) => {
                        const key = `library:${item.name}`;
                        return (
                            <button
                                type="button"
                                className="animation-tile"
                                key={item.name}
                                ref={(element) => {
                                    buttons.current[position] = element;
                                }}
                                data-emote-index={item.index}
                                data-emote-name={item.name}
                                data-emote-library={true}
                                data-pending={
                                    pending === item.name || undefined
                                }
                                draggable={true}
                                tabIndex={position === selected ? 0 : -1}
                                aria-label={
                                    assigning
                                        ? `Choose ${labelFor(
                                              item.name
                                          )} for a shortcut`
                                        : `Play ${labelFor(item.name)}`
                                }
                                onDragStart={(event) =>
                                    dragStart(event, item.name)
                                }
                                onDragEnd={dragEnd}
                                onMouseEnter={() => setHovered(key)}
                                onMouseLeave={() => setHovered(null)}
                                onFocus={() => {
                                    setHovered(null);
                                    setSelected(position);
                                    setFocused(key);
                                }}
                                onBlur={() => setFocused(null)}
                                onKeyDown={(event) =>
                                    navigate(event, position, "library")
                                }
                                onClick={() => {
                                    if (assigning) {
                                        setPending(item.name);
                                        setAnnouncement(
                                            `${labelFor(
                                                item.name
                                            )} selected. Tap a shortcut from 1 to 9.`
                                        );
                                    } else play(item.name);
                                }}
                            >
                                {preview(item.name, key)}
                            </button>
                        );
                    })}
                </div>
            </div>
            <p className="animation-sr-only" role="status" aria-live="polite">
                {announcement}
            </p>
            <ControlBar>
                <button
                    type="button"
                    className="panel-close"
                    aria-label="Close animations"
                    onClick={onClose}
                >
                    <Icon name="close" size={16} />
                </button>
                <span className="panel-status">
                    <span>
                        {assigning
                            ? pending
                                ? "Tap a shortcut"
                                : "Pick a move"
                            : "Drag onto 1–9"}
                    </span>
                </span>
                <button
                    type="button"
                    className="panel-action"
                    aria-label="Assign animation shortcuts"
                    aria-pressed={assigning}
                    onClick={() => {
                        setAssigning(!assigning);
                        setPending(null);
                    }}
                >
                    {assigning ? "Done" : "Assign"}
                </button>
                {onStop && (
                    <button
                        type="button"
                        className="panel-action"
                        onClick={onStop}
                    >
                        Stop animation
                    </button>
                )}
            </ControlBar>
        </Panel>
    );
}

const Panel = styled.section`
    ${lobbyPanelTokens}
    --animation-grid-height: clamp(172px, 26svh, 204px);
    --animation-tile-width: 64px;
    position: absolute;
    z-index: 7;
    left: 50%;
    bottom: 0;
    width: min(var(--lobby-panel-width), calc(100vw - 32px));
    max-height: calc(100dvh - 116px - env(safe-area-inset-bottom));
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none;
    color: #f3f3f1;
    font-family: var(--oc-font);
    text-shadow: none;
    animation: animations-arrive 220ms cubic-bezier(0.22, 1, 0.36, 1);
    @keyframes animations-arrive {
        from {
            opacity: 0;
            transform: translate(-50%, 8px);
        }
        to {
            opacity: 1;
            transform: translate(-50%, 0);
        }
    }
    button {
        color: inherit;
        font: inherit;
        cursor: pointer;
        border: 0;
        background: none;
    }
    button:focus-visible {
        outline: 2px solid var(--oc-accent, #2567ff);
        outline-offset: 2px;
    }
    button:disabled {
        opacity: 0.35;
        cursor: default;
    }
    .animation-heading {
        ${lobbyPanelHeading}
    }
    .animation-heading h2 {
        margin: 0;
        font-size: 12px;
        font-weight: 500;
    }
    .animation-instructions {
        color: #c2c2bd;
        font-size: 11px;
    }
    .animation-navigation {
        display: flex;
        gap: 4px;
        margin-left: auto;
    }
    .animation-icon {
        ${lobbyPanelIconButton}
    }
    .animation-content {
        flex-shrink: 1;
        min-height: 0;
        height: var(--animation-grid-height);
        margin-inline: 16px;
        pointer-events: auto;
    }
    .animation-grid {
        position: relative;
        display: grid;
        /* Column by column over two rows: 1/2, 3/4 … 9 over the first spare. */
        grid-auto-flow: column;
        grid-auto-columns: var(--animation-tile-width);
        grid-template-rows: repeat(2, minmax(0, 1fr));
        justify-content: safe center;
        gap: 6px;
        height: 100%;
        min-height: 0;
        box-sizing: border-box;
        padding: 8px 6px;
        overflow-x: auto;
        overflow-y: hidden;
        overscroll-behavior-x: contain;
        scrollbar-width: none;
        touch-action: pan-x;
    }
    .animation-grid::-webkit-scrollbar {
        display: none;
    }
    .animation-tile {
        ${lobbyPanelCard}
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 0;
        min-height: 0;
        padding: 4px 3px 5px;
        border: 1px solid #ffffff2e;
        border-radius: 12px;
        user-select: none;
        -webkit-user-drag: element;
        transition: border-color 120ms ease;
    }
    .animation-tile:hover,
    .animation-tile:focus-visible {
        border-color: #ffffff66;
    }
    .animation-tile[draggable="true"] {
        cursor: grab;
    }
    .animation-tile[data-drop-target],
    .animation-tile[data-pending] {
        border-color: #c2e843;
    }
    .animation-pose {
        display: block;
        flex: 1;
        width: 100%;
        min-height: 0;
        color: #ececea;
    }
    .animation-name {
        flex-shrink: 0;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: var(--oc-mono, "SFMono-Regular", monospace);
        font-size: 10px;
        letter-spacing: -0.02em;
        line-height: 15px;
    }
    .animation-tile kbd {
        position: absolute;
        top: 5px;
        right: 7px;
        color: #93938e;
        font: 9px/12px var(--oc-mono, "SFMono-Regular", monospace);
    }
    .animation-sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
    }
    @media (max-width: 850px) {
        .animation-content {
            margin-bottom: 60px;
        }
    }
    @media (max-width: 680px) {
        --lobby-dock-height: 44px;
        --animation-tile-width: 52px;
        .animation-instructions {
            display: none;
        }
    }
    @media (max-height: 500px) {
        --animation-grid-height: clamp(
            132px,
            calc(100dvh - 190px - env(safe-area-inset-bottom)),
            180px
        );
        --lobby-dock-height: 36px;
        gap: 6px;
        .animation-heading {
            height: 24px;
        }
        .animation-grid {
            padding-block: 6px;
        }
        .animation-tile {
            padding-top: 2px;
            padding-bottom: 2px;
        }
        .animation-name {
            font-size: 10px;
            line-height: 12px;
        }
    }
    @media (max-width: 850px) and (max-height: 500px) {
        .animation-content {
            margin-bottom: 64px;
        }
    }
    @media (max-width: 850px) and (max-height: 380px) {
        --animation-grid-height: 112px;
        max-height: calc(100dvh - 96px - env(safe-area-inset-bottom));
        .animation-heading {
            display: none;
        }
        .animation-grid {
            padding-block: 4px;
        }
    }
    @media (prefers-reduced-motion: reduce) {
        animation: none;
        .animation-tile {
            transition: none;
        }
    }
`;

const ControlBar = styled.div`
    ${lobbyPanelFooter}
    z-index: 3;
`;

const PhonePanel = styled(NativePanelFrame)`
    .phone-animation-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
    }
    .phone-animation-grid > button {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 0;
        height: 100px;
        padding: 8px 4px 6px;
        border: 1px solid #ffffff1c;
        border-radius: 12px;
        background: #ffffff06;
        color: inherit;
        touch-action: pan-y;
    }
    .phone-animation-grid > button:hover,
    .phone-animation-grid > button:focus-visible {
        border-color: #ffffff48;
        background: #ffffff0c;
    }
    .animation-pose {
        flex: 1;
        width: 100%;
        min-height: 0;
    }
    .animation-name {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 11px;
        line-height: 16px;
    }
    .phone-animation-footer {
        flex-shrink: 0;
        padding: 8px 16px 12px;
        border-top: 1px solid #ffffff0e;
    }
    .phone-animation-footer button {
        width: 100%;
        min-height: 44px;
        border: 1px solid #ffffff1c;
        border-radius: 12px;
        background: #ffffff08;
        color: inherit;
        font-size: 13px;
    }
`;
