import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { UserContext } from "@components/context/UserContext";
import { useRouter } from "next/router";
import type { TemplateGridData } from "./components/TemplateCatalog";
import {
    parseTemplateCategory,
    templateSearchPatch,
    type TemplateCategory,
} from "./templateSearch";
import type { LandingCard } from "./types";
import { creationToggleStep, creationStep } from "./creationSteps";
import Header from "./components/Header";
import ImmersiveViewportStyle from "@features/content-host/ImmersiveViewportStyle";
import dynamic from "next/dynamic";
import styled from "styled-components";
import { ActionButton, compactActionSizing } from "@styles/brand";
import EmptyState from "@ui/components/EmptyState";
import {
    Page,
    BrowseSurface,
    EmptyFooter,
    ViewControls,
} from "./components/GridPage";
import DiscoveryHeader from "./components/DiscoveryHeader";
import BottomSearch from "./components/BottomSearch";
import { BUILD_CARDS } from "./buildOptions";
import Icon from "./components/Icon";
import { GLASSES_ICON_URL } from "./glassesIcon";
import LoadingGrid from "./components/LoadingGrid";
import { CoverImage } from "./components/ExperienceCard";
import { LandingPageProps } from "./types";
import { setDefaultFeedCategory } from "./data";
import useDiscovery from "./hooks/useDiscovery";
import { useLobbyPopulation } from "@features/lobby/useLobbyPopulation";
import { pendingLobbyReturn } from "@utils/lobbyReturnTransition";
import useDestinationPreviews from "./hooks/useDestinationPreviews";
import { CreateIcon } from "./components/CreateIcon";
import {
    LandingActivityProvider,
    useActivitySignal,
    useLandingBusy,
} from "./activity";

const Lobby = dynamic(() => import("../lobby/Lobby"), { ssr: false });

const TemplateCatalog = dynamic(() => import("./components/TemplateCatalog"), {
    ssr: false,
});
const TEMPLATE_LOADING_CARDS: LandingCard[] = Array.from(
    { length: 4 },
    (_, index) => ({
        ...BUILD_CARDS[0],
        id: `loading-template-${index}`,
        title: "Loading templates…",
        href: "",
        imageUrls: [],
        buildStatus: "Your existing Oncyber templates",
    })
);
const GRID_SIZES = [
    { columns: 2, rows: 2 },
    { columns: 1, rows: 1 },
];
/** Phones show one column of two cards instead of the 2×2 grid. */
const MOBILE_GRID_SIZES = [
    { columns: 1, rows: 2 },
    { columns: 1, rows: 1 },
];
const MOBILE_QUERY = "(max-width: 700px)";

function useMobileLayout() {
    const [mobile, setMobile] = useState(false);
    useEffect(() => {
        const query = window.matchMedia?.(MOBILE_QUERY);
        if (!query) return;
        const update = () => setMobile(query.matches);
        update();
        query.addEventListener?.("change", update);
        return () => query.removeEventListener?.("change", update);
    }, []);
    return mobile;
}

const Scene = dynamic(() => import("./components/Scene"), {
    ssr: false,
    loading: () => <LoadingGrid reserveFooter />,
});

export default function LandingCarouselPage(props: LandingPageProps) {
    // Before any discovery hook reads DEFAULT_FILTERS (landing + lobby panel).
    setDefaultFeedCategory(props.defaultCategory);
    return (
        <LandingActivityProvider>
            <LandingContent {...props} />
        </LandingActivityProvider>
    );
}

