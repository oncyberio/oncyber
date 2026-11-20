import type { Destination } from "@uitypes/destinations";
import { canUseTemplate } from "@features/spaces/create/components/DestinationSelector/roomSections";
import { BUILD_CARDS } from "./buildOptions";
import type { LandingCard } from "./types";
import {
    matchesTemplate,
    selectTemplateRooms,
    type TemplateCategory,
} from "./templateSearch";

import { destinationCover } from "@utils/destinationCover";
import { resize } from "@utils/urlUtils";
export { CYBER_WAREHOUSE_COVER } from "@utils/destinationCover";

// Cards and the details panel show covers about 500 CSS px wide, so 1024
// device pixels covers 2x screens. Uploaded covers are often 2048 px PNGs;
// hosts that resize (Pinata, Cloudinary) also convert them to WebP.
const COVER_WIDTH = 1024;

function cardImage(url: string) {
    return resize(url, COVER_WIDTH, undefined, "webp");
}

/** Approved template artwork, sized for cards and the details panel. */
export function templateCover(room?: Parameters<typeof destinationCover>[0]) {
    const cover = destinationCover(room);
    return cover && cardImage(cover);
}

/** A world built from the blank canvas. */
export const BLANK_CANVAS_COVER = "/landing-build/blank-canvas-1280.webp";

/** Kept out of Create for now (Cyber Classic, Art Blocks gallery). */
export const HIDDEN_TEMPLATES = ["classic", "artblocksgallery"];

/** A build-from-scratch kit: it opens the empty void with its pieces. */
export function isKitRoom(room?: { params?: { isFuture?: boolean } }) {
    return room?.params?.isFuture === true;
}

/**
 * One gallery catalog: usable rooms, a blank canvas, the build-from-scratch
 * kits, then collectibles.
 */
export function createTemplateCards(
    groups: {
        owned: Destination[];
        uploaded: Destination[];
        purchase: Destination[];
    },
    ownedRooms: Record<string, boolean>,
    query: string,
    category: TemplateCategory,
    checking = false
): LandingCard[] {
    const available = selectTemplateRooms(groups, query, category).filter(
        (room) => !HIDDEN_TEMPLATES.includes(room.slug)
    );
    const collectible = new Set(groups.purchase.map((room) => room.slug));
    const roomCard = (room: Destination): LandingCard => {
        const ready = canUseTemplate(room, ownedRooms, checking);
        const cover = destinationCover(room);
        return {
            id: `template-${room.slug}`,
            title: room.name,
            room: room.slug,
            href: `/studio?templateId=${encodeURIComponent(room.slug)}`,
            description: room.description || "A space for your collection.",
            templateStatus: room.tag.includes("free")
                ? "free"
                : room.tag.includes("uploaded")
                ? "owned"
                : checking
                ? "checking"
                : ownedRooms[room.slug]
                ? "owned"
                : "uncollected",
            buildStatus: ready ? "Use template" : "View details",
            actionLabel: ready
                ? `Use ${room.name} template`
                : `View ${room.name} details`,
            imageUrls: (cover &&
            cover !== room.image &&
            cover !== room.thumbnail
                ? [cover]
                : [room.image, room.thumbnail].filter(Boolean)
            ).map(cardImage),
            creator: "",
            owner: "",
            visits: 0,
            chains: [],
            collections: [],
            tags: room.tag,
            portrait: false,
        };
    };
    // A kit that can't be used yet opens its details, like other templates.
    const kitCard = (room: Destination): LandingCard =>
        canUseTemplate(room, ownedRooms, checking)
            ? {
                  ...roomCard(room),
                  buildStatus: "Build with this kit",
                  actionLabel: `Build with the ${room.name} kit`,
              }
            : roomCard(room);
    const starters: LandingCard[] = [
        {
            ...BUILD_CARDS[0],
            id: "template-blank",
            title: "Blank canvas",
            room: "@@empty",
            href: "/studio?templateId=%40%40empty",
            imageUrls: [BLANK_CANVAS_COVER],
            buildStatus: "Start from scratch",
            templateStatus: "free",
            description: "Build your own space in Studio.",
        },
    ];
    const templates = available.filter((room) => !isKitRoom(room));
    return [
        ...templates
            .filter((room) => !collectible.has(room.slug))
            .map(roomCard),
        ...(category === "all" || category === "free"
            ? starters.filter((card) =>
                  matchesTemplate(query, card.title, card.description)
              )
            : []),
        ...available.filter(isKitRoom).map(kitCard),
        ...templates.filter((room) => collectible.has(room.slug)).map(roomCard),
    ];
}
