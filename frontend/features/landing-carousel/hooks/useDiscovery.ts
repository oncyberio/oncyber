import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
    DEFAULT_FILTERS,
    fetchLandingFeed,
    fetchSpaceSearch,
    filterBrowseCards,
    parseFilters,
} from "../data";
import { DiscoveryFilters, LandingCard, LandingPageProps } from "../types";

function mergeCards(previous: LandingCard[], incoming: LandingCard[]) {
    const cards = new Map(previous.map((card) => [card.id, card]));
    incoming.forEach((card) => {
        const existing = cards.get(card.id);
        // Search hits can omit cover metadata that the browse feed already supplied.
        cards.set(
            card.id,
            !card.imageUrls.length && existing?.imageUrls.length
                ? { ...card, imageUrls: existing.imageUrls }
                : card
        );
    });
    return [...cards.values()];
}

export interface DiscoveryOptions {
    /** Set false for embedded panels whose filters must not read or change the page URL. */
    syncUrl?: boolean;
    /** Treat the initial feed as a visual seed and load a fresh first page on mount. */
    fetchOnMount?: boolean;
}

export default function useDiscovery(
    { initialFeed, initialFilters, initialError }: LandingPageProps,
    { syncUrl = true, fetchOnMount = false }: DiscoveryOptions = {}
) {
    const router = useRouter();
    const [filters, setFilters] = useState(initialFilters);
    const [cards, setCards] = useState(initialFeed.cards);
    const [cardsKey, setCardsKey] = useState("");
    const [knownCards, setKnownCards] = useState(
        () => new Map([[initialFilters.category, initialFeed.cards]])
    );
    const filtersRef = useRef(filters);
    const pendingFilters = useRef<string | null>(null);
    const [loading, setLoading] = useState(
        !!(
            fetchOnMount ||
            initialError ||
            initialFilters.q ||
            initialFilters.owner ||
            initialFilters.chain ||
            initialFilters.collection
        )
    );
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadMoreError, setLoadMoreError] = useState(false);
    const [error, setError] = useState(initialError);
    const [hasMore, setHasMore] = useState(initialFeed.hasMore);
    const [searchTotal, setSearchTotal] = useState<number | null>(null);
    const [limitedSearch, setLimitedSearch] = useState(false);
    const feedCache = useRef(new Map([[initialFilters.category, initialFeed]]));
    // Seed cards remain visible while loading, but are not an authoritative first
    // page until the initial request succeeds (including a retry after failure).
    const initialFeedPending = useRef(fetchOnMount);
    const [revision, setRevision] = useState(0);
    const cursor = useRef(initialFeed.cursor);
    const seenCursors = useRef(new Set([initialFeed.cursor].filter(Boolean)));
    const page = useRef(0);
    const generation = useRef(0);
    const firstRequest = useRef(true);
    const moreController = useRef<AbortController>(null);
    const morePending = useRef(false);

    const isSearch = !!(
        filters.q.trim() ||
        filters.chain ||
        filters.owner.trim() ||
        filters.collection.trim()
    );
    const requestKey = JSON.stringify([
        filters.q.trim(),
        filters.category,
        filters.chain,
        filters.owner.trim(),
        filters.collection.trim(),
    ]);

    const readyKey = useRef<string | null>(
        isSearch || initialError || fetchOnMount ? null : requestKey
    );

    async function request(nextPage: number, signal: AbortSignal) {
        if (isSearch)
            return fetchSpaceSearch(
                filters,
                nextPage ? cursor.current : "",
                signal
            );
        // Ordinary browsing retains its existing cached feed and cursor.
        const cached =
            !nextPage &&
            !(
                initialFeedPending.current &&
                filters.category === initialFilters.category
            ) &&
            feedCache.current.get(filters.category);
        const feed =
            cached && cached.cards.length
                ? cached
                : await fetchLandingFeed(
                      filters.category,
                      nextPage ? cursor.current : "",
                      signal
                  );
        if (signal.aborted) throw new Error("Aborted");
        if (!nextPage) {
            feedCache.current.set(filters.category, feed);
            if (filters.category === initialFilters.category)
                initialFeedPending.current = false;
        } else {
            const previous =
                feedCache.current.get(filters.category)?.cards || [];
            const ids = new Set(previous.map((card) => card.id));
            feedCache.current.set(filters.category, {
                ...feed,
                cards: [
                    ...previous,
                    ...feed.cards.filter((card) => !ids.has(card.id)),
                ],
            });
        }
        return {
            ...feed,
            total: null,
            limited: isSearch,
        };
    }

    function rememberCards(incoming: LandingCard[]) {
        setKnownCards((previous) =>
            new Map(previous).set(
                filters.category,
                mergeCards(previous.get(filters.category) || [], incoming)
            )
        );
    }

    useEffect(() => {
        if (firstRequest.current) {
            firstRequest.current = false;
            if (!isSearch && !initialError && !fetchOnMount) return;
        }
        readyKey.current = null;
        const current = ++generation.current;
        const controller = new AbortController();
        moreController.current?.abort();
        morePending.current = false;
        setLoadingMore(false);
        setLoadMoreError(false);
        setLoading(true);
        setError(false);
        setHasMore(false);
        // Debounce typing and cancel stale feed/search responses.
        const timer = window.setTimeout(
            async () => {
                try {
                    const result = await request(0, controller.signal);
                    if (
                        controller.signal.aborted ||
                        generation.current !== current
                    )
                        return;
                    readyKey.current = requestKey;
                    setCards(result.cards);
                    setCardsKey(requestKey);
                    rememberCards(result.cards);
                    cursor.current = result.cursor;
                    seenCursors.current = new Set(
                        [result.cursor].filter(Boolean)
                    );
                    page.current = 0;
                    setHasMore(result.hasMore);
                    setSearchTotal(result.total);
                    setLimitedSearch(result.limited);
                } catch {
                    if (
                        controller.signal.aborted ||
                        generation.current !== current
                    )
                        return;
                    setLimitedSearch(isSearch);
                    setError(true);
                } finally {
                    if (
                        !controller.signal.aborted &&
                        generation.current === current
                    )
                        setLoading(false);
                }
            },
            isSearch ? 300 : 0
        );
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
        // request is deliberately captured with this requestKey's filters.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestKey, revision]);

    useEffect(
        () => () => {
            moreController.current?.abort();
        },
        []
    );

    // Browser Back/Forward restores the controls as well as the URL.
    useEffect(() => {
        if (!syncUrl) {
            pendingFilters.current = null;
            return;
        }
        if (!router.isReady) return;
        const next = parseFilters(router.query);
        // Ignore an older shallow navigation while a newer keystroke is pending.
        if (
            pendingFilters.current &&
            pendingFilters.current !== JSON.stringify(next)
        )
            return;
        pendingFilters.current = null;
        filtersRef.current = next;
        setFilters(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.asPath, router.isReady, syncUrl]);

    const update = useCallback(
        (patch: Partial<DiscoveryFilters>) => {
            const next = parseFilters({ ...filtersRef.current, ...patch });
            // Staff picks have no indexed facet; text/facet searches span all public experiences.
            if (
                next.category === "staff" &&
                (next.q || next.owner || next.chain || next.collection)
            ) {
                next.category = "most-visited";
                setKnownCards((previous) =>
                    new Map(previous).set(
                        next.category,
                        mergeCards(
                            previous.get(next.category) || [],
                            previous.get("staff") || []
                        )
                    )
                );
            }
            filtersRef.current = next;
            pendingFilters.current = syncUrl ? JSON.stringify(next) : null;
            setFilters(next);
            if (!syncUrl) return;
            const query = Object.fromEntries(
                Object.entries(next).filter(
                    ([key, value]) => value !== DEFAULT_FILTERS[key]
                )
            );
            if (router.pathname.startsWith("/studio/new-"))
                query.create = "explore";
            void router
                .replace({ pathname: router.pathname, query }, undefined, {
                    shallow: true,
                    scroll: false,
                })
                .then(() => {
                    // Re-submitting the same query does not change asPath, so
                    // release its navigation guard here as well as in the effect.
                    if (
                        pendingFilters.current === JSON.stringify(next) &&
                        JSON.stringify(parseFilters(router.query)) ===
                            pendingFilters.current
                    )
                        pendingFilters.current = null;
                })
                .catch(() => {
                    if (pendingFilters.current === JSON.stringify(next))
                        pendingFilters.current = null;
                });
        },
        [router, syncUrl]
    );

    async function loadMore() {
        if (
            loading ||
            readyKey.current !== requestKey ||
            morePending.current ||
            !hasMore
        )
            return;
        morePending.current = true;
        setLoadingMore(true);
        setLoadMoreError(false);
        setError(false);
        const current = generation.current;
        const controller = new AbortController();
        moreController.current = controller;
        try {
            const result = await request(page.current + 1, controller.signal);
            if (controller.signal.aborted || generation.current !== current)
                return;
            // A stalled/repeated server page must never trigger an endless fetch loop.
            if (
                result.hasMore &&
                (!result.cursor || seenCursors.current.has(result.cursor))
            )
                throw new Error("The discovery cursor did not advance.");
            setCards((previous) => mergeCards(previous, result.cards));
            setCardsKey(requestKey);
            rememberCards(result.cards);
            cursor.current = result.cursor;
            if (result.cursor) seenCursors.current.add(result.cursor);
            page.current += 1;
            setHasMore(result.hasMore);
            setSearchTotal(result.total);
            setLimitedSearch(result.limited);
        } catch {
            if (!controller.signal.aborted && generation.current === current) {
                setError(true);
                setLoadMoreError(true);
            }
        } finally {
            if (!controller.signal.aborted && generation.current === current) {
                setLoadingMore(false);
                morePending.current = false;
            }
        }
    }

    const visibleCards = useMemo(() => {
        // Keep the unfiltered corpus so narrowing, backspacing, and clearing
        // respond immediately, including worlds loaded on earlier feed pages.
        const local = filterBrowseCards(
            isSearch
                ? knownCards.get(filters.category) || []
                : feedCache.current.get(filters.category)?.cards || [],
            filters
        );
        // Server search can match metadata absent from a browse card. Accept those
        // extra hits only for the current query, after the local matches.
        const matches =
            isSearch && cardsKey === requestKey && !limitedSearch
                ? mergeCards(local, cards)
                : local;
        return matches;
    }, [
        cards,
        cardsKey,
        knownCards,
        filters,
        isSearch,
        requestKey,
        limitedSearch,
    ]);

    return {
        filters,
        update,
        cards: visibleCards,
        loading,
        loadingMore,
        loadMoreError,
        error: error && (!isSearch || !visibleCards.length),
        hasMore: readyKey.current === requestKey && !loading && hasMore,
        searchTotal,
        limitedSearch,
        loadMore,
        retry: () => setRevision((value) => value + 1),
        reset: () => update(DEFAULT_FILTERS),
        resultKey: requestKey,
    };
}
