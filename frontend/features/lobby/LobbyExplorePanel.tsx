import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useRouter } from "next/router";
import CommandMenu from "../landing-carousel/components/CommandMenu";
import {
    Command,
    createCommands,
    feedCommands,
    helpCommands,
} from "../landing-carousel/commands";
import useDiscoveryShortcuts from "../landing-carousel/hooks/useDiscoveryShortcuts";
import { getLobbyCardCurve } from "./lobbyPanelCurve";
import {
    lobbyPanelTokens,
    lobbyPanelHeading,
    lobbyPanelCard,
    lobbyPanelFooter,
    lobbyPanelIconButton,
    lobbyPanelSurface,
} from "./lobbyPanelStyles";
import {
    DEFAULT_FILTERS,
    FEED_CATEGORIES,
    setDefaultFeedCategory,
} from "../landing-carousel/data";
import type { LandingCard } from "../landing-carousel/types";
import BottomSearch from "../landing-carousel/components/BottomSearch";
import ExperienceCard from "../landing-carousel/components/ExperienceCard";
import Icon from "../landing-carousel/components/Icon";
import useDiscovery from "../landing-carousel/hooks/useDiscovery";
import useDestinationPreviews from "../landing-carousel/hooks/useDestinationPreviews";
import type { LobbyDestination } from "./sceneTypes";
import { warmDestination } from "./destinationWarmup";
import { CARD_WARM_DWELL_MS } from "./destinationWarmupSource";

