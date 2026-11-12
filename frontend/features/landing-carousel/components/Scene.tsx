import {
    ReactNode,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import Link from "@components/InAppLink";
import styled from "styled-components";
import * as THREE from "three";
import { UserContext } from "@components/context/UserContext";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { LandingCard } from "../types";
import { CardPool } from "../three/pool";
import {
    createGridLayout,
    cylinderMetrics,
    cellDimensions,
    projectPoint,
    columnOpacity,
    adjacentColumn,
    selectedCardIndex,
    moveGridSelection,
} from "../three/layout";
import ExperienceCard from "./ExperienceCard";
import { CARD_WARM_DWELL_MS, warmSpace } from "../warmSpace";
import Icon from "./Icon";
import useCardTransition from "../hooks/useCardTransition";
import { cardOpacity } from "../transitions";
import { createColumnScroller } from "../columnScroller";
import { isSetupCard } from "../creationSteps";
import { CreateIcon } from "./CreateIcon";
import {
    useActivitySignal,
    useLandingActivity,
    useLandingBusy,
} from "../activity";

interface Props {
    cards: LandingCard[];
    renderCard?: (card: LandingCard) => ReactNode;
    active: boolean;
    contentKey?: string;
    onCardActivate?: (card: LandingCard) => boolean;
    counterLabel?: string;
    creating?: boolean;
    onCreate: () => void;
    createLabel?: string;
    createTitle?: string;
    featuredActionLabel?: string;
    browseLabel?: string;
    interactionsBlocked?: boolean;
    flat: boolean;
    columns: number;
    visibleRows: number;
    viewControls: ReactNode;
    footerStart?: ReactNode;
    onFlatView: (flat: boolean) => void;
    resetKey: string;
    hasMore: boolean;
    loadingMore: boolean;
    error: boolean;
    loadMore: () => void;
}

export default function Scene({
    cards: requestedCards,
    renderCard,
    contentKey,
    onCardActivate,
    counterLabel,
    active,
    creating = false,
    onCreate,
    createLabel = "create",
    createTitle,
    featuredActionLabel,
    browseLabel = "Browse worlds. Scroll or use arrow keys to explore.",
    interactionsBlocked = false,
    flat,
    columns,
    visibleRows,
    viewControls,
    footerStart,
    onFlatView,
    resetKey,
    hasMore,
    loadingMore,
    error,
    loadMore,
}: Props) {
    const blocked = useRef(interactionsBlocked);
    blocked.current = interactionsBlocked;
    const transition = useCardTransition(
        requestedCards,
        contentKey || resetKey,
        columns * visibleRows
    );
    useLandingBusy(transition.busy);
    const textureActivity = useActivitySignal();
    const activity = useLandingActivity();
    const cards = transition.cards;
    const formGrid =
        cards.length > 0 && cards.every((card) => isSetupCard(card));
    const viewportRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const linksRef = useRef(new Map<string, HTMLElement>());
    const controlsRef = useRef({
        next: () => {},
        previous: () => {},
        goTo: (_column: number) => {},
    });
    const [range, setRange] = useState({
        key: transition.key,
        first: 1,
        last: Math.min(columns * visibleRows, cards.length),
        atStart: true,
        atEnd: false,
        renderFrom: 0,
        renderTo: columns + 8,
    });
    const { user } = useContext(UserContext);
    const single = columns === 1 && visibleRows === 1;
    const layout = useMemo(
        () => createGridLayout(cards, columns, visibleRows),
        [cards, columns, visibleRows]
    );
    const sceneData = useRef({ cards, layout });
    sceneData.current = { cards, layout };
    const refreshScene = useRef(() => {});
    const loadMoreRef = useRef(loadMore);
    loadMoreRef.current = loadMore;
    useEffect(() => {
        // Fetch three screens ahead, including sparse filtered pages. Only one
        // request can run at once; an error requires an explicit retry.
        if (
            active &&
            !creating &&
            cards === requestedCards &&
            transition.key === (contentKey || resetKey) &&
            range.key === transition.key &&
            hasMore &&
            !loadingMore &&
            !error &&
            requestedCards.length - range.last <= columns * visibleRows * 3
        )
            loadMoreRef.current();
    }, [
        active,
        creating,
        hasMore,
        loadingMore,
        error,
        cards,
        requestedCards,
        range.last,
        range.key,
        transition.key,
        contentKey,
        columns,
        visibleRows,
        resetKey,
    ]);
    const suppressClick = useRef(false);
    const firstColumn = useRef(0);
    const savedProgress = useRef({ explore: 0, create: 0 });
    const mode = transition.key.startsWith("explore:") ? "explore" : "create";
    const selectionSlots = useRef({
        explore: { column: 0, row: 0 },
        create: { column: 0, row: 0 },
    });
    const selectedId = useRef<string | null>(null);
    const featured = cards[range.first - 1] || cards[0];

    const invalidateGraphics = useRef(() => {});
    const graphics = useRef<{
        renderer: THREE.WebGLRenderer;
        pool: CardPool;
        scene: THREE.Scene;
        camera: THREE.PerspectiveCamera;
        width: number;
        height: number;
    }>(null);
    // Search changes bindings and positions, not the canvas or its texture cache.
    useLayoutEffect(() => {
        if (flat || formGrid || !canvasRef.current) return;
        let renderer: THREE.WebGLRenderer;
        try {
            renderer = new THREE.WebGLRenderer({
                canvas: canvasRef.current,
                antialias: true,
                alpha: true,
                powerPreference: "low-power",
            });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
            renderer.setClearColor(0x101010, 0);
            const pool = new CardPool(
                () => invalidateGraphics.current(),
                textureActivity
            );
            const scene = new THREE.Scene();
            scene.add(pool.group);
            graphics.current = {
                renderer,
                pool,
                scene,
                camera: new THREE.PerspectiveCamera(),
                width: 0,
                height: 0,
            };
        } catch {
            renderer?.dispose();
            onFlatView(true);
            return;
        }
        const canvas = canvasRef.current;
        const onContextLost = (event: Event) => {
            event.preventDefault();
            onFlatView(true);
        };
        canvas.addEventListener("webglcontextlost", onContextLost);
        return () => {
            canvas.removeEventListener("webglcontextlost", onContextLost);
            graphics.current?.pool.dispose();
            graphics.current?.renderer.dispose();
            graphics.current = null;
        };
    }, [flat, formGrid, onFlatView, textureActivity]);

    const previousLayout = useRef({
        key: transition.key,
        columns,
        visibleRows,
    });
    useLayoutEffect(() => {
        const previous = previousLayout.current;
        const previousMode = previous.key.startsWith("explore:")
            ? "explore"
            : "create";
        if (
            previous.columns !== columns ||
            previous.visibleRows !== visibleRows
        ) {
            savedProgress.current = { explore: 0, create: 0 };
            selectionSlots.current = {
                explore: { column: 0, row: 0 },
                create: { column: 0, row: 0 },
            };
            viewportRef.current?.scrollTo({ left: 0, behavior: "auto" });
        } else if (previousMode === mode && previous.key !== transition.key) {
            // A new template/search set starts at its first card. Switching
            // between Explore and Create retains each mode's saved position.
            savedProgress.current[mode] = 0;
            selectionSlots.current[mode] = { column: 0, row: 0 };
            viewportRef.current?.scrollTo({ left: 0, behavior: "auto" });
        }
        previousLayout.current = { key: transition.key, columns, visibleRows };
    }, [transition.key, columns, visibleRows, mode]);

    useLayoutEffect(() => {
        let { cards, layout } = sceneData.current;
        const viewport = viewportRef.current;
        const content = contentRef.current;
        const stage = stageRef.current;
        if (!active || !viewport || !content || !stage || !cards.length) return;
        const graphic = graphics.current;
        const renderer = graphic?.renderer;
        const pool = graphic?.pool;
        const scene = graphic?.scene || new THREE.Scene();
        const camera = graphic?.camera || new THREE.PerspectiveCamera();
        let metrics = cylinderMetrics(
            viewport.clientWidth,
            viewport.clientHeight,
            columns,
            visibleRows
        );
        let frame = 0;
        let stopped = false;
        let hovered = "";
        let previousRange = "";
        let wheelEndTimer: ReturnType<typeof setTimeout>;
        let requestedColumn: number | null = null;
        let keyboardSelection: number | null = null;
        let drag: { x: number; scroll: number; pointerId: number } | null =
            null;
        const reducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        );

        const scroller = createColumnScroller({
            read: () => viewport.scrollLeft,
            write: (position) => {
                viewport.scrollLeft = position;
                invalidate();
            },
            stride: () => metrics.columnStride,
            maxColumn: () => layout.maxScrollColumn,
            reducedMotion: () => reducedMotion.matches,
            requestFrame: (callback) => requestAnimationFrame(callback),
            cancelFrame: (id) => cancelAnimationFrame(id),
            now: () => performance.now(),
            onTarget: (column) => {
                requestedColumn = column;
            },
        });

        function invalidate() {
            if (!frame && !stopped && !document.hidden)
                frame = requestAnimationFrame(render);
        }
        transition.invalidate.current = invalidate;
        invalidateGraphics.current = invalidate;
        function render() {
            frame = 0;
            if (stopped) return;
            // The viewport and both renderers share one scroll position.
            const progress = viewport.scrollLeft / metrics.columnStride;
            activity?.setScrollProgress(progress);
            savedProgress.current[mode] = progress;
            firstColumn.current = Math.max(
                0,
                Math.min(layout.maxScrollColumn, Math.round(progress))
            );
            const previousSelection = selectedId.current;
            const followFocus = (
                document.activeElement as HTMLElement
            )?.matches("[data-card-id]");
            updateSelection(false);
            const now = performance.now();
            const opacity = (index: number) =>
                cardOpacity(
                    transition.motion.current,
                    now,
                    Math.min(
                        columns * visibleRows - 1,
                        Math.max(0, index - firstColumn.current * visibleRows)
                    )
                );
            const centerColumn = progress + (columns - 1) / 2;
            const overscan =
                (metrics.width / 2 + metrics.cardWidth) / metrics.columnStride +
                2;
            const renderFrom = Math.max(0, Math.floor(centerColumn - overscan));
            const renderTo = Math.min(
                layout.columnCount,
                Math.ceil(centerColumn + overscan) + 1
            );
            const nearbyCells = layout.cells.slice(
                renderFrom * visibleRows,
                renderTo * visibleRows
            );
            pool?.update(
                cards,
                nearbyCells,
                metrics,
                progress,
                hovered,
                opacity
            );
            for (const element of linksRef.current.values()) {
                element.style.visibility = "hidden";
                element.tabIndex = -1;
            }
            for (const cell of nearbyCells) {
                const element = linksRef.current.get(cards[cell.index].id);
                if (!element) continue;
                const dims = cellDimensions(cell, metrics, progress);
                const visible =
                    Math.abs(dims.x) < metrics.width / 2 + metrics.cardWidth;
                element.style.visibility = visible ? "visible" : "hidden";
                if (isSetupCard(cards[cell.index])) {
                    element.toggleAttribute(
                        "inert",
                        !visible ||
                            cell.column < firstColumn.current ||
                            cell.column >= firstColumn.current + columns ||
                            transition.motion.current.phase !== "idle"
                    );
                }
                element.tabIndex =
                    visible &&
                    cell.column >= firstColumn.current &&
                    cell.column < firstColumn.current + columns
                        ? 0
                        : -1;
                if (!visible) continue;
                // Trace the curved top/bottom; labels stay level in screen space.
                const points: { x: number; y: number }[] = [];
                for (let i = 0; i <= 16; i++)
                    points.push(
                        projectPoint(
                            dims.x - dims.width / 2 + (dims.width * i) / 16,
                            dims.y + dims.height / 2,
                            metrics
                        )
                    );
                for (let i = 0; i <= 16; i++)
                    points.push(
                        projectPoint(
                            dims.x + dims.width / 2 - (dims.width * i) / 16,
                            dims.y - dims.height / 2,
                            metrics
                        )
                    );
                const left = Math.min(...points.map((p) => p.x));
                const top = Math.min(...points.map((p) => p.y));
                const width = Math.max(...points.map((p) => p.x)) - left;
                const height = Math.max(...points.map((p) => p.y)) - top;
                const dpr = window.devicePixelRatio || 1;
                const snap = (value: number) => Math.round(value * dpr) / dpr;
                element.style.transform = `translate3d(${snap(left)}px,${snap(
                    top
                )}px,0)`;
                element.style.width = `${width}px`;
                element.style.height = `${height}px`;
                element.style.opacity = String(
                    columnOpacity(cell.column, progress, columns) *
                        opacity(cell.index)
                );
                element.style.setProperty(
                    "--caption-height",
                    `${metrics.captionHeight}px`
                );
                element.style.clipPath = `polygon(${points
                    .map(
                        (p) =>
                            `${((p.x - left) / width) * 100}% ${
                                ((p.y - top) / height) * 100
                            }%`
                    )
                    .join(",")})`;
            }
            if (followFocus && previousSelection !== selectedId.current) {
                linksRef.current
                    .get(selectedId.current)
                    ?.focus({ preventScroll: true });
            }
            renderer?.render(scene, camera);
            if (transition.motion.current.phase !== "idle") invalidate();
            const first = firstColumn.current * visibleRows + 1;
            const last = Math.min(
                first + columns * visibleRows - 1,
                cards.length
            );
            const atStart = progress < 0.01;
            const atEnd = progress >= layout.maxScrollColumn - 0.01;
            const rangeKey = `${first}:${last}:${atStart}:${atEnd}:${renderFrom}:${renderTo}`;
            if (rangeKey !== previousRange) {
                previousRange = rangeKey;
                setRange({
                    key: transition.key,
                    first,
                    last,
                    atStart,
                    atEnd,
                    renderFrom,
                    renderTo,
                });
            }
        }
        function updateSelection(followFocus = true) {
            // Hold the keyboard target while its column smoothly comes into view.
            const index =
                keyboardSelection ??
                selectedCardIndex(
                    firstColumn.current,
                    columns,
                    visibleRows,
                    cards.length,
                    selectionSlots.current[mode]
                );
            if (keyboardSelection !== null) {
                const cell = layout.cells[index];
                selectionSlots.current[mode] = {
                    column: Math.max(
                        0,
                        Math.min(columns - 1, cell.column - firstColumn.current)
                    ),
                    row: cell.row,
                };
            }
            const id = cards[index]?.id || null;
            const previous = selectedId.current;
            selectedId.current = id;
            for (const [cardId, element] of linksRef.current) {
                element.dataset.selected = String(cardId === id);
                if (cardId === id) element.setAttribute("aria-current", "true");
                else element.removeAttribute("aria-current");
            }
            // If keyboard focus was in the grid, let it follow the selection.
            if (
                followFocus &&
                id !== previous &&
                (document.activeElement as HTMLElement)?.matches(
                    "[data-card-id]"
                )
            ) {
                linksRef.current.get(id)?.focus({ preventScroll: true });
            }
        }
        function selectCard(id: string) {
            if (
                keyboardSelection !== null &&
                cards[keyboardSelection]?.id === id
            )
                return;
            const cell = layout.cells.find(
                (cell) => cards[cell.index].id === id
            );
            if (
                !cell ||
                cell.column < firstColumn.current ||
                cell.column >= firstColumn.current + columns
            )
                return;
            keyboardSelection = null;
            selectionSlots.current[mode] = {
                column: cell.column - firstColumn.current,
                row: cell.row,
            };
            updateSelection();
        }
        function onFocusIn(event: FocusEvent) {
            const element = (event.target as HTMLElement).closest<HTMLElement>(
                "[data-card-id]"
            );
            if (element) selectCard(element.dataset.cardId);
        }
        function resize() {
            if (!viewport.clientWidth || !viewport.clientHeight) return;
            const progress = savedProgress.current[mode];
            clearTimeout(wheelEndTimer);
            scroller.cancel();
            metrics = cylinderMetrics(
                viewport.clientWidth,
                viewport.clientHeight,
                columns,
                visibleRows
            );
            if (
                graphic &&
                (graphic.width !== metrics.width ||
                    graphic.height !== metrics.height)
            ) {
                renderer.setSize(metrics.width, metrics.height, false);
                graphic.width = metrics.width;
                graphic.height = metrics.height;
            }
            camera.fov =
                (2 *
                    Math.atan(metrics.height / (2 * metrics.cameraDistance)) *
                    180) /
                Math.PI;
            camera.aspect = metrics.width / metrics.height;
            camera.near = 1;
            camera.far = metrics.cameraDistance + metrics.radius * 3;
            camera.position.z = metrics.cameraDistance;
            camera.updateProjectionMatrix();
            stage.style.width = `${metrics.width}px`;
            content.style.width = `${
                metrics.width +
                Math.max(0, layout.maxScrollColumn) * metrics.columnStride
            }px`;
            viewport.scrollLeft =
                Math.min(progress, layout.maxScrollColumn) *
                metrics.columnStride;
            viewport.parentElement?.parentElement?.style.setProperty(
                "--gallery-width",
                `${metrics.gridWidth}px`
            );
            cancelAnimationFrame(frame);
            frame = 0;
            render();
        }
        function goTo(column: number) {
            clearTimeout(wheelEndTimer);
            scroller.goTo(column);
        }
        function step(direction: number) {
            keyboardSelection = null;
            goTo(
                adjacentColumn(
                    requestedColumn ??
                        viewport.scrollLeft / metrics.columnStride,
                    direction,
                    layout.maxScrollColumn
                )
            );
        }
        function onWheel(event: WheelEvent) {
            if (blocked.current || event.ctrlKey || drag) return;
            if (
                (event.target as HTMLElement).closest(
                    "textarea, select, [data-grid-scroll]"
                )
            )
                return;
            event.preventDefault();
            keyboardSelection = null;
            const unit =
                event.deltaMode === 1
                    ? 16
                    : event.deltaMode === 2
                    ? metrics.width
                    : 1;
            const delta =
                Math.abs(event.deltaX) > Math.abs(event.deltaY)
                    ? event.deltaX
                    : event.deltaY;
            scroller.wheel(delta * unit);
            clearTimeout(wheelEndTimer);
            wheelEndTimer = setTimeout(() => scroller.endWheel(), 80);
        }
        function onKeyDown(event: KeyboardEvent) {
            if (
                blocked.current ||
                document.querySelector(
                    'dialog[open], [role="dialog"][aria-modal="true"]'
                )
            )
                return;
            if (
                event.defaultPrevented ||
                event.altKey ||
                event.ctrlKey ||
                event.metaKey
            )
                return;
            const target = event.target as HTMLElement;
            if (
                target.closest(
                    'input, textarea, select, [data-grid-form] button, [data-grid-form] a, [data-grid-scroll], [contenteditable="true"], [role="menu"], [role="dialog"]'
                )
            )
                return;
            if (target.closest("header")) return;
            if (event.key === "Escape" && creating) {
                event.preventDefault();
                onCreate();
                document
                    .getElementById("open-create")
                    ?.focus({ preventScroll: true });
                return;
            }
            if (event.key === "Enter") {
                // Leave buttons, navigation links and forms with their native action.
                if (
                    target.closest("button, a") &&
                    !target.closest("[data-card-id]")
                )
                    return;
                event.preventDefault();
                if (event.repeat) return;
                const selected = linksRef.current.get(selectedId.current);
                if (selected?.getAttribute("href")) {
                    suppressClick.current = false;
                    selected.click();
                }
                return;
            }
            const arrowDirections = {
                ArrowLeft: "left",
                ArrowRight: "right",
                ArrowUp: "up",
                ArrowDown: "down",
            } as const;
            const direction = arrowDirections[event.key];
            if (direction) {
                event.preventDefault();
                viewport.focus({ preventScroll: true });
                const next = moveGridSelection(
                    keyboardSelection ??
                        cards.findIndex(
                            (card) => card.id === selectedId.current
                        ),
                    direction,
                    requestedColumn ?? firstColumn.current,
                    columns,
                    visibleRows,
                    cards.length
                );
                keyboardSelection = next.index;
                updateSelection();
                goTo(next.firstColumn);
            } else if (event.key === "PageDown" || event.key === "PageUp") {
                event.preventDefault();
                viewport.focus({ preventScroll: true });
                step(event.key === "PageDown" ? 1 : -1);
            } else if (event.key === "Home" || event.key === "End") {
                event.preventDefault();
                keyboardSelection = null;
                goTo(event.key === "Home" ? 0 : layout.maxScrollColumn);
            }
        }
        function onPointerMove(event: PointerEvent) {
            if (drag && drag.pointerId === event.pointerId) {
                const delta = drag.x - event.clientX;
                if (Math.abs(delta) > 6) {
                    suppressClick.current = true;
                    viewport.setPointerCapture(drag.pointerId);
                    event.preventDefault();
                    scroller.dragTo(drag.scroll + delta);
                }
            }
            const link = (
                event.target as HTMLElement
            ).closest<HTMLAnchorElement>("[data-card-id]");
            hovered = link?.dataset.cardId || "";
            if (link) {
                if (!drag && event.pointerType === "mouse")
                    selectCard(link.dataset.cardId);
            }
            invalidate();
        }
        function onPointerDown(event: PointerEvent) {
            if (blocked.current) return;
            if (
                (event.target as HTMLElement).closest(
                    "[data-grid-form] input, [data-grid-form] textarea, [data-grid-form] select, [data-grid-form] button, [data-grid-form] label, [data-grid-form] a, [data-grid-scroll]"
                )
            )
                return;
            if (
                !event.isPrimary ||
                (event.pointerType === "mouse" && event.button !== 0)
            )
                return;
            suppressClick.current = false;
            keyboardSelection = null;
            clearTimeout(wheelEndTimer);
            scroller.beginDrag();
            drag = {
                x: event.clientX,
                scroll: viewport.scrollLeft,
                pointerId: event.pointerId,
            };
        }
        function onPointerUp(event: PointerEvent) {
            if (!drag || drag.pointerId !== event.pointerId) return;
            drag = null;
            scroller.settle();
        }
        function onPointerLeave() {
            hovered = "";
            invalidate();
        }
        function onVisibilityChange() {
            if (!document.hidden) invalidate();
        }
        function onScroll() {
            invalidate();
        }
        refreshScene.current = () => {
            // Extending the feed must not dispose the scroller, interrupt a drag,
            // cancel arrow-key motion, or rewrite the current scroll position.
            ({ cards, layout } = sceneData.current);
            content.style.width = `${
                metrics.width + layout.maxScrollColumn * metrics.columnStride
            }px`;
            cancelAnimationFrame(frame);
            frame = 0;
            render();
        };
        controlsRef.current = {
            next: () => {
                viewport.focus({ preventScroll: true });
                step(1);
            },
            previous: () => {
                viewport.focus({ preventScroll: true });
                step(-1);
            },
            goTo,
        };
        const observer = new ResizeObserver(resize);
        observer.observe(viewport);
        resize();
        viewport.addEventListener("focusin", onFocusIn);
        viewport.addEventListener("scroll", onScroll, { passive: true });
        viewport.addEventListener("wheel", onWheel, { passive: false });
        viewport.addEventListener("pointerdown", onPointerDown);
        viewport.addEventListener("pointermove", onPointerMove);
        viewport.addEventListener("pointerleave", onPointerLeave);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);
        window.addEventListener("keydown", onKeyDown);
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            stopped = true;
            cancelAnimationFrame(frame);
            scroller.dispose();
            clearTimeout(wheelEndTimer);
            observer.disconnect();
            viewport.removeEventListener("focusin", onFocusIn);
            viewport.removeEventListener("scroll", onScroll);
            viewport.removeEventListener("wheel", onWheel);
            viewport.removeEventListener("pointerdown", onPointerDown);
            viewport.removeEventListener("pointermove", onPointerMove);
            viewport.removeEventListener("pointerleave", onPointerLeave);
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("pointercancel", onPointerUp);
            window.removeEventListener("keydown", onKeyDown);
            document.removeEventListener(
                "visibilitychange",
                onVisibilityChange
            );
            transition.invalidate.current = () => {};
            invalidateGraphics.current = () => {};
            refreshScene.current = () => {};
        };
    }, [
        transition.key,
        columns,
        visibleRows,
        flat,
        formGrid,
        onFlatView,
        active,
        mode,
        creating,
        onCreate,
        activity,
        textureActivity,
    ]);

    useLayoutEffect(() => {
        refreshScene.current();
    }, [cards, layout, range.renderFrom, range.renderTo]);

    // Resting on a space's card starts its downloads before the click; a
    // press starts them at once (the click lands ~100ms later).
    const warmTimer = useRef(0);
    const restOnCard = (card: LandingCard) => {
        window.clearTimeout(warmTimer.current);
        if (creating) return;
        warmTimer.current = window.setTimeout(
            () => warmSpace(card),
            CARD_WARM_DWELL_MS
        );
    };
    const leaveCard = () => window.clearTimeout(warmTimer.current);
    const pressCard = (
        card: LandingCard,
        event: ReactPointerEvent<HTMLElement>
    ) => {
        if (event.button === 0 && !creating) warmSpace(card);
    };
    useEffect(() => () => window.clearTimeout(warmTimer.current), []);

    function recordLaunch(card: LandingCard) {
        amplitude_logAnalyticsEvent("click_exibition_thumbnail", {
            item_id: card.id,
            user_id: user?.id,
            item_name: card.title,
            source: creating
                ? "landing_create"
                : flat
                ? "landing_grid"
                : "landing_cylinder",
        });
    }

    return (
        <Gallery
            style={active ? undefined : { display: "none" }}
            aria-hidden={!active || undefined}
            aria-busy={transition.busy}
            data-grid-content={transition.key}
            data-grid-transition={transition.busy ? "animating" : "idle"}
        >
            <ViewportFrame $single={single}>
                <Viewport
                    ref={viewportRef}
                    tabIndex={0}
                    role="region"
                    aria-label={browseLabel}
                >
                    <ScrollContent ref={contentRef}>
                        <Stage ref={stageRef}>
                            {!flat && !formGrid && (
                                <canvas ref={canvasRef} aria-hidden="true" />
                            )}
                            {(creating || formGrid
                                ? layout.cells
                                : layout.cells.slice(
                                      range.renderFrom * visibleRows,
                                      range.renderTo * visibleRows
                                  )
                            ).map((cell) => {
                                const card = cards[cell.index];
                                const content = renderCard?.(card);
                                if (content)
                                    return (
                                        <GridPanel
                                            key={card.id}
                                            data-card-id={card.id}
                                            data-grid-form
                                            role="group"
                                            aria-label={card.title}
                                            ref={(element) => {
                                                if (element)
                                                    linksRef.current.set(
                                                        card.id,
                                                        element
                                                    );
                                                else
                                                    linksRef.current.delete(
                                                        card.id
                                                    );
                                            }}
                                        >
                                            {content}
                                        </GridPanel>
                                    );
                                return (
                                    <ExperienceCard
                                        key={card.id}
                                        card={card}
                                        flat={flat}
                                        featured={single}
                                        arrowOpensNewTab
                                        data-card-id={card.id}
                                        ref={(element) => {
                                            if (element)
                                                linksRef.current.set(
                                                    card.id,
                                                    element
                                                );
                                            else
                                                linksRef.current.delete(
                                                    card.id
                                                );
                                        }}
                                        onDragStart={(event) =>
                                            event.preventDefault()
                                        }
                                        onPointerEnter={() => restOnCard(card)}
                                        onPointerLeave={leaveCard}
                                        onFocus={() => restOnCard(card)}
                                        onBlur={leaveCard}
                                        onPointerDown={(event) =>
                                            pressCard(card, event)
                                        }
                                        onClick={(event) => {
                                            if (
                                                event.button !== 0 ||
                                                event.metaKey ||
                                                event.ctrlKey ||
                                                event.shiftKey ||
                                                event.altKey
                                            )
                                                return;
                                            if (transition.busy) {
                                                event.preventDefault();
                                                return;
                                            }
                                            if (suppressClick.current) {
                                                event.preventDefault();
                                                suppressClick.current = false;
                                                return;
                                            }
                                            // Enter may arrive before the selected column settles.
                                            const activatingSelection =
                                                event.detail === 0 &&
                                                selectedId.current === card.id;
                                            if (
                                                !event.metaKey &&
                                                !event.ctrlKey &&
                                                !activatingSelection &&
                                                (cell.column <
                                                    firstColumn.current ||
                                                    cell.column >=
                                                        firstColumn.current +
                                                            columns)
                                            ) {
                                                event.preventDefault();
                                                selectionSlots.current[mode] = {
                                                    column:
                                                        cell.column <
                                                        firstColumn.current
                                                            ? 0
                                                            : columns - 1,
                                                    row: cell.row,
                                                };
                                                controlsRef.current.goTo(
                                                    cell.column <
                                                        firstColumn.current
                                                        ? cell.column
                                                        : cell.column -
                                                              columns +
                                                              1
                                                );
                                                return;
                                            }
                                            if (!card.href) {
                                                event.preventDefault();
                                                return;
                                            }
                                            if (
                                                !event.metaKey &&
                                                !event.ctrlKey &&
                                                !event.shiftKey &&
                                                onCardActivate?.(card)
                                            ) {
                                                event.preventDefault();
                                                return;
                                            }
                                            recordLaunch(card);
                                        }}
                                    />
                                );
                            })}
                        </Stage>
                    </ScrollContent>
                </Viewport>
                <EdgeFade aria-hidden="true" />
                <EdgeFade $right aria-hidden="true" />
            </ViewportFrame>
            {single && (
                <FeaturedActions>
                    {featured.href ? (
                        <Link
                            href={featured.href}
                            spaceEntrance={
                                !creating && !featured.buildStatus
                                    ? {
                                          title: featured.title,
                                          image: featured.imageUrls[0],
                                          source: () =>
                                              linksRef.current.get(featured.id),
                                      }
                                    : undefined
                            }
                            prefetch={false}
                            onPointerEnter={() => restOnCard(featured)}
                            onPointerLeave={leaveCard}
                            onFocus={() => restOnCard(featured)}
                            onBlur={leaveCard}
                            onPointerDown={(event) =>
                                pressCard(featured, event)
                            }
                            onClick={(event) => {
                                if (
                                    event.button !== 0 ||
                                    event.metaKey ||
                                    event.ctrlKey ||
                                    event.shiftKey ||
                                    event.altKey
                                )
                                    return;
                                if (
                                    transition.busy ||
                                    (!event.metaKey &&
                                        !event.ctrlKey &&
                                        !event.shiftKey &&
                                        onCardActivate?.(featured))
                                )
                                    event.preventDefault();
                                else recordLaunch(featured);
                            }}
                        >
                            <Icon name="play" size={15} />{" "}
                            {featuredActionLabel ||
                                (creating
                                    ? featured.buildStatus || "Continue"
                                    : "Launch")}
                        </Link>
                    ) : (
                        <span className="unavailable">
                            {formGrid ? featured.title : featured.buildStatus}
                        </span>
                    )}
                    <span className="scroll-hint">Scroll to explore</span>
                    <div>
                        <button
                            aria-label="Previous world"
                            disabled={range.atStart}
                            onClick={() => controlsRef.current.previous()}
                        >
                            <Icon name="back" size={18} />
                        </button>
                        <button
                            aria-label="Next world"
                            disabled={range.atEnd}
                            onClick={() => controlsRef.current.next()}
                        >
                            <Icon name="forward" size={18} />
                        </button>
                    </div>
                </FeaturedActions>
            )}
            <GalleryFooter>
                {footerStart ?? (
                    <button
                        id="open-create"
                        onClick={onCreate}
                        aria-pressed={creating}
                        title={
                            createTitle ||
                            (creating
                                ? "Back to exploring worlds"
                                : "Create with Oncyber")
                        }
                        className="create-link"
                    >
                        <span>
                            {createLabel}
                            <CreateIcon open={creating} />
                        </span>
                    </button>
                )}
                <div className="browse-controls">
                    {loadingMore && (
                        <span className="loading-more" role="status">
                            Loading more worlds…
                        </span>
                    )}
                    {hasMore && error && (
                        <button
                            className="load-more"
                            disabled={loadingMore}
                            onClick={loadMore}
                        >
                            Try loading more again{" "}
                            <Icon name="plus" size={12} />
                        </button>
                    )}
                    <span className="counter" aria-live="polite">
                        <b>
                            {String(range.first).padStart(2, "0")}
                            {!single && (
                                <>—{String(range.last).padStart(2, "0")}</>
                            )}
                        </b>
                        <span> / </span>
                        {cards.length}{" "}
                        <span className="counter-label">
                            {counterLabel || (creating ? "options" : "worlds")}
                        </span>
                    </span>
                    {!single && (
                        <div className="arrows">
                            <button
                                aria-label="Previous worlds"
                                disabled={range.atStart}
                                onClick={() => controlsRef.current.previous()}
                            >
                                <Icon name="back" size={15} />
                            </button>
                            <button
                                aria-label="Next worlds"
                                disabled={range.atEnd}
                                onClick={() => controlsRef.current.next()}
                            >
                                <Icon name="forward" size={15} />
                            </button>
                        </div>
                    )}
                    {viewControls}
                </div>
            </GalleryFooter>
        </Gallery>
    );
}

