import { LocalRecommendationStack } from "@components/hooks/useSyncRecommend";
import { ARENA_HTTP_URL } from "@utils/arena/constants";
import { CATEGORIES } from "@utils/feed/category";
import AlgoliaProvider, { SearchReturn } from "../algolia/AlgoliaProvider";

const CMS_BASE_URL = "https://cyber-cms-ef9hl.ondigitalocean.app";

async function getCMS() {
    // needs to be called from the backend later
    const resp = await fetch(`${CMS_BASE_URL}/api/playlists?populate=*`, {
        headers: {
            Authorization:
                "bearer 597f725cdf56921388e6e188673a80f3bfcc5f4f94ea1612d1f1a2dce797d48735637190691aa76020d3e43a8b062123aae464b610bc99d232da92bc770bf7b23aae915b4e4013b4e06071734cf4dcc61b6dbbd19428469c57b06a9dd67edb7a34c61bbbc376b15a71c36c994761d79f00979b7eba7ef304cc7f9d8a26c6f29d",
        },
    });

    const data = await resp.json();

    if (data?.data) {
        return data.data;
    }

    return [];
}

async function getRooms() {
    const resp = await fetch(`${ARENA_HTTP_URL}/getRooms`);

    const data = await resp.json();

    if (data?.success) {
        return data.rooms;
    }

    return [];
}

export class FeedProvider {
    public hiddenSpaces = [];

    public algolia: AlgoliaProvider;

    public userData: any;

    private pageSize = 20;

    public currentPage = 0;

    public hits = [];

    public feed: {
        spaceHits: SearchReturn;
        topArtists: string[];
        trendingFacets: {
            owner: any[];
            collections: any[];
            contracts: any[];
        };
    } = {
        spaceHits: {
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
        },
        topArtists: [],
        trendingFacets: {
            owner: [],
            collections: [],
            contracts: [],
        },
    };

    constructor({ userId, initAnalytics = false }) {
        this.algolia = new AlgoliaProvider();

        this.algolia.init(userId, false);
    }

    async init({ isAnon }) {
        console.time("FeedProvider.init");

        let rules = null;

        // 0. LOAD RULES

        try {
            await this.algolia.exhibitsIndex.browseRules({
                batch: (batch) => {
                    rules = batch;
                },
            });

            this.hiddenSpaces =
                rules[0]?.consequence?.hide?.map?.((s) => s.objectID) || [];
        } catch (e) {
            console.error("Failed to fetch rules", e);
        }

        let spaceHits = this.feed.spaceHits;

        let topArtists = this.feed.topArtists;

        let trendingFacets = this.feed.trendingFacets;

        // 1. LOAD SOURCES

        const sources = [];

        try {
            // source 1. most popular
            spaceHits = await this.algolia.search({
                search: "",
                filters: [],
                init: true,
                hits: isAnon ? 40 : 20,
            });

            topArtists = this.algolia
                .getUsersFromHits(spaceHits.hits)
                .slice(0, 5);

            // if (
            //     (!isAnon &&
            //         (LocalRecommendationStack.stack || []).length <= 3) ||
            //     isAnon
            // ) {
            //     sources.push({ category: "popular", source: spaceHits.hits });
            // }
        } catch (e) {
            console.error("Failed to fetch popular spaces", e);
        }

        // try {
        //     // source 2. trending
        //     const trendingHits = isAnon
        //         ? []
        //         : await this.algolia.getTrendingItems();

        //     sources.push({ category: "trending", source: trendingHits });
        // } catch (err) {
        //     console.error("Failed to fetch trending spaces", err);
        // }

        // try {
        //     // source 3. trending
        //     trendingFacets = await this.algolia.getTrendingFacets();
        // } catch (err) {
        //     console.error("Failed to fetch trending facets", err);
        // }

        // source 4. recommendations (5 requests)
        // const recommendations = await Promise.all(
        //     (isAnon ? [] : LocalRecommendationStack.stack || [])
        //         .sort(() => {
        //             return 0.5 - Math.random();
        //         })
        //         .map(async (spaceId) => {
        //             try {
        //                 const source = await this.algolia.getRecommendations(
        //                     spaceId
        //                 );

        //                 return { source, category: "recommendations" };
        //             } catch (err) {
        //                 console.log("err", err);
        //                 return null;
        //             }
        //         })
        // ).catch((err) => {
        //     console.log("err", err);
        // });

        // sources.push(...(recommendations || []).filter((s) => s));

        // try {
        //     // source 5. cms
        //     const cmsHits = (isAnon ? [] : await this.getCMSObjects()).sort(
        //         (a, b) => {
        //             let r = 0.5;

        //             if (a.tags.length > 2 || b.tags.length > 2) {
        //                 r = 0.8;
        //             }
        //             return r - Math.random();
        //         }
        //     );

        //     sources.push({ category: "cms", source: cmsHits });
        // } catch (err) {
        //     console.log("Failed to fetch cms", err);
        // }

        try {
            // source 6. multiplayer
            const multiplayerHits = isAnon
                ? []
                : await this.getMultiplayerObjects();

            sources.push({
                category: "multiplayer",
                source: multiplayerHits,
                priority: 1,
            });
        } catch (err) {
            console.log("Failed to fetch multiplayer", err);
        }

        // 2. MERGE AND SORT SOURCES

        let hitsFusion = this.mergeAndSortFeed(sources);

        // 3. REMOVE HIDDEN SPACES

        hitsFusion = hitsFusion.filter((element) => {
            return !this.hiddenSpaces.includes(element.objectID);
        });

        this.hits = hitsFusion;

        this.feed = {
            spaceHits: {
                ...spaceHits,
                page: this.currentPage,
                pages: Math.ceil(hitsFusion.length / this.pageSize),
                // hits: this.hits.slice(
                //     0,
                //     this.pageSize * (this.currentPage + 1)
                // ),
            },
            trendingFacets,
            topArtists,
        };

        return this.feed;
    }