export default function LobbyExplorePanel({
    cards,
    groupName,
    active = true,
    context = "lobby",
    onClose,
    onSelect,
}: {
    cards: LandingCard[];
    groupName?: string;
    active?: boolean;
    /** Where the panel lives; spaces also offer a way into the lobby. */
    context?: "lobby" | "space";
    onClose: () => void;
    onSelect: (destination: LobbyDestination) => void;
}) {
    const discovery = useDiscovery(
        {
            initialFeed: { cards, cursor: "", hasMore: false },
            initialFilters: DEFAULT_FILTERS,
            initialError: false,
        },
        { syncUrl: false, fetchOnMount: true }
    );
    const { filters, update } = discovery;
    // Spaces don't get the landing's server props, so ask which feed leads.
    const touched = useRef(false);
    touched.current =
        touched.current || filters.category !== DEFAULT_FILTERS.category;
    useEffect(() => {
        if (context !== "space" || typeof fetch !== "function") return;
        let live = true;
        fetch("/api/staff-picks")
            .then((response) => (response.ok ? response.json() : null))
            .then((result) => {
                if (!live || result?.defaultCategory !== "staff") return;
                setDefaultFeedCategory("staff");
                if (!touched.current) update({ category: "staff" });
            })
            .catch(() => {});
        return () => {
            live = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [context]);
    const resolvedCards = useDestinationPreviews(discovery.cards, true);
    const destinations = useMemo(
        () => [
            ...resolvedCards.filter(
                (card) =>
                    card.href?.startsWith("/") && !/^\/[\\/]/.test(card.href)
            ),
        ],
        [resolvedCards]
    );
    const [menuOpen, setMenuOpen] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [draft, setDraft] = useState(filters);
    // Keyboard/focus choice; the pointer's card wins while hovered, and the
    // card nearest the rail's middle is highlighted when neither applies.
    const [selected, setSelected] = useState<string | null>(null);
    const [hovered, setHovered] = useState<string | null>(null);
    const [centered, setCentered] = useState<string | null>(null);
    const highlighted = hovered ?? selected ?? centered ?? destinations[0]?.id;
    const panel = useRef<HTMLElement>(null);
    const results = useRef<HTMLDivElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const categoryButton = useRef<HTMLButtonElement>(null);
    const filterButton = useRef<HTMLButtonElement>(null);
    const router = useRouter();
    const drag = useRef<{ x: number; left: number; moved: boolean } | null>(
        null
    );
    const suppressClick = useRef(false);
    const selectedIndex = Math.max(
        0,
        destinations.findIndex((card) => card.id === (selected ?? centered))
    );
    const focusDestination = useCallback(
        (index: number) => {
            const next = Math.max(0, Math.min(destinations.length - 1, index));
            const card = destinations[next];
            const rail = results.current;
            const element =
                rail?.querySelectorAll<HTMLAnchorElement>(".explore-card")[
                    next
                ];
            if (!card || !element || !rail) return;
            setSelected(card.id);
            element.focus({ preventScroll: true });
            // Projected bounds change with the curve. Reveal only the untransformed
            // row-local layout, keeping already-visible cards and the page stationary.
            const inset = 24;
            const left = element.offsetLeft - inset;
            const right = element.offsetLeft + element.offsetWidth + inset;
            const target =
                left < rail.scrollLeft
                    ? left
                    : right > rail.scrollLeft + rail.clientWidth
                    ? right - rail.clientWidth
                    : rail.scrollLeft;
            rail.scrollLeft = Math.max(0, target);
        },
        [destinations]
    );
    // The host changes this callback as travel state changes. Cards can retain
    // their handlers while still selecting through the latest host callback.
    const selection = useRef(onSelect);
    selection.current = onSelect;
    const selectDestination = useCallback(
        (destination: LobbyDestination) => selection.current(destination),
        []
    );
    // Resting on a card starts that space's downloads before the click.
    const warmTimer = useRef(0);
    const restOnCard = useCallback((href: string) => {
        window.clearTimeout(warmTimer.current);
        warmTimer.current = window.setTimeout(
            () => warmDestination(href),
            CARD_WARM_DWELL_MS
        );
    }, []);
    const leaveCard = useCallback(
        () => window.clearTimeout(warmTimer.current),
        []
    );
    useEffect(() => () => window.clearTimeout(warmTimer.current), []);
    const category = FEED_CATEGORIES.find(
        (item) => item.value === filters.category
    );
    const activeFilters = !!(
        filters.chain ||
        filters.owner ||
        filters.collection
    );
    const focusSearch = (select = false) => {
        const input =
            panel.current?.querySelector<HTMLInputElement>(
                "input[type=search]"
            );
        if (!active) return;
        input?.focus({ preventScroll: true });
        if (select) input?.select();
    };
    const go = (href: string) => void router.push(href);
    const buildCommands = (): Command[] => [
        ...feedCommands(filters.category, (patch) => {
            update(patch);
            setFiltersOpen(false);
        }),
        {
            id: "filter-more",
            section: "Filter worlds",
            label: "More filters",
            detail: "Chain, owner, collection",
            icon: "filter",
            keywords: "wallet address blockchain advanced",
            keepFocus: true,
            run: () => {
                setDraft(filters);
                setFiltersOpen(true);
            },
        },
        ...createCommands(() => go("/?create=gallery")),
        ...([
            {
                id: "go-search",
                section: "Go to",
                label: "Search worlds",
                detail: "Worlds, artists, creators",
                icon: "search",
                hint: "⌘K",
                keywords: "find",
                keepFocus: true,
                run: () => focusSearch(true),
            },
            context === "space" && {
                id: "go-lobby",
                section: "Go to",
                label: "Jump into the lobby",
                detail: "Hang out with people live",
                icon: "portal",
                keywords: "jump in multiplayer people world",
                run: () => go("/?lobby=1"),
            },
            {
                id: "go-home",
                section: "Go to",
                label: "Home",
                detail: "Leave 3D for the world feed",
                icon: "globe",
                keywords: "landing exit browse discover",
                run: () => go("/"),
            },
        ].filter(Boolean) as Command[]),
        ...helpCommands(go),
    ];
    const openMenu = () => {
        setFiltersOpen(false);
        setMenuOpen(true);
    };
    useDiscoveryShortcuts({
        enabled: active,
        scope: panel,
        onSearch: () => {
            setFiltersOpen(false);
            setMenuOpen(false);
            focusSearch(true);
        },
        onMenu: openMenu,
    });
    useEffect(() => {
        panel.current?.toggleAttribute("inert", !active);
        if (active) focusSearch();
        else {
            setMenuOpen(false);
            setFiltersOpen(false);
            drag.current = null;
        }
    }, [active]);
    useEffect(() => {
        if (results.current) results.current.scrollLeft = 0;
        setSelected(null);
        setHovered(null);
    }, [discovery.resultKey]);
    useEffect(() => {
        const rail = results.current;
        if (!rail || !active) return;
        const wheel = (event: WheelEvent) => {
            if (
                event.ctrlKey ||
                event.shiftKey ||
                Math.abs(event.deltaX) >= Math.abs(event.deltaY)
            )
                return;
            const unit =
                event.deltaMode === 1
                    ? 16
                    : event.deltaMode === 2
                    ? rail.clientWidth
                    : 1;
            const delta = event.deltaY * unit;
            const limit = rail.scrollWidth - rail.clientWidth;
            const next = Math.max(0, Math.min(limit, rail.scrollLeft + delta));
            if (next === rail.scrollLeft) return;
            event.preventDefault();
            rail.scrollLeft = next;
        };
        rail.addEventListener("wheel", wheel, { passive: false });
        return () => rail.removeEventListener("wheel", wheel);
    }, [active]);
    useEffect(() => {
        const rail = results.current;
        if (!rail || !active) return;
        let frame = 0;
        const updateCurve = () => {
            frame = 0;
            const width = rail.clientWidth;
            if (!width) return;
            // Read layout before writing transforms; scroll positions stay untransformed.
            const cards = Array.from(
                rail.querySelectorAll<HTMLElement>(".explore-card")
            );
            const curves = cards.map((card) =>
                getLobbyCardCurve(
                    card.offsetLeft +
                        card.offsetWidth / 2 -
                        rail.scrollLeft -
                        width / 2,
                    width,
                    card.offsetWidth
                )
            );
            let middle = -1;
            let middleDistance = Infinity;
            cards.forEach((card, index) => {
                const distance = Math.abs(
                    card.offsetLeft +
                        card.offsetWidth / 2 -
                        rail.scrollLeft -
                        width / 2
                );
                if (distance < middleDistance) {
                    middleDistance = distance;
                    middle = index;
                }
            });
            setCentered(destinations[middle]?.id ?? null);
            cards.forEach((card, index) => {
                card.style.setProperty(
                    "--explore-turn",
                    `${curves[index].turn}deg`
                );
                card.style.setProperty(
                    "--explore-depth",
                    `${curves[index].depth}px`
                );
            });
        };
        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(updateCurve);
        };
        const observer =
            typeof ResizeObserver !== "undefined"
                ? new ResizeObserver(schedule)
                : null;
        observer?.observe(rail);
        rail.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        updateCurve();
        return () => {
            cancelAnimationFrame(frame);
            observer?.disconnect();
            rail.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
        };
    }, [active, destinations]);
    useEffect(() => {
        if (!menuOpen || !active) return;
        const outside = (event: Event) => {
            if (!menu.current?.contains(event.target as Node))
                setMenuOpen(false);
        };
        document.addEventListener("pointerdown", outside);
        document.addEventListener("focusin", outside);
        return () => {
            document.removeEventListener("pointerdown", outside);
            document.removeEventListener("focusin", outside);
        };
    }, [menuOpen, filters.category, active]);

    // Closing Explore updates its focus/inert state immediately, but leaves
    // unchanged card trees out of the opening travel render.
    const destinationCards = useMemo(
        () =>
            destinations.map((card, index) => (
                <ExperienceCard
                    key={card.id}
                    card={card}
                    flat
                    className="explore-card"
                    data-selected={card.id === highlighted}
                    onFocus={() => {
                        setSelected(card.id);
                        restOnCard(card.href);
                    }}
                    onBlur={leaveCard}
                    onPointerEnter={(event) => {
                        if (event.pointerType !== "mouse") return;
                        setHovered(card.id);
                        restOnCard(card.href);
                    }}
                    onPointerLeave={() => {
                        setHovered((current) =>
                            current === card.id ? null : current
                        );
                        leaveCard();
                    }}
                    onKeyDown={(event) => {
                        if (event.metaKey || event.ctrlKey || event.altKey)
                            return;
                        const direction = {
                            ArrowRight: 1,
                            ArrowLeft: -1,
                            ArrowDown: 1,
                            ArrowUp: -1,
                            PageDown: 1,
                            PageUp: -1,
                        }[event.key];
                        if (
                            !direction &&
                            event.key !== "Home" &&
                            event.key !== "End"
                        )
                            return;
                        event.preventDefault();
                        focusDestination(
                            event.key === "Home"
                                ? 0
                                : event.key === "End"
                                ? destinations.length - 1
                                : index + direction
                        );
                    }}
                    onClick={(event) => {
                        if (
                            event.defaultPrevented ||
                            event.button !== 0 ||
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.altKey
                        )
                            return;
                        event.preventDefault();
                        selectDestination({
                            id: card.id,
                            title: card.title,
                            href: card.href,
                            imageUrl: card.imageUrls?.[0],
                            creator: card.creator,
                        });
                    }}
                />
            )),
        [
            destinations,
            highlighted,
            focusDestination,
            selectDestination,
            restOnCard,
            leaveCard,
        ]
    );

    return (
        <Panel
            ref={panel}
            id="lobby-explore"
            role="dialog"
            aria-labelledby="lobby-explore-title"
            aria-hidden={!active || undefined}
            data-active={active}
            onKeyDown={(event) => {
                if (
                    !active ||
                    event.nativeEvent.isComposing ||
                    event.keyCode === 229
                )
                    return;
                if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    if (menuOpen) {
                        setMenuOpen(false);
                        focusSearch();
                    } else if (filtersOpen) {
                        setFiltersOpen(false);
                        filterButton.current?.focus();
                    } else onClose();
                }
            }}
        >
            <div className="explore-heading">
                <h2 id="lobby-explore-title">
                    {groupName
                        ? `Explore with ${groupName}`
                        : filters.q
                        ? "Search results"
                        : category?.label || "Explore worlds"}
                </h2>
                <div
                    className="explore-navigation"
                    role="group"
                    aria-label="Browse worlds"
                >
                    <button
                        type="button"
                        className="explore-icon"
                        aria-label="Previous world"
                        disabled={
                            filtersOpen ||
                            !destinations.length ||
                            selectedIndex === 0
                        }
                        onClick={() => focusDestination(selectedIndex - 1)}
                    >
                        <Icon name="back" size={16} />
                    </button>
                    <button
                        type="button"
                        className="explore-icon"
                        aria-label="Next world"
                        disabled={
                            filtersOpen ||
                            !destinations.length ||
                            (selectedIndex === destinations.length - 1 &&
                                ((!discovery.hasMore &&
                                    !discovery.loadMoreError) ||
                                    discovery.loadingMore))
                        }
                        onClick={() => {
                            if (selectedIndex < destinations.length - 1)
                                focusDestination(selectedIndex + 1);
                            else void discovery.loadMore();
                        }}
                    >
                        <Icon name="forward" size={16} />
                    </button>
                </div>
            </div>
            <div
                className="explore-content"
                data-filters-open={filtersOpen || undefined}
            >
                {filtersOpen && (
                    <form
                        id="lobby-explore-filters"
                        className="explore-filters"
                        aria-label="Filter worlds"
                        onSubmit={(event) => {
                            event.preventDefault();
                            update({
                                chain: draft.chain,
                                owner: draft.owner.trim(),
                                collection: draft.collection.trim(),
                            });
                            setFiltersOpen(false);
                            filterButton.current?.focus();
                        }}
                    >
                        <label>
                            Blockchain
                            <select
                                value={draft.chain}
                                onChange={(event) =>
                                    setDraft({
                                        ...draft,
                                        chain: event.target.value,
                                    })
                                }
                            >
                                <option value="">All blockchains</option>
                                <option value="ethereum">Ethereum</option>
                                <option value="polygon">Polygon</option>
                                <option value="solana">Solana</option>
                                <option value="tezos">Tezos</option>
                            </select>
                        </label>
                        <label>
                            Creator wallet
                            <input
                                value={draft.owner}
                                maxLength={300}
                                placeholder="Wallet address"
                                autoComplete="off"
                                onChange={(event) =>
                                    setDraft({
                                        ...draft,
                                        owner: event.target.value,
                                    })
                                }
                            />
                        </label>
                        <label>
                            Collection
                            <input
                                value={draft.collection}
                                maxLength={300}
                                placeholder="Collection ID"
                                autoComplete="off"
                                onChange={(event) =>
                                    setDraft({
                                        ...draft,
                                        collection: event.target.value,
                                    })
                                }
                            />
                        </label>
                        <div className="explore-filter-actions">
                            <button
                                type="button"
                                onClick={() => {
                                    discovery.reset();
                                    setDraft(DEFAULT_FILTERS);
                                }}
                            >
                                Reset filters
                            </button>
                            <button type="submit">
                                Apply filters
                                <Icon name="forward" size={14} />
                            </button>
                        </div>
                    </form>
                )}
                <div
                    className="explore-grid"
                    ref={results}
                    aria-hidden={filtersOpen || undefined}
                    onScroll={(event) => {
                        const rail = event.currentTarget;
                        if (!rail.clientWidth) return;
                        const cards =
                            rail.querySelectorAll<HTMLElement>(".explore-card");
                        const focused = Array.from(cards).indexOf(
                            document.activeElement as HTMLElement
                        );
                        const focusedCard = cards[focused];
                        const focusedVisible =
                            focusedCard &&
                            focusedCard.offsetLeft >= rail.scrollLeft + 23 &&
                            focusedCard.offsetLeft + focusedCard.offsetWidth <=
                                rail.scrollLeft + rail.clientWidth - 23;
                        // A focused card stays highlighted while visible;
                        // otherwise the middle card (set by the curve pass) is.
                        setSelected(
                            focusedVisible
                                ? destinations[focused]?.id ?? null
                                : null
                        );
                        if (
                            rail.scrollWidth -
                                rail.scrollLeft -
                                rail.clientWidth <
                                rail.clientWidth * 2 &&
                            discovery.hasMore &&
                            !discovery.loadingMore &&
                            !discovery.loadMoreError &&
                            !discovery.error
                        ) {
                            void discovery.loadMore();
                        }
                    }}
                    onPointerDown={(event) => {
                        suppressClick.current = false;
                        if (
                            event.pointerType !== "mouse" ||
                            event.button !== 0 ||
                            event.ctrlKey ||
                            event.metaKey ||
                            event.shiftKey ||
                            event.altKey
                        )
                            return;
                        drag.current = {
                            x: event.clientX,
                            left: event.currentTarget.scrollLeft,
                            moved: false,
                        };
                    }}
                    onPointerMove={(event) => {
                        const gesture = drag.current;
                        if (!gesture) return;
                        if (!(event.buttons & 1)) {
                            drag.current = null;
                            delete event.currentTarget.dataset.dragging;
                            return;
                        }
                        const delta = event.clientX - gesture.x;
                        if (!gesture.moved && Math.abs(delta) < 6) return;
                        if (!gesture.moved) {
                            gesture.moved = true;
                            event.currentTarget.setPointerCapture(
                                event.pointerId
                            );
                            event.currentTarget.dataset.dragging = "true";
                        }
                        event.preventDefault();
                        event.currentTarget.scrollLeft = gesture.left - delta;
                    }}
                    onPointerUp={(event) => {
                        suppressClick.current = !!drag.current?.moved;
                        drag.current = null;
                        delete event.currentTarget.dataset.dragging;
                        if (
                            event.currentTarget.hasPointerCapture(
                                event.pointerId
                            )
                        )
                            event.currentTarget.releasePointerCapture(
                                event.pointerId
                            );
                    }}
                    onPointerLeave={() => {
                        if (!drag.current?.moved) drag.current = null;
                    }}
                    onLostPointerCapture={(event) => {
                        suppressClick.current ||= !!drag.current?.moved;
                        drag.current = null;
                        delete event.currentTarget.dataset.dragging;
                    }}
                    onPointerCancel={(event) => {
                        drag.current = null;
                        suppressClick.current = false;
                        delete event.currentTarget.dataset.dragging;
                    }}
                    onDragStart={(event) => event.preventDefault()}
                    onClickCapture={(event) => {
                        if (!suppressClick.current) return;
                        event.preventDefault();
                        event.stopPropagation();
                        suppressClick.current = false;
                    }}
                    aria-label="Worlds"
                    aria-busy={discovery.loading}
                >
                    {destinationCards}
                    <div
                        className="explore-status"
                        role="status"
                        aria-live="polite"
                    >
                        {discovery.loading ? (
                            "Finding worlds…"
                        ) : discovery.error && !discovery.loadMoreError ? (
                            <>
                                <span>Worlds couldn’t load.</span>
                                <button type="button" onClick={discovery.retry}>
                                    Retry
                                </button>
                            </>
                        ) : !destinations.length ? (
                            "No worlds found. Try another search or filter."
                        ) : null}
                    </div>
                    {!discovery.loading &&
                        (!discovery.error || discovery.loadMoreError) &&
                        (discovery.hasMore || discovery.loadMoreError) && (
                            <button
                                className="explore-more"
                                type="button"
                                disabled={discovery.loadingMore}
                                onClick={discovery.loadMore}
                            >
                                {discovery.loadingMore
                                    ? "Loading…"
                                    : discovery.loadMoreError
                                    ? "Retry loading more"
                                    : "Load more"}
                            </button>
                        )}
                </div>
            </div>
            <ControlBar className="explore-toolbar" ref={menu}>
                {menuOpen && (
                    <CommandMenu
                        className="explore-menu"
                        id="lobby-explore-categories"
                        commands={buildCommands()}
                        listLabel="World feeds"
                        onClose={() => {
                            setMenuOpen(false);
                            focusSearch();
                        }}
                        onRun={(command) => {
                            setMenuOpen(false);
                            if (!command.keepFocus) focusSearch();
                        }}
                    />
                )}

                <button
                    type="button"
                    className="explore-icon"
                    aria-label="Close search"
                    onClick={onClose}
                >
                    <Icon name="close" size={16} />
                </button>
                <button
                    ref={categoryButton}
                    type="button"
                    className="explore-icon"
                    aria-label="World feeds"
                    title="World feeds · /"
                    aria-haspopup="dialog"
                    aria-expanded={menuOpen}
                    aria-controls="lobby-explore-categories"
                    onClick={() => {
                        setFiltersOpen(false);
                        setMenuOpen(!menuOpen);
                    }}
                    onKeyDown={(event) => {
                        if (
                            event.nativeEvent.isComposing ||
                            event.keyCode === 229
                        )
                            return;
                        if (
                            event.key === "ArrowDown" ||
                            event.key === "ArrowUp"
                        ) {
                            event.preventDefault();
                            openMenu();
                        }
                    }}
                >
                    <Icon name="search" size={18} />
                </button>
                <BottomSearch
                    value={filters.q}
                    onChange={(q) => update({ q })}
                    onSearch={(q) => update({ q })}
                />
                <button
                    ref={filterButton}
                    type="button"
                    className="explore-icon"
                    aria-label="Filter worlds"
                    title="Filters"
                    aria-expanded={filtersOpen}
                    aria-controls="lobby-explore-filters"
                    onClick={() => {
                        setDraft(filters);
                        setFiltersOpen(!filtersOpen);
                        setMenuOpen(false);
                    }}
                >
                    <Icon name="filter" size={16} />
                    {activeFilters && <span className="explore-active" />}
                </button>
            </ControlBar>
        </Panel>
    );
}

