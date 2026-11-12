import algoliasearch, { SearchClient, SearchIndex } from "algoliasearch";

import { trendingFacets } from "@algolia/recommend-js";

import recommend, { RecommendClient } from "@algolia/recommend";

import { UAParser } from "@3utils/uaparser.js";

import aa from "search-insights";

import { CATEGORY } from "@components/context/FilterContext";
import { IS_FRONTEND_ENV } from "@utils/isFrontend";

const APP_ID = "6BQRQVD9VW";

const API_KEY = "4b7a4972be08b695fa66e7244b8ac7ff";

const EXHIBITS_INDEX = "spaces";

const LAST_MODIFIED_EXHIBITS_INDEX = "spaces_last_modified";

export type ClickAfterSearchEventNamesTypes = "clickedSpace";

export type FacetType = "owner" | "room" | "collections" | "chains";

export type InsightTypes = "clickedObjectIDsAfterSearch" | "convertedObjectIDs";

export interface AlgoliaSpace {
    room: string;
    description: string;
    headline: string;
    owner: string;
    heroImg: string;
    fHeroImg: string;
    cHeroImg: string;
    chains: string[];
    collections: string[];
    number_of_visits: number;
    objectID: string;
    path: string;
    artworks: number;
    customLink: string;
    tags?: [
        {
            title: string;
            key: string;
        }
    ];
    priority: number;
    clients: number;
}

type Facets = {
    owner: any[];
    collections: any[];
    chains: any[];
    room: any[];
};

export interface SearchReturn {
    hits: AlgoliaSpace[];
    total: number;
    pages: number;
    page: number;
    queryID: string;
    facets: Facets;
}

let AAInited = false;

export default class AlgoliaProvider {
    client: SearchClient;
    exhibitsIndex: SearchIndex;
    lastModifiedExhibitsIndex: SearchIndex;
    userId: string;
    recommendClient: RecommendClient;

    static instances = new Map<string, AlgoliaProvider>();

    static async getInstance(userId: string) {
        //
        let instance = this.instances.get(userId);

        if (instance == null) {
            //
            instance = new AlgoliaProvider();

            instance.init(userId);

            this.instances.set(userId, instance);
        }

        return instance;
    }

    init(userId, initAnalytics = true) {
        if (!this.client) {
            this.client = algoliasearch(APP_ID, API_KEY);

            this.exhibitsIndex = this.client.initIndex(EXHIBITS_INDEX);

            this.lastModifiedExhibitsIndex = this.client.initIndex(
                LAST_MODIFIED_EXHIBITS_INDEX
            );

            this.recommendClient = recommend(APP_ID, API_KEY);

            this.userId = userId;

            if (initAnalytics) {
                if (!AAInited) {
                    aa("init", {
                        appId: APP_ID,
                        apiKey: API_KEY,
                        useCookie: true,
                    });
                    AAInited = true;
                }

                if (userId) {
                    aa("setUserToken", this.userId);
                }
            }
        }
    }

    getTrendingFacets() {
        return this.recommendClient
            .getTrendingFacets([
                {
                    indexName: EXHIBITS_INDEX,
                    facetName: "collections",
                    maxRecommendations: 5,
                },
                {
                    indexName: EXHIBITS_INDEX,
                    facetName: "owner",
                    maxRecommendations: 5,
                },
                {
                    indexName: EXHIBITS_INDEX,
                    facetName: "contracts",
                    maxRecommendations: 10,
                },
            ])
            .then(({ results }) => {
                const facets = {
                    collections: [],
                    owner: [],
                    contracts: [],
                };

                results.forEach((result) => {
                    result.hits.forEach((hit: any) => {
                        facets[hit.facetName].push(hit.facetValue);
                    });
                });

                return facets;
            });
    }

    getTrendingItems() {
        return this.recommendClient
            .getTrendingItems([
                {
                    indexName: EXHIBITS_INDEX,
                    maxRecommendations: 20,
                },
            ])
            .then(({ results }) => {
                return results[0].hits
                    .map((hit) => {
                        return this.formatSpaceHit(hit);
                    })
                    .filter(
                        (hit) =>
                            hit.headline &&
                            (hit.cHeroImg || hit.heroImg || hit.fHeroImg)
                    );
            });
    }

    getCollections() {
        return this.exhibitsIndex
            .searchForFacetValues("collections", "", {
                maxFacetHits: 100,
            })
            .then((res) => {
                return res.facetHits;
            });
    }