function LandingContent(props: LandingPageProps) {
    const discovery = useDiscovery(props);
    const { userData } = useContext(UserContext);
    const avatarIdentity = useRef(userData);
    avatarIdentity.current = userData;
    const avatarKey = JSON.stringify([
        userData?.settings?.vrm,
        userData?.settings?.default_vrm_scale,
        userData?.avatarContractAddress,
        userData?.walletId,
        (userData as any)?.vrmUrl,
        (userData as any)?.VRM,
    ]);
    const warmedAvatar = useRef<string>(null);
    const warmLobbyAvatar = useCallback(() => {
        if (document.hidden || warmedAvatar.current === avatarKey) return;
        warmedAvatar.current = avatarKey;
        const identity = avatarIdentity.current;
        // Import only avatar assets/animation code. A lobby world, controls,
        // multiplayer and microphone are never started from the landing.
        void import("../lobby/LobbyRenderer")
            .then(({ preloadLobbyRendererAvatar }) =>
                preloadLobbyRendererAvatar(identity)
            )
            .catch(() => {
                // An opportunistic failure must not prevent a later retry.
                if (warmedAvatar.current === avatarKey)
                    warmedAvatar.current = null;
            });
    }, [avatarKey]);
    const {
        filters,
        update,
        cards: discoveryCards,
        loading,
        error,
        hasMore,
        loadingMore,
        loadMoreError,
        loadMore,
    } = discovery;
    // Image-only fallback for WebGL failures; curvature is never a user mode.
    const [flat, setFlat] = useState(false);
    const [gridChoice, setGridChoice] = useState(0);
    const gridSizes = useMobileLayout() ? MOBILE_GRID_SIZES : GRID_SIZES;
    const grid = gridSizes[gridChoice];
    const router = useRouter();
    const inLobby = router.query.lobby === "1";
    const [browseVisible, setBrowseVisible] = useState(!inLobby);
    const [lobbyReady, setLobbyReady] = useState(false);
    const [lobbyClosing, setLobbyClosing] = useState(false);
    const mainRef = useRef<HTMLElement>(null);
    useEffect(() => {
        mainRef.current?.toggleAttribute("inert", inLobby);
        if (!inLobby) {
            setBrowseVisible(true);
            setLobbyReady(false);
            setLobbyClosing(false);
            return;
        }
        const timeout = setTimeout(() => setBrowseVisible(false), 700);
        return () => clearTimeout(timeout);
    }, [inLobby]);
    const setLobby = useCallback(
        (open: boolean) => {
            const query = { ...router.query };
            if (open) {
                query.lobby = "1";
                delete query.create;
            } else delete query.lobby;
            void router.push({ pathname: router.pathname, query }, undefined, {
                shallow: true,
                scroll: false,
            });
        },
        [router]
    );
    const leaveLobby = useCallback(() => {
        setBrowseVisible(true);
        setLobbyClosing(true);
    }, []);
    useEffect(() => {
        if (!lobbyClosing) return;
        const timeout = setTimeout(
            () => setLobby(false),
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? 0
                : 650
        );
        return () => clearTimeout(timeout);
    }, [lobbyClosing, setLobby]);
    const step = creationStep(router.pathname, router.query.create);
    const templateContext = step === "gallery";
    const templateQuery =
        typeof router.query.templateSearch === "string"
            ? router.query.templateSearch
            : "";
    const templateCategory = parseTemplateCategory(
        router.query.templateCategory
    );
    const updateTemplates = useCallback(
        (patch: {
            create?: string;
            templateSearch?: string;
            templateCategory?: TemplateCategory;
        }) => {
            const query: typeof router.query = { ...router.query, ...patch };
            if (!query.templateSearch) delete query.templateSearch;
            if (query.templateCategory === "all") delete query.templateCategory;
            // Old availability links must not hide the rest of the catalog.
            delete query.availability;
            void router.push({ pathname: router.pathname, query }, undefined, {
                shallow: true,
                scroll: false,
            });
        },
        [router]
    );
    const creating = step !== "explore";
    const cards = useDestinationPreviews(discoveryCards, !creating);
    useEffect(() => {
        if (loading || creating || inLobby) return;
        let cancelled = false;
        let frame: number;
        let idle: number;
        let timeout: number;
        const clearScheduled = () => {
            window.cancelAnimationFrame(frame);
            if (idle !== undefined) window.cancelIdleCallback?.(idle);
            window.clearTimeout(timeout);
        };
        const prepare = () => {
            if (!cancelled && !document.hidden) warmLobbyAvatar();
        };
        const schedule = () => {
            clearScheduled();
            if (document.hidden) return;
            // Let discovery paint before importing the avatar loader. The
            // timeout also gives browsers without idle callbacks a quiet start.
            frame = window.requestAnimationFrame(() => {
                frame = window.requestAnimationFrame(() => {
                    if (window.requestIdleCallback) {
                        idle = window.requestIdleCallback(prepare, {
                            timeout: 1200,
                        });
                    } else {
                        timeout = window.setTimeout(prepare, 250);
                    }
                });
            });
        };
        document.addEventListener("visibilitychange", schedule);
        schedule();
        return () => {
            cancelled = true;
            clearScheduled();
            document.removeEventListener("visibilitychange", schedule);
        };
    }, [loading, creating, inLobby, warmLobbyAvatar]);
    const emptyPageLoader = useRef(loadMore);
    emptyPageLoader.current = loadMore;
    useEffect(() => {
        // A filtered server page can contain no matches but still have a cursor.
        // Keep paging until we can display cards or reach the actual end.
        if (
            !creating &&
            !loading &&
            !loadingMore &&
            hasMore &&
            !error &&
            !loadMoreError &&
            !cards.length
        )
            emptyPageLoader.current();
    }, [
        creating,
        loading,
        loadingMore,
        hasMore,
        error,
        loadMoreError,
        cards.length,
    ]);
    const [templates, setTemplates] = useState<TemplateGridData>(null);
    const [loadTemplates, setLoadTemplates] = useState(step === "gallery");
    useLandingBusy(
        creating
            ? step === "gallery" &&
                  (!templates || templates.loading || !!templates.opening)
            : loading || loadingMore
    );
    const routeActivity = useActivitySignal();
    useEffect(() => {
        const pending = new Set<string>();
        const start = (url: string) => {
            pending.add(url);
            routeActivity(true);
        };
        const finish = (url: string) => {
            pending.delete(url);
            routeActivity(pending.size > 0);
        };
        const fail = (_error: unknown, url: string) => finish(url);
        router.events.on("routeChangeStart", start);
        router.events.on("routeChangeComplete", finish);
        router.events.on("routeChangeError", fail);
        return () => {
            router.events.off("routeChangeStart", start);
            router.events.off("routeChangeComplete", finish);
            router.events.off("routeChangeError", fail);
            routeActivity(false);
        };
    }, [router.events, routeActivity]);
    useEffect(() => {
        // Prepare destinations while browsing, before the first Create click.
        setLoadTemplates(true);
    }, []);
    const goToStep = useCallback(
        (next: string) => {
            const query = { ...router.query };
            if (next === "explore") delete query.create;
            else query.create = next;
            // Stay on the same page: only the cards change, including browser Back/Forward.
            if (
                router.pathname.startsWith("/studio/new-") &&
                next === "explore"
            )
                query.create = "explore";
            void router.push({ pathname: router.pathname, query }, undefined, {
                shallow: true,
                scroll: false,
            });
        },
        [router]
    );
    const toggleCreate = useCallback(() => {
        goToStep(creationToggleStep(step));
    }, [step, goToStep]);
    const activateCard = (card: LandingCard) => {
        if (card.id.startsWith("template-")) {
            templates?.open(card);
            return true;
        }
        return false;
    };
    const templateEmpty =
        step === "gallery" &&
        templates &&
        !templates.loading &&
        !templates.cards.length;
    useEffect(() => {
        if (!templateEmpty) return;
        const closeEmptyGallery = (event: KeyboardEvent) => {
            if (
                event.key !== "Escape" ||
                event.defaultPrevented ||
                (event.target as HTMLElement).closest(
                    'input, textarea, select, header, dialog, [role="dialog"]'
                )
            )
                return;
            toggleCreate();
        };
        document.addEventListener("keydown", closeEmptyGallery);
        return () => document.removeEventListener("keydown", closeEmptyGallery);
    }, [templateEmpty, toggleCreate]);
    const gridCards =
        step === "gallery"
            ? templates?.cards.length
                ? templates.cards
                : TEMPLATE_LOADING_CARDS
            : cards;
    const showGrid = !templateEmpty && (creating || cards.length > 0);
    const retainedGridCards = useRef(gridCards);
    if (showGrid) retainedGridCards.current = gridCards;

    const searchWorlds = (patch: Parameters<typeof update>[0]) => {
        update(patch);
    };
    const createControl = (
        <CreateControl
            id="open-create"
            onClick={toggleCreate}
            aria-pressed={creating}
            title={creating ? "Back to exploring worlds" : "Create a gallery"}
        >
            <span>
                create
                <CreateIcon open={creating} />
            </span>
        </CreateControl>
    );
    const gridControls = (
        <ViewControls>
            <div className="density" role="group" aria-label="Grid size">
                {gridSizes.map((size, index) => (
                    <button
                        key={`${size.columns}x${size.rows}`}
                        aria-label={`${size.columns} by ${size.rows} grid`}
                        aria-pressed={gridChoice === index}
                        onClick={() => setGridChoice(index)}
                    >
                        {size.columns}×{size.rows}
                    </button>
                ))}
            </div>
        </ViewControls>
    );
    const lobbyPopulation = useLobbyPopulation(!creating && !inLobby);
    const viewControls = (
        <ViewControls>
            {!creating && (
                <button
                    className="jump-in"
                    onPointerEnter={warmLobbyAvatar}
                    onFocus={warmLobbyAvatar}
                    onClick={() => {
                        warmLobbyAvatar();
                        setLobby(true);
                    }}
                >
                    <EnterPortalIcon aria-hidden="true" />
                    <span className="jump-in-label">Jump In</span>
                    {lobbyPopulation != null && (
                        <span
                            className="lobby-count"
                            aria-label={`${lobbyPopulation} ${
                                lobbyPopulation === 1 ? "person" : "people"
                            } in the lobby`}
                        >
                            {lobbyPopulation}
                        </span>
                    )}
                </button>
            )}
        </ViewControls>
    );

    return (
        <LobbyPage
            $gallery={step === "gallery"}
            data-in-lobby={(inLobby && !lobbyClosing) || undefined}
            data-lobby-closing={lobbyClosing || undefined}
            data-lobby-ready={(lobbyReady && !lobbyClosing) || undefined}
        >
            {inLobby && <ImmersiveViewportStyle />}
            <a
                className="skip-link"
                href={inLobby ? "#lobby-controls" : "#worlds"}
            >
                {inLobby
                    ? "Skip to lobby controls"
                    : creating
                    ? "Skip to gallery destinations"
                    : "Skip to worlds"}
            </a>
            {loadTemplates && !inLobby && (
                <TemplateCatalog
                    onChange={setTemplates}
                    query={templateQuery}
                    category={templateCategory}
                    active={step === "gallery"}
                />
            )}
            <DiscoveryHeader
                immersive={inLobby}
                onHome={inLobby ? leaveLobby : undefined}
                key={templateContext ? "templates" : "worlds"}
                filters={filters}
                update={searchWorlds}
                createControl={createControl}
                templates={
                    templateContext
                        ? {
                              category: templateCategory,
                              update: (category) =>
                                  updateTemplates({
                                      templateCategory: category,
                                      create: "gallery",
                                  }),
                          }
                        : undefined
                }
            />
            <main
                ref={mainRef}
                aria-hidden={inLobby || undefined}
                id="worlds"
                aria-label={
                    creating ? "Create with Oncyber" : "Explore Oncyber worlds"
                }
            >
                <BrowseSurface>
                    {/* Opening shows on the picked card itself. */}
                    {step === "gallery" && templates?.error && (
                        <TemplateStatus role="alert">
                            {templates.error}
                        </TemplateStatus>
                    )}
                    <div className="results" aria-busy={!creating && loading}>
                        {retainedGridCards.current.length > 0 && (
                            <Scene
                                active={showGrid && browseVisible}
                                interactionsBlocked={inLobby}
                                creating={creating}
                                onCreate={toggleCreate}
                                cards={retainedGridCards.current}
                                contentKey={
                                    step === "gallery"
                                        ? `gallery:${
                                              templates?.cards
                                                  .map((card) => card.id)
                                                  .join(",") || "loading"
                                          }`
                                        : `explore:${discovery.resultKey}`
                                }
                                onCardActivate={activateCard}
                                counterLabel={
                                    step === "gallery" ? "templates" : undefined
                                }
                                flat={flat}
                                onFlatView={setFlat}
                                columns={grid.columns}
                                visibleRows={grid.rows}
                                footerStart={gridControls}
                                viewControls={viewControls}
                                resetKey={discovery.resultKey}
                                hasMore={!creating && !loading && hasMore}
                                loadingMore={!creating && loadingMore}
                                error={!creating && (error || loadMoreError)}
                                loadMore={loadMore}
                            />
                        )}
                        {!creating &&
                        !cards.length &&
                        (loading || (hasMore && !error && !loadMoreError)) ? (
                            <LoadingGrid grid={grid} />
                        ) : templateEmpty ? (
                            <EmptyState
                                size="page"
                                titleAs="h2"
                                icon="globe"
                                title={
                                    templateQuery
                                        ? "No matching rooms."
                                        : "No galleries found."
                                }
                                detail={
                                    templateCategory !== "all"
                                        ? "Try another template category."
                                        : templateQuery
                                        ? "Try another name, artist, or style."
                                        : "The catalog updates automatically. Please try again in a moment."
                                }
                                action={
                                    templateCategory !== "all"
                                        ? {
                                              label: "Show all templates",
                                              onClick: () =>
                                                  updateTemplates({
                                                      templateCategory: "all",
                                                  }),
                                          }
                                        : templateQuery
                                        ? {
                                              label: "Clear template search",
                                              onClick: () =>
                                                  updateTemplates(
                                                      templateSearchPatch("")
                                                  ),
                                          }
                                        : null
                                }
                            />
                        ) : !creating && !cards.length ? (
                            <EmptyState
                                size="page"
                                titleAs="h2"
                                role={error ? "alert" : "status"}
                                icon={error ? "globe" : "search"}
                                title={
                                    error
                                        ? "Couldn’t load worlds."
                                        : "No worlds found."
                                }
                                detail={
                                    error
                                        ? "Please try again."
                                        : "Try another search or remove a filter."
                                }
                                action={
                                    error
                                        ? {
                                              label: "Try again",
                                              icon: (
                                                  <Icon
                                                      name="arrow"
                                                      size={12}
                                                  />
                                              ),
                                              onClick: loadMoreError
                                                  ? loadMore
                                                  : discovery.retry,
                                          }
                                        : {
                                              label: "Explore all",
                                              icon: (
                                                  <Icon
                                                      name="arrow"
                                                      size={12}
                                                  />
                                              ),
                                              onClick: discovery.reset,
                                          }
                                }
                            >
                                {!error && hasMore && (
                                    // A failed "load more" with nothing
                                    // shown yet: loading the next page is
                                    // the second way forward.
                                    <ActionButton
                                        onClick={loadMore}
                                        disabled={loadingMore}
                                    >
                                        {loadingMore ? "Loading…" : "Load more"}
                                    </ActionButton>
                                )}
                            </EmptyState>
                        ) : null}
                    </div>
                    {(templateEmpty || (!creating && !cards.length)) && (
                        <EmptyFooter className="landing-footer">
                            {gridControls}
                            {viewControls}
                        </EmptyFooter>
                    )}
                    <noscript>
                        <FallbackLinks>
                            {props.initialFeed.cards.map((card) => (
                                <a href={card.href} key={card.id}>
                                    <CoverImage card={card} />
                                    <span>{card.title}</span>
                                </a>
                            ))}
                        </FallbackLinks>
                    </noscript>
                </BrowseSurface>
            </main>
            {!inLobby && (
                <BottomSearch
                    scope={templateContext ? "templates" : "worlds"}
                    value={templateContext ? templateQuery : filters.q}
                    onChange={
                        templateContext ? undefined : (q) => searchWorlds({ q })
                    }
                    onSearch={(q) =>
                        templateContext
                            ? updateTemplates({
                                  ...templateSearchPatch(q),
                                  create: "gallery",
                              })
                            : searchWorlds({ q })
                    }
                />
            )}
            {inLobby && (
                <Lobby
                    initialReturn={pendingLobbyReturn()}
                    cards={cards.length ? cards : props.initialFeed.cards}
                    onExit={leaveLobby}
                    onReady={() => setLobbyReady(true)}
                />
            )}
        </LobbyPage>
    );
}