const Panel = styled.section`
    ${lobbyPanelTokens}
    --oc-radius-card: 12px;
    --caption-height: 48px;
    --explore-card-height: clamp(150px, 22svh, 200px);
    position: absolute;
    z-index: 6;
    left: 50%;
    bottom: var(--explore-bottom, 0px);
    width: min(
        960px,
        calc(
            100vw - max(16px, env(safe-area-inset-left)) -
                max(16px, env(safe-area-inset-right))
        )
    );
    max-height: calc(100dvh - 116px - env(safe-area-inset-bottom));
    opacity: 0;
    transform: translate(-50%, 8px);
    transition: opacity 180ms ease,
        transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
    &[data-active="true"] {
        opacity: 1;
        transform: translateX(-50%);
        animation: lobby-search-arrive 220ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    &[data-active="false"] * {
        pointer-events: none;
    }
    @keyframes lobby-search-arrive {
        from {
            opacity: 0;
            transform: translate(-50%, 8px);
        }
        to {
            opacity: 1;
            transform: translate(-50%, 0);
        }
    }
    display: flex;
    flex-direction: column;
    gap: var(--lobby-panel-gap);
    pointer-events: none;
    text-shadow: none;
    button {
        color: inherit;
        font: inherit;
        cursor: pointer;
        border: 0;
        background: none;
    }
    button:focus-visible,
    input:focus-visible,
    select:focus-visible {
        outline: 2px solid var(--oc-accent, #2567ff);
        outline-offset: 2px;
    }
    button:disabled {
        opacity: 0.35;
        cursor: default;
    }
    .explore-sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
    }
    .explore-heading {
        ${lobbyPanelHeading}
        padding-inline: 4px;
    }
    .explore-heading h2 {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .explore-navigation {
        display: flex;
        gap: 4px;
        margin-left: auto;
        flex-shrink: 0;
    }
    .explore-icon {
        ${lobbyPanelIconButton}
    }
    .explore-menu {
        position: absolute;
        top: auto;
        bottom: calc(100% + 10px);
        left: 0;
        right: 0;
        width: 100%;
        /* Short enough to keep the cards and avatar in view; the list scrolls. */
        max-height: min(340px, 42dvh);
        z-index: 3;
    }
    .explore-active {
        position: absolute;
        top: 5px;
        right: 5px;
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--oc-accent);
    }
    .explore-content {
        position: relative;
        pointer-events: auto;
        flex-shrink: 1;
        min-height: 0;
        height: calc(var(--explore-card-height) + 24px);
    }
    .explore-content[data-filters-open] .explore-grid {
        visibility: hidden;
    }
    .explore-filters {
        ${lobbyPanelSurface}
        position: absolute;
        inset: 0 16px;
        z-index: 2;
        display: grid;
        grid-template-columns: 1fr 1fr;
        align-content: start;
        gap: 8px 12px;
        padding: 12px;

        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        scrollbar-color: #ffffff24 transparent;
    }
    .explore-filters label {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        color: #b5b5af;
        font-size: 11px;
    }
    .explore-filters label:first-child {
        grid-column: 1 / -1;
    }
    .explore-filters input,
    .explore-filters select {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        height: 32px;
        padding: 0 10px;
        border: 1px solid #ffffff24;
        border-radius: 10px;
        background: #141414;
        color: #f3f3f1;
        font: 12px var(--oc-font);
        color-scheme: dark;
    }
    .explore-filters input::placeholder {
        color: #93938e;
    }
    .explore-filter-actions {
        display: flex;
        justify-content: space-between;
        grid-column: 1 / -1;
        gap: 12px;
    }
    .explore-filter-actions button {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 32px;
        padding: 0 10px;
        font-size: 12px;
        border-radius: 10px;
    }
    .explore-filter-actions button[type="button"] {
        color: #b5b5af;
    }
    .explore-filter-actions button[type="submit"] {
        background: #fafaf8;
        color: #20201e;
    }
    .explore-grid {
        position: relative;
        display: grid;
        grid-auto-flow: column;
        /* Keep previews readable as the rail expands across the viewport. */
        grid-auto-columns: clamp(240px, 24vw, 320px);
        grid-template-rows: minmax(0, 1fr);
        gap: var(--lobby-panel-gap);
        height: 100%;
        box-sizing: border-box;
        padding: 8px 4px 16px;
        perspective: var(--lobby-panel-perspective);
        overflow-x: auto;
        overflow-y: hidden;
        overscroll-behavior-x: contain;
        scroll-padding-inline: 4px;
        scrollbar-width: none;
        cursor: grab;
    }
    .explore-grid::-webkit-scrollbar {
        display: none;
    }
    .explore-grid[data-dragging] {
        cursor: grabbing;
    }
    .explore-grid > a {
        ${lobbyPanelCard}
        transform: translateZ(var(--explore-depth, 0px)) rotateY(var(--explore-turn, 0deg));
        transform-origin: center;
        position: relative;
        inset: auto;
        min-width: 0;
        height: 100%;
        content-visibility: auto;
        contain-intrinsic-size: auto 300px auto 180px;
        -webkit-user-drag: none;
        user-select: none;
    }
    .explore-grid > a > img,
    .explore-grid > a > .card-shade,
    .explore-grid > a > .card-top,
    .explore-grid > a > .cover-placeholder,
    .explore-grid > a > .card-caption {
        position: absolute;
    }
    .explore-grid .card-caption {
        padding: 6px 12px;
        background: linear-gradient(180deg, #11151b20, #11151b80);
        color: #f3f3f1;
        box-shadow: inset 0 1px 0 #ffffff12;
    }
    .explore-grid h2 {
        margin: 0 0 2px;
        font-size: 13px;
        line-height: 18px;
    }
    .explore-grid .card-meta {
        color: #c2c2bd;
        font-size: 11px;
        line-height: 16px;
        gap: 8px;
    }
    .explore-grid .card-meta span:nth-child(2) {
        flex-shrink: 0;
        font-size: 10px;
    }
    .explore-status {
        ${lobbyPanelCard}
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 12px;
        color: #b5b5af;
        font-size: 12px;
        text-align: center;
        padding: 16px;
    }
    .explore-status:empty {
        display: none;
    }
    .explore-status button,
    .explore-more {
        padding: 8px 12px;
        border: 1px solid #ffffff2e;
        border-radius: 12px;
        background: #ffffff0a;
        color: #f3f3f1;
        font-size: 12px;
    }
    .explore-more {
        ${lobbyPanelCard}
    }
    .explore-more:disabled {
        opacity: 0.5;
        cursor: wait;
    }
    .explore-toolbar > form {
        position: static;
        transform: none;
        flex: 1;
        min-width: 0;
        width: auto;
        height: 100%;
        padding: 0;
        gap: 8px;
        border: 0;
        border-radius: 0;
        background: none;
        box-shadow: none;
    }
    .explore-toolbar > form > svg {
        display: none;
    }
    .explore-toolbar input {
        font-size: 14px;
        line-height: 20px;
        text-overflow: ellipsis;
    }
    @media (min-width: 960px) {
        .explore-toolbar {
            width: 640px;
        }
    }
    @media (max-width: 680px) {
        .explore-filters {
            gap: 8px;
        }
        .explore-filters input,
        .explore-filters select,
        .explore-toolbar input {
            font-size: 16px;
        }
    }
    @media (max-width: 520px) {
        .explore-toolbar kbd {
            display: none;
        }
        .explore-grid {
            grid-auto-columns: 80%;
        }
    }
    @media (max-height: 500px) {
        --explore-card-height: max(
            64px,
            calc(0.8 * (100dvh - 244px) - env(safe-area-inset-bottom))
        );
    }
    @media (prefers-reduced-motion: reduce) {
        transition: none;
        &[data-active="true"] {
            animation: none;
        }
    }
`;

const ControlBar = styled.div`
    ${lobbyPanelFooter}
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    z-index: 3;
`;
