import {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
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
import Link from "next/link";
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
import { searchWordSuggestions } from "./notFound";
import { setDefaultFeedCategory } from "./data";
import useDiscovery from "./hooks/useDiscovery";
import useWordMatches from "./hooks/useWordMatches";
import { useLobbyPopulation } from "@features/lobby/useLobbyPopulation";
import { pendingLobbyReturn } from "@utils/lobbyReturnTransition";
import useDestinationPreviews from "./hooks/useDestinationPreviews";
import useYourSpaces from "./hooks/useYourSpaces";
import {
    countSpaces,
    createSpaceCards,
    parseSpaceFilter,
    RESET_SPACES_ID,
    SHOW_ALL_SPACES_ID,
    SPACE_FILTERS,
    withSpaces,
} from "./yourSpaces";
import { CreateIcon } from "./components/CreateIcon";
import {
    LandingActivityProvider,
    useActivitySignal,
    useLandingBusy,
} from "./activity";
import { useCyberTranslation } from "@components/context/I18nContext";

const Lobby = dynamic(() => import("../lobby/Lobby"), { ssr: false });

const TemplateCatalog = dynamic(() => import("./components/TemplateCatalog"), {
    ssr: false,
});
const GRID = { columns: 2, rows: 2 };
/** Phones show one column of two cards instead of the 2×2 grid. */
const MOBILE_GRID = { columns: 1, rows: 2 };
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
    const { t } = useCyberTranslation();
    const grid = useMobileLayout() ? MOBILE_GRID : GRID;
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
        (
            patch: {
                create?: string;
                templateSearch?: string;
                templateCategory?: TemplateCategory;
            },
            // Searches sent while typing replace one another in history.
            typed = false
        ) => {
            const query: typeof router.query = { ...router.query, ...patch };
            if (!query.templateSearch) delete query.templateSearch;
            if (query.templateCategory === "all") delete query.templateCategory;
            // Old availability links must not hide the rest of the catalog.
            delete query.availability;
            void router[typed ? "replace" : "push"](
                { pathname: router.pathname, query },
                undefined,
                { shallow: true, scroll: false }
            );
        },
        [router]
    );
    const creating = step !== "explore";
    // A link that found nothing opens searching for its words: the matches,
    // then the staff picks and popular worlds, each under its label. Any
    // change to the search or filters returns to the usual results.
    const notFound = props.notFound;
    const notFoundMode =
        !!notFound &&
        !creating &&
        filters.q === notFound.query &&
        !filters.owner &&
        !filters.chain &&
        !filters.collection;
    const searching = notFoundMode && !!notFound.query;
    const fullSearchPending =
        searching &&
        (loading ||
            (!discoveryCards.length &&
                (loadingMore || (hasMore && !error && !loadMoreError))));
    // Every word has to match, so "frahm genesis" can find nothing while
    // "frahm" finds the Frahm galleries: show those as close matches.
    const wordsWanted =
        searching && !fullSearchPending && !discoveryCards.length;
    const wordMatches = useWordMatches(filters, wordsWanted);
    const resultsPending =
        fullSearchPending || (wordsWanted && wordMatches === null);
    const notFoundCards = useMemo(() => {
        if (!notFoundMode || resultsPending) return null;
        const results = !searching
            ? []
            : discoveryCards.length
            ? discoveryCards
            : wordMatches ?? [];
        const shown = new Set(results.map((card) => card.id));
        return [
            ...results.map((card) => ({
                ...card,
                section: "results" as const,
            })),
            ...notFound.sections.filter((card) => !shown.has(card.id)),
        ];
    }, [
        notFoundMode,
        resultsPending,
        searching,
        discoveryCards,
        wordMatches,
        notFound,
    ]);
    const notFoundLabels = notFoundMode
        ? {
              results: t(
                  discoveryCards.length
                      ? "Results for \u201c{query}\u201d"
                      : "Close to \u201c{query}\u201d",
                  { query: notFound.query }
              ),
              ...(searching && !discoveryCards.length && !wordMatches?.length
                  ? { staff: t("No matches \u00b7 Staff picks") }
                  : {}),
          }
        : undefined;
    const cards = useDestinationPreviews(
        notFoundCards ?? (notFoundMode ? [] : discoveryCards),
        !creating
    );
    // Only the matches page; more would land after the sections.
    const pagedHasMore = notFoundMode ? false : hasMore;
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
            (!notFoundMode || searching) &&
            !error &&
            !loadMoreError &&
            !(notFoundMode ? discoveryCards.length : cards.length)
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
        notFoundMode,
        searching,
        discoveryCards.length,
    ]);
    const [templates, setTemplates] = useState<TemplateGridData>(null);
    const [loadTemplates, setLoadTemplates] = useState(step === "gallery");
    // Signed-in creators find their own spaces ahead of the templates. They
    // load with the templates, before the first Create click.
    const yourSpaces = useYourSpaces(loadTemplates);
    const spacesExpanded = router.query.spaces === "all";
    const spaceFilter = parseSpaceFilter(router.query.spacesFilter);
    const filterSpaces = useCallback(
        (filter: string) => {
            const query: typeof router.query = {
                ...router.query,
                create: "gallery",
            };
            if (parseSpaceFilter(filter) === "latest")
                delete query.spacesFilter;
            else query.spacesFilter = filter;
            // Each filter starts from its first spaces again.
            delete query.spaces;
            void router.push({ pathname: router.pathname, query }, undefined, {
                shallow: true,
                scroll: false,
            });
        },
        [router]
    );
    const showSpaces = step === "gallery" && templateCategory === "all";
    const spaceCards = useMemo(
        () =>
            showSpaces && yourSpaces.spaces
                ? createSpaceCards(
                      yourSpaces.spaces,
                      templateQuery,
                      spacesExpanded,
                      yourSpaces.currentId,
                      spaceFilter
                  ).map((card) =>
                      card.spaceId && card.spaceId === yourSpaces.openingId
                          ? { ...card, opening: true }
                          : card
                  )
                : [],
        [
            showSpaces,
            yourSpaces.spaces,
            yourSpaces.currentId,
            yourSpaces.openingId,
            templateQuery,
            spacesExpanded,
            spaceFilter,
        ]
    );
    const spaceCount = useMemo(
        () =>
            showSpaces && yourSpaces.spaces
                ? countSpaces(yourSpaces.spaces, templateQuery, spaceFilter)
                : 0,
        [showSpaces, yourSpaces.spaces, templateQuery, spaceFilter]
    );
    useLandingBusy(
        creating
            ? step === "gallery" &&
                  (!templates ||
                      templates.loading ||
                      !!templates.opening ||
                      yourSpaces.loading ||
                      !!yourSpaces.openingId)
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
            // "Show all" and a filter of your spaces last for one visit to
            // Create.
            delete query.spaces;
            delete query.spacesFilter;
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
        if (card.id === SHOW_ALL_SPACES_ID) {
            const query = { ...router.query, create: "gallery", spaces: "all" };
            void router.push({ pathname: router.pathname, query }, undefined, {
                shallow: true,
                scroll: false,
            });
            return true;
        }
        if (card.id === RESET_SPACES_ID) {
            // "Show all your spaces" clears the search too, or a search
            // that matches none of them would keep the list empty.
            const query: typeof router.query = {
                ...router.query,
                create: "gallery",
            };
            delete query.spacesFilter;
            delete query.spaces;
            delete query.templateSearch;
            void router.push({ pathname: router.pathname, query }, undefined, {
                shallow: true,
                scroll: false,
            });
            return true;
        }
        if (card.spaceId) {
            if (templates?.opening) return true;
            void yourSpaces.open(card.spaceId);
            return true;
        }
        if (card.id.startsWith("template-")) {
            if (yourSpaces.openingId) return true;
            templates?.open(card);
            return true;
        }
        return false;
    };
    const templateEmpty =
        step === "gallery" &&
        templates &&
        !templates.loading &&
        !yourSpaces.loading &&
        !templates.cards.length &&
        !spaceCards.length;
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
    // Both lists arrive before either is drawn, so the grid is drawn once
    // and nothing shifts when the slower one lands.
    const galleryReady =
        !!templates &&
        (!templates.loading || templates.cards.length > 0) &&
        !yourSpaces.loading;
    const templateCards = templates?.cards;
    const galleryCards = useMemo(
        () => (galleryReady ? withSpaces(spaceCards, templateCards || []) : []),
        [galleryReady, spaceCards, templateCards]
    );
    // In the staff feed the popular worlds follow the picks under their own
    // label, so the picks are named too and the two labels form a switch.
    const worldCards = useMemo(
        () =>
            cards.some((card) => card.section === "popular") &&
            cards.some((card) => !card.section)
                ? cards.map((card) =>
                      card.section
                          ? card
                          : { ...card, section: "staff" as const }
                  )
                : cards,
        [cards]
    );
    const gridCards = step === "gallery" ? galleryCards : worldCards;
    // Create waits the way the worlds do: the same placeholder grid.
    const galleryLoading = step === "gallery" && !galleryReady;
    const showGrid =
        !templateEmpty && !galleryLoading && (creating || cards.length > 0);
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
            title={t(
                creating ? "Back to exploring worlds" : "Create a gallery"
            )}
        >
            <span>
                {t("create")}
                <CreateIcon open={creating} />
            </span>
        </CreateControl>
    );
    // The way from the landing to the rest of the site: a plain link, in
    // the corner the grid size switch used to take.
    const aboutLink = <AboutLink href="/about">{t("about")}</AboutLink>;
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
                    <span className="jump-in-label">{t("Jump In")}</span>
                    {lobbyPopulation != null && (
                        <span
                            className="lobby-count"
                            aria-label={t(
                                lobbyPopulation === 1
                                    ? "{count} person in the lobby"
                                    : "{count} people in the lobby",
                                { count: lobbyPopulation }
                            )}
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
                {t(
                    inLobby
                        ? "Skip to lobby controls"
                        : creating
                        ? "Skip to gallery destinations"
                        : "Skip to worlds"
                )}
            </a>
            {/* The page's heading, for screen readers and search engines:
                the visible page is a logo over a canvas of cards. */}
            <h1 className="landing-title">
                {props.notFound?.query
                    ? `Could not find \u201c${props.notFound.query}\u201d`
                    : "oncyber: explore 3D spaces, galleries and worlds"}
            </h1>
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
                              spaces:
                                  showSpaces && yourSpaces.spaces?.length
                                      ? {
                                            filter: spaceFilter,
                                            update: filterSpaces,
                                        }
                                      : undefined,
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
                aria-label={t(
                    creating ? "Create with Oncyber" : "Explore Oncyber worlds"
                )}
            >
                <BrowseSurface>
                    {/* Opening shows on the picked card itself. */}
                    {step === "gallery" &&
                        (yourSpaces.error || templates?.error) && (
                            <TemplateStatus role="alert">
                                {t(yourSpaces.error || templates.error)}
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
                                        ? // What the visitor chose, not what
                                          // arrived: a refreshed catalog
                                          // updates cards in place instead of
                                          // fading the whole grid out and in.
                                          galleryReady
                                            ? `gallery:${templateCategory}:${templateQuery}:${spacesExpanded}:${spaceFilter}`
                                            : "gallery:loading"
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
                                footerStart={aboutLink}
                                viewControls={viewControls}
                                resetKey={discovery.resultKey}
                                hasMore={!creating && !loading && pagedHasMore}
                                loadingMore={!creating && loadingMore}
                                error={!creating && (error || loadMoreError)}
                                loadMore={loadMore}
                                sectionLabels={notFoundLabels}
                                // The landing opens on the worlds alone;
                                // its section names come in with the scroll.
                                sectionLabelsOnScroll={
                                    step !== "gallery" && !notFoundMode
                                }
                                sectionCounts={
                                    spaceCount ? { spaces: spaceCount } : null
                                }
                                sectionFilter={
                                    step === "gallery" &&
                                    yourSpaces.spaces?.length
                                        ? {
                                              section: "spaces",
                                              label: "Filter your worlds",
                                              value: spaceFilter,
                                              options: SPACE_FILTERS,
                                              onChange: filterSpaces,
                                          }
                                        : null
                                }
                            />
                        )}
                        {galleryLoading ||
                        (!creating &&
                            !cards.length &&
                            (loading ||
                                resultsPending ||
                                (pagedHasMore && !error && !loadMoreError))) ? (
                            <LoadingGrid grid={grid} />
                        ) : templateEmpty ? (
                            <EmptyState
                                size="page"
                                titleAs="h2"
                                icon="globe"
                                title={t(
                                    templateQuery
                                        ? "No matching rooms."
                                        : "No galleries found."
                                )}
                                detail={t(
                                    templateCategory !== "all"
                                        ? "Try another template category."
                                        : templateQuery
                                        ? "Try another name, artist, or style."
                                        : "The catalog updates automatically. Please try again in a moment."
                                )}
                                action={
                                    templateCategory !== "all"
                                        ? {
                                              label: t("Show all templates"),
                                              onClick: () =>
                                                  updateTemplates({
                                                      templateCategory: "all",
                                                  }),
                                          }
                                        : templateQuery
                                        ? {
                                              label: t("Clear template search"),
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
                                title={t(
                                    error
                                        ? "Couldn’t load worlds."
                                        : "No worlds found."
                                )}
                                detail={t(
                                    error
                                        ? "Please try again."
                                        : "Try another search or remove a filter."
                                )}
                                action={
                                    error
                                        ? {
                                              label: t("Try again"),
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
                                              label: t("Explore all"),
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
                                {!error &&
                                    searchWordSuggestions(filters.q).map(
                                        (word) => (
                                            // Every word has to match: one
                                            // word at a time finds more.
                                            <ActionButton
                                                key={word}
                                                onClick={() =>
                                                    searchWorlds({ q: word })
                                                }
                                            >
                                                Search {"\u201c"}
                                                {word}
                                                {"\u201d"}
                                            </ActionButton>
                                        )
                                    )}
                                {!error && hasMore && (
                                    // A failed "load more" with nothing
                                    // shown yet: loading the next page is
                                    // the second way forward.
                                    <ActionButton
                                        onClick={loadMore}
                                        disabled={loadingMore}
                                    >
                                        {t(
                                            loadingMore
                                                ? "Loading…"
                                                : "Load more"
                                        )}
                                    </ActionButton>
                                )}
                            </EmptyState>
                        ) : null}
                    </div>
                    {(templateEmpty ||
                        galleryLoading ||
                        (!creating && !cards.length)) && (
                        <EmptyFooter className="landing-footer">
                            {aboutLink}
                            {viewControls}
                        </EmptyFooter>
                    )}
                    <noscript>
                        <FallbackLinks>
                            {[
                                ...props.initialFeed.cards,
                                ...(props.notFound?.sections ?? []),
                            ].map((card) => (
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
                    withSpaces={templateContext && yourSpaces.signedIn}
                    value={templateContext ? templateQuery : filters.q}
                    onChange={
                        templateContext ? undefined : (q) => searchWorlds({ q })
                    }
                    liveMs={templateContext ? 150 : undefined}
                    onSearch={(q, typed) =>
                        templateContext
                            ? updateTemplates(
                                  {
                                      ...templateSearchPatch(q),
                                      create: "gallery",
                                  },
                                  typed
                              )
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

const AboutLink = styled(Link)`
    /* Twice, to outrank the page's own rule for links. */
    && {
        display: inline-flex;
        align-items: center;
        justify-self: start;
        min-height: 44px;
        padding: 10px 0;
        color: var(--oc-secondary);
        font-size: 14px;
        white-space: nowrap;
        transition: color var(--oc-fast);
    }
    &&:hover {
        color: var(--oc-ink);
    }
    @media (max-width: 700px) {
        && {
            font-size: 12px;
        }
    }
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