const EnterPortalIcon = styled.span`
    display: block;
    flex: 0 0 22.5px;
    width: 22.5px;
    height: 10px;
    margin: 0 1px 0 -2px;
    /* Anaglyph 3D glasses; the red lens is the Create accent token. */
    background: url("${GLASSES_ICON_URL}") center / contain no-repeat;
`;

const CreateControl = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
    padding: 10px 0;
    border: 0;
    border-radius: var(--oc-radius-control);
    background: none;
    color: var(--oc-secondary);
    font-size: 14px;
    cursor: pointer;
    white-space: nowrap;
    transition: color var(--oc-fast);
    &:hover,
    &[aria-pressed="true"] {
        color: var(--oc-ink);
    }
    @media (max-width: 700px) {
        font-size: 12px;
        --create-icon-gap: 6px;
    }
`;

const TemplateStatus = styled.div`
    position: absolute;
    z-index: 2;
    top: -28px;
    left: 11.3%;
    right: 11.3%;
    color: var(--oc-secondary);
    font-size: 11px;
    @media (max-width: 700px) {
        left: 6%;
        right: 6%;
    }
`;
const FallbackLinks = styled.div`
    position: absolute;
    inset: 110px 20px 0;
    overflow: auto;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    background: #101010;
    a {
        position: relative;
        min-height: 180px;
    }
    img {
        width: 100%;
    }
    span {
        display: block;
        padding: 10px;
    }
