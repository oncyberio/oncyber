//

import { Experience } from "@uitypes/experience";
import { getJSON, parseLocation } from "@utils/js";
import { getExhibitByCustomLink, getPublicUserExhibits } from "@utils/saveToDb";

export type ExhibitStatus = "owned" | "collab" | "search";

const cyberOriginRe =
    /^(?:(?:http|https)\:\/\/)?(?:oncyber\.io|oncyber\.vercel\.app|cyber-art-git-(?:\S*)-oncyber\.vercel\.app)\/(\S+)/;

function isSpaceLink(s: string) {
    //
    return cyberOriginRe.test(s);
}

function getExhibitLinkData(s: string): {
    slug: string;
    coords: string;
} {
    //
    let result = {
        slug: null,
        coords: null,
    };

    if (!isSpaceLink(s)) return null;

    if (!s.startsWith("http")) {
        //
        s = "https://" + s;
    }

    let url: URL;

    try {
        url = new URL(s);
    } catch (err) {
        console.error(err);
        return null;
    }

    if (url.pathname.startsWith("/spaces/")) {
        result.slug = "s@" + url.pathname.slice("/spaces/".length);
    } else {
        result.slug = url.pathname.slice(1);
    }

    let coordsParam = url.searchParams.get("coords");

    if (coordsParam) {
        const location = parseLocation(coordsParam);
        if (location != null) {
            result.coords = coordsParam;
        }
    }

    return result;
}

export function hasText(s: string, pattern: string) {
    if (!s) return false;
    return s?.toLowerCase?.()?.includes?.(pattern.toLowerCase());
}

export async function fetchExhibits(walletId: string): Promise<Experience[]> {
    //
    const result = await getPublicUserExhibits(walletId);

    if (result.success) {
        return result.exhibits;
    } else {
        throw new Error(
            result.message || "Failed to fetch wallet's experiences"
        );
    }
}

export interface SWRLike {
    isLoading?: boolean;
    data?: Experience[];
    error?: any;
}

export async function searchExhibits(query: string): Promise<SWRLike> {
    //

    try {
        let exhibitLinkData = getExhibitLinkData(query);

        let exhibits: Experience[] = null;
        let error;

        if (exhibitLinkData == null) {
            let data = await getJSON(
                `/api/exhibit?type=SEARCH_EXHIBITS&search=${query}`
            );

            if (data.success) {
                exhibits = data.exhibits;
            } else {
                error = data.message || "Failed to fetch matching exhibits";
            }
        } else if (exhibitLinkData) {
            let data = await getExhibitByCustomLink(exhibitLinkData.slug);

            if (data.success) {
                let exhibit = data.exhibit as Experience;

                if (exhibitLinkData.coords) {
                    exhibit.info.coords = exhibitLinkData.coords;
                }

                exhibits = [exhibit];
            } else {
                error = data.message || "Failed to fetch exhibit link";
            }
        }

        if (error) return { error };

        exhibits.forEach((it) => {
            if (!it.info.headline) {
                it.info.headline = "Untitled";
            }
        });

        return { data: exhibits };
    } catch (err) {
        //
        console.error(err);

        return { error: err.message || "Failed to fetch" };
    }
}

export function filterExhibits(
    exhibits: SWRLike,
    status: ExhibitStatus
): SWRLike {
    if (exhibits.error || !exhibits.data) return exhibits;

    return {
        data: exhibits.data.filter((it) => {
            return status === "collab" ? it.invited : !it.invited;
        }),
        error: null,
    };
}
