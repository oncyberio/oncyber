import type { ParsedUrlQuery } from "querystring";
import { measureSsrStage } from "./serverside/ssrTiming";
import { Experience } from "@uitypes/experience";
import { User } from "@uitypes/user";
import { RoomParameters } from "@uitypes/roomParameters";

import {
    getExhibitByCustomLink,
    getExhibitById,
    getExhibitsByIds,
} from "pages/api/exhibit";
import { Failure, removeDuplicates, Result, Success } from "./js";
import {
    getDestinationBySlug as firestoreGetBySlug,
    getDestinationsBySlugs as firestoreGetBySlugs,
} from "./firestore/destinations";
import { processArtworks } from "utils/artworks";
import { db } from "./firebaseAdmin";
import { getUserProfileByWalletId } from "./firestore/userProfiles";
import { newToOld, oldToNew, pathToSlug } from "./saveToDb";
import { formatExhibit } from "./metadata/formatExhibit";
import { GET_SINGLE_DISPLAY_EXPERIENCE } from "./partnerships/singledisplay";
import { EMPTY_ROOM } from "./emptyRoom";
import { isNativeRuntime } from "@utils/runtimeKind";

export const DEFAULT_EXHIBIT_SLUG = "exhibit@";

export interface ExhibitPageData {
    dest?: RoomParameters;
    experience?: Experience;
}

async function getExhibits(ids: string[]): Promise<Result<Experience[]>> {
    //
    try {
        const exhibits = await getExhibitsByIds(ids);
        return Success(exhibits);
    } catch (err) {
        return Failure(err.message || "Failed to get exhibits");
    }
}

export async function getUser(walletId: string): Promise<Result<User>> {
    //
    walletId = walletId.toLowerCase();

    // Served from the shared walletId profile cache. This also drops the old
    // `doc(walletId).get()` fast path, which mostly *missed* (user docs are
    // keyed by original-case accountId, not the lowercased walletId) and then
    // fell back to the `walletId ==` query anyway — i.e. it cost a wasted read
    // on the common case. The cache resolves via the canonical walletId field.
    const profile = await getUserProfileByWalletId(walletId);

    if (!profile) {
        return Failure("Failed to get user " + walletId);
    }

    const { email, ...user } = profile;

    return Success(user as User);
}

function formatDestination(data: any): RoomParameters {
    //
    const { params, created_at, updated_at, ...destination } = data;

    return {
        ...params,
        ...destination,
        created_at: created_at?.toDate?.()?.toISOString?.() || null,
        updated_at: updated_at?.toDate?.()?.toISOString?.() || null,
    };
}

export async function getDestination(
    roomId: string
): Promise<Result<RoomParameters>> {
    //
    try {
        if (roomId === EMPTY_ROOM.slug) return Success(EMPTY_ROOM);

        const slug = pathToSlug[roomId] || roomId;

        const slugV2 = oldToNew?.[slug] || slug;

        const dest = await firestoreGetBySlug(slugV2);

        if (!dest) return Failure("Not found");

        return Success(formatDestination(dest));
    } catch (err) {
        console.error(err);
        return Failure(err?.message || "Unexpected server error");
    }
}

export async function getMultipleDestinations(
    roomIds: string[]
): Promise<Result<RoomParameters[]>> {
    //

    const slugs = roomIds.map((id) => {
        let slug = pathToSlug[id] || id;
        return oldToNew?.[slug] || slug;
    });

    try {
        const results = await firestoreGetBySlugs(slugs);

        if (!results || results.length === 0) return Failure("Not found");

        const destinations = results.map(formatDestination);
        return Success(destinations);
    } catch (err) {
        console.error(err);
        return Failure(err?.message || "Unexpected server error");
    }
}

/**
 * The `/[slug]` page's world read, for `BasicServerSideProps`'s `prefetch`:
 * it does not depend on who is signed in, so it can start beside the sign-in
 * and profile reads. Profile pages (`/@name`) read nothing here.
 */
export function prefetchSlugPageData({
    params,
    query,
}: {
    params?: ParsedUrlQuery;
    query?: ParsedUrlQuery;
}): Promise<ExhibitPageData> | undefined {
    const slug = params?.slug;
    if (typeof slug !== "string" || slug[0] === "@") return undefined;
    // Same alias as the page applies before its own read.
    return fetchExhibitData(slug === "built" ? "BUILT" : slug, "slug", query);
}

