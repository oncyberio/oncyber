import {
    artblocksFormatter,
    IS_ARTBLOCKS_CUSTOM_LINK,
    IS_ARTBLOCKS_SPACE_SLUG,
    MAX_ARTBLOCKS_HEIGHT,
} from "./artblocks";

import {
    IS_LOOKSRARE_CUSTOM_LINK,
    IS_LOOKSRARE_SPACE_SLUG,
    looksrareFormatter,
    MAX_LOOKSRARE_HEIGHT,
} from "./looksrare";

export function GET_SINGLE_DISPLAY_EXPERIENCE({
    custom_link,
    slug,
}: {
    slug?: string;
    custom_link?: string;
}) {
    if (
        (slug && IS_ARTBLOCKS_SPACE_SLUG(slug)) ||
        (custom_link && IS_ARTBLOCKS_CUSTOM_LINK(custom_link))
    ) {
        return {
            type: "artblocks",
            formatter: artblocksFormatter,
            link: (query) => `https://api.artblocks.io/token/${query.id}`,
            max_height: MAX_ARTBLOCKS_HEIGHT,
        };
    }

    if (
        (slug && IS_LOOKSRARE_SPACE_SLUG(slug)) ||
        (custom_link && IS_LOOKSRARE_CUSTOM_LINK(custom_link))
    ) {
        return {
            type: "looksrare",
            formatter: looksrareFormatter,
            link: (query) =>
                `https://api.looksrare.org/api/v1/tokens?collection=${query.contract}&tokenId=${query.id}`,
            max_height: MAX_LOOKSRARE_HEIGHT,
        };
    }

    return null;
}