    getRecommendations(objectID: string) {
        return this.recommendClient
            .getRecommendations([
                {
                    indexName: EXHIBITS_INDEX,
                    maxRecommendations: 20,
                    threshold: 0,
                    model: "related-products",
                    objectID,
                },
            ])
            .then(({ results }) => {
                return results[0].hits
                    .map((hit) => {
                        return this.formatSpaceHit(hit);
                    })
                    .filter(
                        (hit) =>
                            hit.headline &&
                            hit.owner !== this.userId &&
                            (hit.cHeroImg || hit.heroImg || hit.fHeroImg)
                    );
            });
    }

    static insight_registerClickedFilters({ filters, userId }) {
        if (!AAInited) {
            aa("init", {
                appId: APP_ID,
                apiKey: API_KEY,
                useCookie: true,
            });

            AAInited = true;
        }

        if (userId) {
            aa("setUserToken", userId);
        }

        let payload: any = {
            index: EXHIBITS_INDEX,
            eventName: "clickedFilters",
            filters,
        };

        if (userId) {
            payload.userToken = userId;
        }

        aa("clickedFilters", payload);
    }

    static insight_registerInsight({
        insightType,
        eventName,
        queryId,
        objectId,
        position,
        userId,
    }: {
        insightType: InsightTypes;
        eventName;
        queryId?: string;
        objectId: string;
        position?: number; // start at 1 (not zero) And should be absolute
        userId?: string;
    }) {
        if (!AAInited) {
            aa("init", {
                appId: APP_ID,
                apiKey: API_KEY,
                useCookie: true,
            });

            AAInited = true;
        }

        if (userId) {
            aa("setUserToken", userId);
        }

        let paylaod: any = {
            index: EXHIBITS_INDEX,
            eventName: eventName,
            objectIDs: [objectId],
        };

        if (queryId) {
            paylaod.queryID = queryId;
        }

        if (position) {
            paylaod.positions = [position];
        }

        if (userId) {
            paylaod.userToken = userId;
        }

        aa(insightType, paylaod);
    }

    formatSpaceHit(hit) {
        return {
            room: hit.room || "",
            description: hit.description || "",
            headline: hit.headline || "",
            owner: hit.owner || "",
            heroImg: hit.heroImg || "",
            cHeroImg: hit.cHeroImg || "",
            fHeroImg: hit.fHeroImg || "",
            chains: hit.chains || [],
            collections: hit.collections || [],
            number_of_visits: hit.number_of_visits || 0,
            objectID: hit.objectID || "",
            path: hit.path || "",
            artworks: hit.artworks || 0,
            customLink: hit.customLink || "",
            tags: hit.tags || [],
            priority: -1,
            clients: 0,
        };
    }

    getUsersFromHits(hits) {
        const users = hits.reduce((prevVal, space: AlgoliaSpace, index) => {
            if (prevVal.indexOf(space.owner) === -1) {
                return prevVal.concat(space.owner);
            }

            return prevVal;
        }, []);

        return users;
    }

    search({
        search,
        filters,
        init = false,
        page = 0,
        category,
        hits = null,
    }: {
        search: string;
        filters: string[][];
        init?: boolean;
        page?: number;
        category?: CATEGORY;
        hits?: number;
    }): Promise<SearchReturn> {
        const ruleContexts = [];

        if (IS_FRONTEND_ENV) {
            const ua = new UAParser();

            const deviceType = ua.getDevice().type;

            const isMobile = deviceType == "tablet" || deviceType == "mobile";

            if (isMobile) {
                ruleContexts.push("mobile");
            }
        }

        const query: any = {
            clickAnalytics: true,
            facetFilters: filters,
            tagFilters: ["public"],
            hitsPerPage: hits ? hits : init ? 20 : 20,
            page,
            ruleContexts,
        };

        if (init) {
            query.facets = ["collections", "chains", "owner", "room"];
        }

        const filterContent = {
            owner: [],
            collections: [],
            chains: [],
            room: [],
        };

        const index =
            category === "lastModified"
                ? this.lastModifiedExhibitsIndex
                : this.exhibitsIndex;

        return index
            .search(search, query)
            .then(({ nbHits, nbPages, page, hits, queryID, ...rest }) => {
                const facets = (rest.facets || {}) as any as Facets;

                const payload: SearchReturn = {
                    hits: hits.map((hit: AlgoliaSpace) => {
                        return this.formatSpaceHit(hit);
                    }),
                    total: nbHits,
                    pages: nbPages,
                    page,
                    queryID,
                    facets: facets,
                };

                if (init) {
                    Object.keys(facets).map((facetId) => {
                        Object.keys(facets[facetId]).forEach((facetName) => {
                            filterContent[facetId].push({
                                id: facetName,
                                total: facets[facetId][facetName],
                            });
                        });
                    });

                    payload.facets = filterContent;
                }

                return payload;
            });
    }
}
