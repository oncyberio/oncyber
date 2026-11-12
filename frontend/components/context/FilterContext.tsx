import { useDebouncedCallback } from "@components/hooks/useDebouncedCallback";
import useModal from "@components/modals/useModal";
import { FacetType } from "@utils/algolia/AlgoliaProvider";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { CATEGORIES } from "@utils/feed/category";
import { createContext, useContext, useEffect, useState } from "react";
import useFeed, { FeedHook } from "@components/hooks/useFeed";
import { useRouter } from "next/router";

type FilterType = "owner" | "collections" | "chains" | "room";

interface HomeContextState {
    filters: {
        owner: { [key: string]: boolean };
        collections: { [key: string]: boolean };
        chains: { [key: string]: boolean };
        room: { [key: string]: boolean };
    };
    resetFilter: any;
    applyFilter: any;
    handleSearch: any;
    search: string;
    feed: FeedHook;
    changePage: () => void;
    searchLoading: boolean;
    category: CATEGORY;
    handleChangeCategory: (category: CATEGORY, reset?: boolean) => void;
    isScrollLoading: boolean;
    searchFilters: any[];
}

export type CATEGORY = "" | keyof typeof CATEGORIES;

export const FILTERS = [
    { key: "owner", title: "artists" },
    { key: "collections", title: "collections" },
    { key: "chains", title: "chains" },
    { key: "room", title: "space type" },
];

export const FilterContext = createContext<HomeContextState>(null);

export function getCategoryFilters(key: CATEGORY) {
    // @ts-ignore
    const { rooms } = CATEGORIES[key];

    const filters = [[], [], [], []];

    rooms.forEach((room, index) => {
        // applyFilter("room", room, true);
        filters[3].push(`room:${room}`);
    });

    return filters;
}

interface FilterProvider {
    children: React.ReactNode;
    feed?: FeedHook;
}

export function parseURLParams(params) {
    let search, category;

    const facetFilters = [[], [], [], []];

    const filters = {
        owner: {},
        collections: {},
        chains: {},
        room: {},
    };

    // init query params
    if (params.q) {
        search = params.q as string;
    }

    if (params.category) {
        category = params.category as CATEGORY;
    }

    if (params.filters) {
        (params.filters as string).split(",").forEach((filter) => {
            const [facetId, filterId] = filter.split(":");

            let id = null;

            if (facetId === "collections") {
                id = 0;
            } else if (facetId === "chains") {
                id = 1;
            } else if (facetId === "owner") {
                id = 2;
            } else if (facetId === "room") {
                id = 3;
            }

            if (id === null) return;

            facetFilters[id].push(`${facetId}:${filterId}`);

            filters[facetId] = {
                ...filters[facetId],
                [filterId]: true,
            };
        });
    }

    return {
        search,
        category,
        filters,
        facetFilters,
    };
}

export function formatFacetFilters(filters) {
    const facetFilters = [[], [], [], []];

    Object.keys(filters).forEach((facetId: FacetType) => {
        Object.keys(filters[facetId]).forEach((filterType, index) => {
            let id = 0;
            if (facetId === "collections") {
                id = 0;
            } else if (facetId === "chains") {
                id = 1;
            } else if (facetId === "owner") {
                id = 2;
            } else if (facetId === "room") {
                id = 3;
            }
            facetFilters[id].push(`${facetId}:${filterType}`);
        });
    });

    return facetFilters;
}

