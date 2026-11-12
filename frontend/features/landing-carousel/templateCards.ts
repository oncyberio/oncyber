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
export {
    CYBER_WAREHOUSE_COVER,
    destinationCover as templateCover,
} from "@utils/destinationCover";

/** One gallery catalog: usable rooms and a blank canvas, then collectibles. */
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
    const available = selectTemplateRooms(groups, query, category);
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
            imageUrls:
                cover && cover !== room.image && cover !== room.thumbnail
                    ? [cover]
                    : [room.image, room.thumbnail].filter(Boolean),
            creator: "",
            owner: "",
            visits: 0,
            chains: [],
            collections: [],
            tags: room.tag,
            portrait: false,
        };
    };
    const starters: LandingCard[] = [
        {
            ...BUILD_CARDS[0],
            id: "template-blank",
            title: "Blank canvas",
            room: "@@empty",
            href: "/studio?templateId=%40%40empty",
            buildStatus: "Start from scratch",
            templateStatus: "free",
            description: "Build your own space in Studio.",
        },
    ];
    return [
        ...available
            .filter((room) => !collectible.has(room.slug))
            .map(roomCard),
        ...(category === "all" || category === "free"
            ? starters.filter((card) =>
                  matchesTemplate(query, card.title, card.description)
              )
            : []),
        ...available.filter((room) => collectible.has(room.slug)).map(roomCard),
    ];
}