export async function fetchExhibitData(
    id: string,
    type: "slug" | "id",
    query: ParsedUrlQuery = {}
): Promise<ExhibitPageData> {
    //
    if (typeof window !== "undefined") {
        throw new Error(
            "ssr/fetchExhibitData can't be invoked from the frontend"
        );
    }
    //
    let exhibit: Experience;
    let destination: RoomParameters;

    if (id.startsWith("s@")) {
        id = id.slice(2);
        type = "id";
    }

    try {
        exhibit = await measureSsrStage("ssr_exhibit", () =>
            type === "id" ? getExhibitById(id) : getExhibitByCustomLink(id)
        );

        if (exhibit != null) {
            //console.log("/[slug] fetched exhibit", response);

            exhibit = formatExhibit(exhibit as Experience);

            const room = exhibit.info?.room;

            if (room) {
                exhibit.info.room = pathToSlug[room] || room;
            }

            exhibit.portalExhibits = {};
            exhibit.portalsDestinations = {};
            exhibit.portalsOwners = {};

            let singledisplayRequest: Promise<unknown>;

            const singledisplay = GET_SINGLE_DISPLAY_EXPERIENCE({
                custom_link: id,
            });

            if (type === "slug" && singledisplay && query.id) {
                singledisplayRequest = fetch(singledisplay.link(query))
                    .then(async (data) => {
                        const _exhibit = await singledisplay.formatter(
                            data,
                            query.contract,
                            exhibit
                        );

                        if (_exhibit) {
                            exhibit = _exhibit;
                        }
                    })
                    .catch((err) => {
                        console.error(err);
                    });
            }

            const portals = Object.values(exhibit.portals || {});

            let exhibitIds = portals
                .map((p) => p.exhibitId)
                .filter((id) => {
                    return id != exhibit.id;
                });

            // If in-same-exehibit portal
            exhibitIds = removeDuplicates(exhibitIds);

            // if (exhibitIds.length > 0 && exhibitIds.length < 30) {
            //     //
            //     const exhibitIds = portals.map((p) => p.exhibitId);

            //     exhibitIds.forEach((it) => {
            //         exhibit.portalExhibits[it] = null;
            //     });

            //     let [response, ownerResp] = await Promise.all([
            //         getExhibits(exhibitIds),
            //         getUser(exhibit.owner),
            //     ]);

            //     if (ownerResp.success) {
            //         exhibit.ownerData = ownerResp.value;
            //     }
            //     if (response.success) {
            //         // Preload portal exhibits
            //         const exhibits = response.value;

            //         exhibits.forEach((e) => {
            //             //
            //             e = formatExhibit(e);

            //             const room = e.info?.room;
            //             if (room) {
            //                 e.info.room = pathToSlug[room] || room;
            //             }

            //             exhibit.portalExhibits[e.id] = e;

            //             if (exhibit.owner !== e.owner) {
            //                 exhibit.portalsOwners[e.owner.toLowerCase()] = null;
            //             }

            //             if (e.info.room !== exhibit.info.room) {
            //                 exhibit.portalsDestinations[e.info.room] = null;
            //             }
            //         });

            //         const destSlugs = Object.keys(exhibit.portalsDestinations);

            //         await Promise.all([
            //             getMultipleDestinations(destSlugs).then((result) => {
            //                 if (result.success) {
            //                     result.value.forEach((destination, index) => {
            //                         const slug =
            //                             newToOld[destination.slug] ||
            //                             destination.slug;

            //                         exhibit.portalsDestinations[slug] =
            //                             destination;
            //                     });
            //                 }
            //             }),
            //             getDestination(exhibit.info.room).then((result) => {
            //                 if (result.success) {
            //                     destination = result.value;
            //                 }
            //             }),
            //             getUsers(Object.keys(exhibit.portalsOwners)).then(
            //                 (response) => {
            //                     if (response.success) {
            //                         const users = response.value;
            //                         for (let walletId in exhibit.portalsOwners) {
            //                             // @ts-ignore
            //                             exhibit.portalsOwners[walletId] =
            //                                 users.find(
            //                                     (it) =>
            //                                         it.id.toLowerCase() ===
            //                                         walletId.toLowerCase()
            //                                 ) || {
            //                                     walletId:
            //                                         walletId.toLowerCase(),
            //                                 };
            //                         }
            //                     }
            //                 }
            //             ),
            //         ]);
            //     }
            // }

            // const isRuumfordsSpace = getRuumfordsCachedSpace(exhibit.info.room);

            // if (isRuumfordsSpace) {
            //     destination = isRuumfordsSpace;
            // }

            // Only native galleries have a room; other runtimes are roomless.
            if (destination == null && isNativeRuntime(exhibit.runtime)) {
                // console.log("/[slug] fetching destination", exhibit?.info.room);
                let result = await measureSsrStage("ssr_destination", () =>
                    getDestination(exhibit?.info.room)
                );

                if (result.success) {
                    destination = result.value;
                } else {
                    throw new Error(
                        "Failed to load destination" + exhibit?.info.room
                    );
                }
            }

            if (singledisplayRequest) {
                await singledisplayRequest;
            }

            // `loadExhibitView` embeds ownerName in the cached exhibit payload
            // (null = resolved, no profile), so the per-pageview owner lookup
            // only runs for cache entries written before that field existed.
            if (exhibit.ownerName === undefined) {
                try {
                    let ownerProfileResult = await measureSsrStage("ssr_owner", () =>
                        getUser(exhibit?.owner)
                    );
                    exhibit.ownerName =
                        ownerProfileResult?.value?.username || null;
                } catch (e) {}
            }
        }
    } catch (e) {
        console.error("Failed to fetch exhibit page data", e.message);
        return {
            dest: null,
            experience: null,
        };
    }

    if (exhibit?.artworks) {
        exhibit.artworks = processArtworks(exhibit.artworks);
    }

    return {
        dest: destination || null,
        experience: exhibit || null,
    };
}
