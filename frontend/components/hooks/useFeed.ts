import { UserContext } from "@components/context/UserContext";

import { User } from "@uitypes/user";

import { getEditorsProfile } from "@utils/saveToDb";

import {
    MutableRefObject,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";

import AlgoliaProvider, {
    AlgoliaSpace,
    SearchReturn,
} from "@utils/algolia/AlgoliaProvider";

import { CATEGORY, parseURLParams } from "@components/context/FilterContext";

import { CATEGORIES } from "@utils/feed/category";

import { amplitude_logAnalyticsEvent } from "@utils/analytics";

import { FeedProvider } from "@utils/feed/FeedProvider";

import { useRouter } from "next/router";

import AccountsAPI from "@api/accounts/_api";

const tagsMap: Record<string, { key: string; title: string }> = {
    "most-visited": { key: "most-visited", title: "Most Popular" },
    latest: { key: "latest", title: "Latest Worlds" },
    oncybercurated: {
        key: "oncybercurated",
        title: "oncyber curated",
    },
    oncyberlabs: { key: "oncyberlabs", title: "oncyber labs" },
};

export interface FeedHook {
    searchExhibits: ({
        search,
        filters,
        page,
        category,
    }: {
        search: any;
        filters: any;
        page?: number;
        category: CATEGORY;
    }) => Promise<any>;
    spaceHits: SearchReturn;
    owners: { [key: string]: User & { numOfSpaces: number } };
    feedProvider: MutableRefObject<FeedProvider>;
    topArtists: string[];
    trendingFacets: {
        owner: any[];
        collections: any[];
    };
    searchType: "recommendations" | "search";
    loading: boolean;
    init: (type: "feed" | "collection") => Promise<void>;
    setFilter: (arg: string) => void;
    filter: string;
}

export default function useFeed(
    {
        type,
        tags,
        initialize,
    }: {
        type?: "feed" | "collection";
        tags?: string[];
        initialize: boolean;
    } = {
        type: "feed",
        tags: [],
        initialize: true,
    }
): FeedHook {
    const { user, userData } = useContext(UserContext);

    const [loading, setLoading] = useState(true);

    const router = useRouter();

    const [searchType, setSearchType] = useState<"recommendations" | "search">(
        "recommendations"
    );

    const [filter, setFilter] = useState("most-visited");

    const [topArtists, setTopArtists] = useState([]);

    const inited = useRef(false);

    const [trendingFacets, settrendingFacets] = useState({
        owner: [],
        collections: [],
        contracts: [],
    });

    const [spaceHits, setSpaceHits] = useState({
        page: 0,
        pages: 0,
        total: 0,
        hits: [],
        facets: {
            owner: [],
            collections: [],
            chains: [],
            room: [],
        },
        queryID: "",
    });

    const feedProvider = useRef<FeedProvider>(null);

    const [owners, setOwners] = useState({});

    useEffect(() => {
        // if (initialize) {
        //     init(type);
        // }
        tempInit(filter);
    }, [filter]);

    async function tempInit(isActive) {
        //
        try {
            setLoading(true);

            const response = await fetch(
                `/api/exhibit?type=FETCH_ALL_EXHIBITS&destination=&isActive=${isActive}`
            );

            const data = await response.json();

            const exhibits = data?.exhibits;

            if (data?.success && exhibits?.length) {
                //
                const hits = exhibits.map((hit) => ({
                    headline: hit?.info?.headline,
                    owner: hit?.owner,
                    heroImg: hit?.info?.heroImg,
                    fHeroImg: hit?.info?.fHeroImg,
                    artworks: hit?.artworks,
                    customLink: hit?.info?.customLink,
                    objectID: hit?.id,
                    number_of_visits: hit?.number_of_visits,
                    room: hit?.info?.room,
                    tags: tagsMap[isActive] ? [tagsMap[isActive]] : [],
                }));

                setSpaceHits((prevState) => ({
                    ...prevState,
                    hits: [...hits],
                }));
            } else {
                setSpaceHits((prevState) => ({
                    ...prevState,
                    hits: [],
                }));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    async function init(type: "feed" | "collection") {
        if (inited.current) return;

        inited.current = true;

        if (!feedProvider.current) {
            setLoading(true);

            // when user logs in we should refresh userId
            feedProvider.current = new FeedProvider({
                userId: user.id,
                initAnalytics: true,
            });

            let feed;

            if (type === "collection") {
                const query = await searchExhibits({
                    page: 0,
                    category: "",
                    filters: [tags, [], [], []],
                    search: "",
                    initCategory: true,
                });

                const topArtists = feedProvider.current.algolia
                    .getUsersFromHits(query.hits)
                    .slice(0, 5);

                setTopArtists(topArtists);

                loadOwnerProfiles(topArtists, true);

                setLoading(false);

                return;
            } else {
                feed = await feedProvider.current.init({
                    isAnon: !user.id,
                });
            }

            setSpaceHits({
                ...feed.spaceHits,
                hits: feed.spaceHits.hits,
            });

            setTopArtists(feed.topArtists);

            settrendingFacets(feed.trendingFacets);

            if (feed.spaceHits.hits.length !== 0) {
                loadOwnerProfiles(
                    feedProvider.current.algolia
                        .getUsersFromHits(feed.spaceHits.hits)
                        .concat(
                            feed.spaceHits.facets.owner.map((facet) => facet.id)
                        )
                        .concat(topArtists)
                ).then(() => {
                    // loadOwnerProfiles(topArtists, true);
                });
            }

            if (
                type === "feed" &&
                (router.query.q ||
                    router.query.category ||
                    router.query.filters)
            ) {
                const { search, category, filters, facetFilters } =
                    parseURLParams(router.query);

                await searchExhibits({
                    search: search,
                    page: 0,
                    category: category,
                    filters: facetFilters,
                });
            }

            setLoading(false);
        }
    }

    function loadOwnerProfiles(users, loadNumOfSpaces = false) {
        // Abort this in case of new request...
        if (users.length === 0) return Promise.resolve(null);

        users = users.filter((user) => {
            return loadNumOfSpaces || !owners[user];
        });

        return AccountsAPI.getUsers({
            type: "users",
            walletIds: users,
            loadNumOfSpaces: loadNumOfSpaces,
        }).then((response) => {
            const { success, editors } = response;

            if (success) {
                setOwners((state) => ({
                    ...state,
                    ...editors,
                }));
            }
        });
    }

    function searchExhibits(props: {
        search: string;
        filters: string[][];
        page: number;
        category: CATEGORY;
        initCategory?: boolean;
    }) {
        const filters = props.filters.flat();

        const params = new URLSearchParams();

        if (props.search) {
            params.append("q", props.search);
        }

        if (props.filters.length) {
            params.append("filters", filters.join(","));
        }

        if (props.category) {
            params.append("category", props.category);
        }

        if (type === "feed" && router.pathname === "/") {
            router.push(`?${params.toString()}`, null, {
                shallow: true,
            });
        }

        if (
            type === "feed" &&
            !CATEGORIES?.[props?.category]?.fetchable &&
            CATEGORIES?.[props?.category]?.filter
        ) {
            setSpaceHits((state) => {
                const newHits = feedProvider.current.hits.filter((hit) => {
                    return hit.tags.find((tag) =>
                        tag.title.includes(CATEGORIES[props.category].title)
                    );
                });

                return {
                    ...state,
                    page: 0,
                    pages: 0,
                    hits: newHits,
                };
            });

            return Promise.resolve(null);
        }

        if (
            !CATEGORIES?.[props?.category]?.fetchable &&
            props.search === "" &&
            filters.length === 0
        ) {
            if (searchType === "recommendations")
                feedProvider.current.getMore(props.page);
            else feedProvider.current.getMore(0);

            if (feedProvider.current?.feed?.spaceHits?.hits) {
                loadOwnerProfiles(
                    feedProvider.current.algolia.getUsersFromHits(
                        feedProvider.current.feed.spaceHits.hits
                    )
                );
            }

            setSpaceHits((state) => ({
                ...state,
                ...feedProvider.current.feed.spaceHits,
            }));

            setSearchType("recommendations");

            return Promise.resolve(null);
        }

        return feedProvider.current.algolia
            .search(props)
            .then(({ hits, page, pages, queryID, total }) => {
                loadOwnerProfiles(
                    feedProvider.current.algolia.getUsersFromHits(hits)
                );

                setSearchType("search");

                setSpaceHits((state) => ({
                    ...state,
                    hits: page > 0 ? state.hits.concat(hits) : hits,
                    page,
                    pages,
                    queryID,
                    total,
                }));

                amplitude_logAnalyticsEvent("submit_search", {
                    category: props.category,
                    search: props.search,
                    filters,
                    total,
                    page,
                    pages,
                });

                return { hits, page, pages, queryID, total };
            });
    }

    return {
        searchExhibits,
        spaceHits,
        owners,
        feedProvider,
        topArtists,
        trendingFacets,
        searchType,
        loading,
        init,
        setFilter,
        filter,
    };
}
