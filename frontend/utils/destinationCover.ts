export const CYBER_WAREHOUSE_COVER = "/landing-build/cyber-warehouse.jpg";

// GPT Image restorations of the original room previews, shared by search and Studio.
// Versioned local assets keep the old remote originals intact.
const destinationCovers = new Map([
    ["cyberwarehouse", CYBER_WAREHOUSE_COVER],
    ["white-cube", "/landing-build/gallery-previews/white-cube-gpt.webp"],
    ["wolfgang-n2", "/landing-build/gallery-previews/wolfgang-n2-gpt.webp"],
    [
        "wolfgang-n2-dark",
        "/landing-build/gallery-previews/wolfgang-n2-dark-gpt.webp",
    ],
    ["loft", "/landing-build/gallery-previews/loft-gpt.webp"],
    ["classic", "/landing-build/gallery-previews/classic-gpt.webp"],
    ["altitude", "/landing-build/gallery-previews/altitude-gpt.webp"],
]);

type DestinationPreview = {
    slug?: string;
    image?: string;
    thumbnail?: string;
};

/** Approved template artwork shared by discovery and Studio. */
export function destinationCover(room?: DestinationPreview) {
    return destinationCovers.get(room?.slug) || room?.image || room?.thumbnail;
}

/** Custom world covers take precedence; drafts can resolve by template ID alone. */
export function exhibitCover(
    info?: { room?: string; heroImg?: string; cHeroImg?: string },
    destination?: DestinationPreview
) {
    return (
        info?.heroImg ||
        info?.cHeroImg ||
        destinationCovers.get(info?.room || destination?.slug) ||
        destination?.thumbnail ||
        destination?.image ||
        "/images/sq_image_placeholder.png"
    );
}