    public async getMore(currentPage: number) {
        this.currentPage = currentPage;

        this.feed.spaceHits = {
            ...this.feed.spaceHits,
            page: this.currentPage,
            hits: this.hits.slice(0, this.pageSize * (this.currentPage + 1)),
        };
    }

    private async getMultiplayerObjects() {
        try {
            const rooms = await getRooms();

            const spaceIds = rooms.reduce((acc, currentVal) => {
                if (currentVal.clients < 3) return acc;

                return {
                    ...acc,
                    [currentVal.metadata.exhibitId]: {
                        id: currentVal.metadata.exhibitId,
                        clients: currentVal.clients,
                    },
                };
            }, {});

            return this.algolia.exhibitsIndex
                .getObjects(Object.keys(spaceIds))
                .then(({ results }) => {
                    return results
                        .filter((hit) => hit)
                        .map((hit) => {
                            const _hit = this.algolia.formatSpaceHit(hit);

                            _hit.clients = spaceIds[_hit.objectID].clients;

                            _hit.tags.push({
                                title: `${_hit.clients} online now`,
                                key: "online",
                            });

                            _hit.priority = 1;

                            return _hit;
                        });
                });
        } catch (err) {
            console.log("err", err);

            return [];
        }
    }

    private async getCMSObjects() {
        try {
            const cms = await getCMS();

            const ids = {};

            const spaceIds = cms.flatMap((doc) => {
                const { attributes } = doc;

                const _ids = attributes.Exhibit.map(
                    ({ ExhibitID }) => ExhibitID
                );

                ids[attributes.Name] = _ids;

                return _ids;
            });

            return this.algolia.exhibitsIndex
                .getObjects(spaceIds)
                .then(({ results }) => {
                    return results
                        .filter((hit) => hit)
                        .map((hit) => {
                            const _hit = this.algolia.formatSpaceHit(hit);

                            Object.keys(ids).forEach((key) => {
                                if (ids[key].includes(_hit.objectID)) {
                                    let category = {};

                                    if (key === "Community") {
                                        category = CATEGORIES["community"];
                                    }

                                    if (key === "Staff Picks") {
                                        category = CATEGORIES["staffpicks"];
                                    }

                                    _hit.tags.push(category);
                                }
                            });

                            return _hit;
                        });
                });
        } catch (err) {
            console.log("err", err);
            return [];
        }
    }

    private mergeAndSortFeed(arrays) {
        const indices = [];

        // we put priority 1 items first
        const uniqueIds = {};

        const merged = [
            ...arrays
                .filter((array, index) => {
                    if (array.priority === 1) {
                        indices.push(index);
                        return true;
                    }

                    return false;
                })
                .flatMap((array) => array.source),
        ];

        merged.forEach((item, index) => {
            uniqueIds[item.objectID] = index;
        });

        indices.forEach((index) => {
            arrays.splice(index, 1);
        });

        // then we merge the rest

        while (arrays.length) {
            const randomIndex = Math.floor(Math.random() * arrays.length);

            const randomArray = arrays[randomIndex].source;

            if (randomArray.length) {
                const item = randomArray.shift();

                // if it's already a duplicate then merge tags
                if (typeof uniqueIds[item.objectID] === "number") {
                    const index = uniqueIds[item.objectID];

                    const category = arrays[randomIndex].category;

                    if (
                        CATEGORIES[category] &&
                        !merged[index]?.tags?.find?.(
                            (tag) => tag?.key === CATEGORIES?.[category]?.key
                        )
                    ) {
                        merged[index].tags.push(CATEGORIES[category]);
                    }

                    if (category === "cms" || category === "multiplayer") {
                        merged[index].tags.push(...item.tags);
                    }

                    continue;
                }

                const category = arrays[randomIndex].category;

                if (CATEGORIES[category]) {
                    item.tags.push(CATEGORIES[category]);
                }

                merged.push(item);

                uniqueIds[item.objectID] = merged.length - 1;
            } else {
                arrays.splice(randomIndex, 1);
            }
        }

        return merged;
    }
}