export default function FilterProvider({ children, feed, defaultFilters }) {
    const [category, setCategory] = useState<CATEGORY>("");

    const [search, setSearch] = useState("");

    const [searchLoading, setSearchLoading] = useState(false);

    const _filters = {
        owner: {},
        collections: {},
        chains: {},
        room: {},
        ...defaultFilters,
    };

    const [filters, setFilters] = useState<{
        owner: { [key: string]: boolean };
        collections: { [key: string]: boolean };
        chains: { [key: string]: boolean };
        room: { [key: string]: boolean };
    }>(_filters);

    const router = useRouter();

    const [searchFilters, setSearchFilters] = useState(
        formatFacetFilters(_filters)
    );

    const [isScrollLoading, setIsScrollLoading] = useState(false);

    useEffect(() => {
        const { search, category, filters, facetFilters } = parseURLParams(
            router.query
        );

        if (!defaultFilters) {
            if (search) {
                setSearch(search);
            }

            if (category) {
                setCategory(category);
            }

            if (filters) {
                setFilters(filters);
            }

            if (facetFilters) {
                setSearchFilters(facetFilters);
            }
        }
    }, []);

    function handleSearch(value) {
        setCategory("");

        setSearch(value);

        setSearchLoading(true);

        handleFeedSearch(value, searchFilters);
    }

    function resetFilter(query = true) {
        setSearchFilters([]);
        setFilters({
            room: {},
            collections: {},
            chains: {},
            owner: {},
        });
        setSearchLoading(true);

        if (query) {
            setCategory("");

            handleFeedSearch(search, []);
        }
    }

    function handleChangeCategory(category: CATEGORY, reset = true) {
        // setCategory((state) => {
        //     let newState = state === category ? "" : category;

        //     window.scrollTo({ top: 0, behavior: "smooth" });

        //     setSearchLoading(true);

        //     if (CATEGORIES[category].filter) {
        //         if (reset) {
        //             resetFilter(false);
        //         }

        //         handleFeedSearch("", reset ? [] : searchFilters, 0, newState);

        //         return newState;
        //     }

        //     let filters = [[], [], [], []];

        //     if (newState) {
        //         filters = getCategoryFilters(newState);
        //     }

        //     handleFeedSearch("", filters);

        //     return newState;
        // });

        feed.setFilter(category);
    }

    function applyFilter(facetId: FilterType, filterId, fromCategory = false) {
        if (!fromCategory) {
            setCategory("");
        }

        setFilters((state) => {
            const payload = {
                ...state,
            };

            if (state[facetId][filterId]) {
                const { [filterId]: _, ...rest } = payload[facetId];
                payload[facetId] = rest;
            } else {
                // insight_clickedFilters.current.push(`${facetId}:${filterId}`);

                // handleRegisterClickedFilters();

                payload[facetId][filterId] = true;
            }

            const facetFilters = formatFacetFilters(payload);

            setSearchLoading(true);

            handleFeedSearch(search, facetFilters);

            setSearchFilters(facetFilters);

            return payload;
        });
    }

    function changePage() {
        if (!feed) return;

        if (
            !isScrollLoading &&
            feed.spaceHits.pages > 0 &&
            feed.spaceHits.page < feed.spaceHits.pages
        ) {
            setIsScrollLoading(true);

            console.log("LOADING MORE...", searchFilters);
            let filters = searchFilters;

            if (category === "oncyberlabs") {
                filters = getCategoryFilters("oncyberlabs");
            }
            if (category === "rtfkt") {
                filters = getCategoryFilters("rtfkt");
            }

            amplitude_logAnalyticsEvent("triggered_infinite_scroll", {
                filters: filters.flatMap((t) => t),
                search,
                category,
                page: feed.spaceHits.page,
                pages: feed.spaceHits.pages,
            });

            handleFeedSearch(
                search,
                filters,
                feed.spaceHits.page + 1,
                category
            );
        } else {
            console.log("NO PAGINATION HERE...");
        }
    }

    const handleFeedSearch = useDebouncedCallback(
        (search, filters, page = 0, category: CATEGORY = "") => {
            if (!feed) return;

            feed.searchExhibits({
                search,
                filters,
                page,
                category,
            }).finally(() => {
                setSearchLoading(false);
                setIsScrollLoading(false);
            });
        },
        500
    );

    const value = {
        resetFilter,
        applyFilter,
        filters,
        search,
        handleSearch,
        feed,
        changePage,
        searchLoading,
        category,
        handleChangeCategory,
        isScrollLoading,
        searchFilters,
    };

    return (
        <FilterContext.Provider value={value}>
            {children}
        </FilterContext.Provider>
    );
}

export function useFilter() {
    const context = useContext(FilterContext);

    if (!context) {
        throw Error("useFilter needs to be called within FilterContext.");
    }

    return context;
}