const Gallery = styled.div`
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
`;
const ViewportFrame = styled.div<{ $single: boolean }>`
    position: relative;
    flex: 1;
    min-height: 0;
    isolation: isolate;
    margin-block: ${({ $single }) =>
        $single
            ? "calc(-1 * min(4.5svh, 40px))"
            : "calc(-1 * min(1.5svh, 14px))"};
    /* Lift the cards off the bottom controls; their size is unchanged. */
    transform: translateY(-20px);
    @media (max-width: 700px) {
        margin-block: 0;
        transform: none;
    }
`;
const Viewport = styled.div`
    height: 100%;
    position: relative;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    scroll-behavior: auto;
    touch-action: pan-y pinch-zoom;
    &::-webkit-scrollbar {
        display: none;
        width: 0;
        height: 0;
    }
    &:focus-visible {
        outline: none;
    }
`;
const ScrollContent = styled.div`
    height: 100%;
`;
const Stage = styled.div`
    height: 100%;
    position: sticky;
    left: 0;
    overflow: hidden;
    user-select: none;
    canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: block;
    }
`;
const EdgeFade = styled.div<{ $right?: boolean }>`
    position: absolute;
    z-index: 2;
    pointer-events: none;
    top: 0;
    bottom: 4px;
    width: clamp(12px, 2vw, 30px);
    ${({ $right }) =>
        $right ? "right: 0; transform: scaleX(-1);" : "left: 0;"}
    background: linear-gradient(to right, #101010, #10101000);
`;
const FeaturedActions = styled.div`
    width: var(--gallery-width, 46.3%);
    height: 10.6svh;
    min-height: 58px;
    flex-shrink: 0;
    align-self: center;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    > a {
        display: flex;
        gap: 12px;
        align-items: center;
        font-weight: 500;
    }
    > a svg {
        color: var(--accent);
    }
    .unavailable {
        color: var(--oc-muted);
        font-size: 12px;
    }
    .scroll-hint {
        font-family: var(--oc-mono);
        font-size: 10px;
        color: var(--oc-muted);
    }
    > div {
        display: flex;
        gap: 24px;
    }
    button {
        background: none;
        border: 0;
        padding: 8px;
        border-radius: 50%;
        color: var(--oc-secondary);
        cursor: pointer;
        display: flex;
        transition: background var(--oc-fast), color var(--oc-fast);
    }
    button:disabled {
        opacity: 0.2;
    }
    button:hover:not(:disabled),
    a:hover {
        color: var(--accent);
    }
    button:hover:not(:disabled) {
        background: var(--oc-surface);
    }
    @media (max-width: 700px) {
        height: 12svh;
        .scroll-hint {
            display: none;
        }
    }
`;
const GalleryFooter = styled.div`
    height: 17.8svh;
    min-height: 76px;
    flex-shrink: 0;
    margin: 0 7%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: center;
    .create-link {
        padding: 10px 0;
        border: 0;
        background: none;
        cursor: pointer;
        justify-self: start;
        font-size: 14px;
        color: var(--oc-secondary);
        display: flex;
        gap: 12px;
        align-items: center;
    }
    .create-link[aria-pressed="true"] {
        color: var(--oc-accent);
    }
    .create-link {
        --create-icon-color: var(--oc-accent);
    }
    .browse-controls,
    .arrows,
    .load-more {
        display: flex;
        align-items: center;
    }
    .browse-controls {
        gap: 16px;
        justify-self: end;
        position: relative;
    }
    .counter {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        font-family: var(--oc-mono);
        font-size: 10px;
        color: var(--oc-muted);
        white-space: nowrap;
    }
    .counter b {
        color: var(--oc-secondary);
        font-weight: 400;
    }
    .counter-label {
        display: none;
    }
    .arrows {
        gap: 5px;
    }
    .arrows button,
    .load-more {
        color: var(--oc-secondary);
        background: transparent;
        border: 0;
        border-radius: var(--oc-radius-inset);
        padding: 7px;
        cursor: pointer;
        display: flex;
        transition: background var(--oc-fast), color var(--oc-fast);
    }
    button:hover:not(:disabled) {
        color: var(--oc-accent);
    }
    .arrows button:hover:not(:disabled) {
        background: var(--oc-surface);
    }
    button:disabled {
        opacity: 0.25;
        cursor: default;
    }
    .load-more {
        position: absolute;
        bottom: 100%;
        right: 0;
        white-space: nowrap;
        gap: 6px;
        font-size: 10px;
    }
    .loading-more {
        position: absolute;
        bottom: 100%;
        right: 0;
        white-space: nowrap;
        color: var(--oc-muted);
        font-size: 10px;
        padding-bottom: 4px;
    }
    .load-error {
        color: #caaa8c;
        font-size: 9px;
    }
    @media (max-width: 700px) {
        margin: 0 20px;
        height: 18svh;
        min-height: 144px;
        align-content: end;
        align-items: center;
        padding-bottom: 28px;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        .create-link {
            font-size: 12px;
            --create-icon-gap: 5px;
        }
        .browse-controls {
            gap: 2px;
        }
        .load-error {
            display: none;
        }
        .arrows button {
            padding: 6px 2px;
        }
        .arrows {
            gap: 4px;
        }
    }
`;

const GridPanel = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    min-width: 0;
    overflow: hidden;
    border-radius: var(--oc-radius-card);
    background: var(--oc-panel);
    color: var(--oc-ink);
    isolation: isolate;
    &:focus-visible {
        outline: 2px solid var(--oc-accent);
        outline-offset: -3px;
    }
`;