`;

const LobbyPage = styled(Page)`
    .landing-footer > :first-child {
        justify-self: start;
    }

    &[data-in-lobby] {
        position: fixed;
        inset: 0;
        height: 100dvh;
        overscroll-behavior: none;
        /* Lobby controls must stay inside short and landscape viewports. */
        min-height: 0;
        /* Keep avatar-picker focus from scrolling the faded discovery content. */
        overflow: clip;
    }
    > main {
        transition: opacity 600ms cubic-bezier(0.2, 0.8, 0.2, 1),
            transform 800ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    &[data-in-lobby] > main {
        opacity: 0;
        transform: translateY(24px) scale(0.985);
        pointer-events: none;
    }
    &[data-in-lobby] > header {
        pointer-events: none;
    }
    &[data-in-lobby] > header .brand,
    &[data-in-lobby] > header .account-actions {
        pointer-events: auto;
    }
    > header {
        transition: margin 900ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    > header .brand,
    > header .account-actions {
        transition: filter 1000ms ease,
            transform 900ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    &[data-in-lobby] > header {
        margin: 0 24px;
    }
    &[data-in-lobby] > header .brand,
    &[data-in-lobby] > header .account-actions {
        transform: translateY(calc(48px - 15.3svh));
    }
    [data-lobby-surface] {
        transition: opacity 650ms ease;
    }
    &[data-lobby-closing] [data-lobby-surface] {
        opacity: 0;
        pointer-events: none;
    }
    &[data-lobby-closing] [data-lobby-surface] * {
        pointer-events: none;
    }
    /* The lobby shares the landing’s dark canvas; keep the white identity. */
    &[data-lobby-ready] > header .account-detail {
        color: #969aa3;
    }
    .jump-in {
        ${compactActionSizing}
        /* A compact action beside the search bar, not a second bar. */
        min-height: 36px;
        height: 36px;
        gap: 7px;
        padding: 0 12px 0 10px;
        border-radius: 10px;
        font-size: 13px;
        color: #f3f3ed;
        background: transparent;
        box-shadow: inset 0 0 0 1px rgba(243, 243, 237, 0.55);
        transition: background 180ms ease, box-shadow 180ms ease;
    }
    .jump-in:hover:not([aria-pressed="true"]) {
        color: #fff;
        background: rgba(243, 243, 237, 0.08);
        box-shadow: inset 0 0 0 1px #f3f3ed;
    }
    .jump-in .lobby-count {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        margin-left: 1px;
        padding-left: 7px;
        border-left: 1px solid rgba(243, 243, 237, 0.3);
        font-variant-numeric: tabular-nums;
    }
    /* Aeonik sits its capitals ~0.5px below the line box centre; lift the
       words (and the count's digits) so they line up with the icon. */
    .jump-in .jump-in-label,
    .jump-in .lobby-count {
        position: relative;
        top: -1px;
    }
    .jump-in .lobby-count::before {
        position: relative;
        top: 1px;
        content: "";
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #4ade80;
        box-shadow: 0 0 6px rgba(74, 222, 128, 0.7);
    }
    @media (max-width: 700px) {
        &[data-in-lobby] > header {
            margin: 0 20px;
        }
        &[data-in-lobby] > header .brand,
        &[data-in-lobby] > header .account-actions {
            transform: translateY(calc(44px - 10svh));
        }
    }
    @media (prefers-reduced-motion: reduce) {
        > main,
        > header .brand,
        .jump-in {
            transition: none;
            transform: none !important;
        }
    }
`;
