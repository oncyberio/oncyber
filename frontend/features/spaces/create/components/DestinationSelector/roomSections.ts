import type { Destination } from "@uitypes/destinations";
import { withDefaultTemplateTags } from "@utils/defaultTemplates";
export { withDefaultTemplateTags } from "@utils/defaultTemplates";

const skip = ["vipekit", "galaxy-kit", "genesis-kit", "canvas-kit"];
/** Shared by the Studio picker and the landing creation grid. */
export function roomSections(
    filteredRooms: Destination[],
    ownedRooms: Record<string, boolean>,
    context: string,
    roomFloorPrices: Record<string, any> = {}
) {
    let result: Record<"owned" | "purchase" | "uploaded", Destination[]> = {
        owned: [],
        purchase: [],
        uploaded: [],
    };

    let owned = [];
    let free = [];
    let uploaded = [];

    // if (isFuture) {
    //     free.push(GALAXY_ROOM);
    // }

    let purchase = Object.assign(Object.create(null), {
        factory: [],
        curated: [],
        rtfkt: [],
        andfriends: [],
        "factory-polygon": [],
        autograph: [],
        "oncyber-ethereum-community": [],
        collectibles: [],
        exopods: [],
    });

    filteredRooms?.map(withDefaultTemplateTags).forEach((room) => {
        if (room.tag.includes("free")) {
            free.push(room);
        } else if (room.tag.includes("uploaded")) {
            if (context !== "marketplace") {
                if (context === "studio") {
                    if (!room?.params?.isFuture) {
                        uploaded.push(room);
                    }
                } else {
                    uploaded.push(room);
                }
            }
        } else {
            const isOwned = !!ownedRooms[room.slug];

            if (isOwned) {
                owned.push(room);
            }

            if (!isOwned) {
                (purchase[room.contractName] ||= []).push(room);
            }
        }
    });

    owned.sort((a, b) => {
        const aprice =
            roomFloorPrices[a.blockchain]?.[a.contractName]?.[a.token_id] ?? 0;

        const bprice =
            roomFloorPrices[b.blockchain]?.[b.contractName]?.[b.token_id] ?? 0;

        return bprice - aprice;
    });

    free = free.filter((it) => !skip.includes(it.slug));

    result.owned = owned.concat(free);

    result.owned.sort((a, b) => {
        if (a.slug === "cyberwarehouse") return -1;
        if (b.slug === "cyberwarehouse") return 1;
        if (a.slug === "artblocksgallery") return 1;
        if (b.slug === "artblocksgallery") return -1;
        return 0;
    });

    result.uploaded = uploaded;

    Object.keys(purchase).forEach((contractName) => {
        result.purchase = result.purchase.concat(purchase[contractName]);
    });

    return result;
}

/** Paid rooms stay locked until the current wallet check has completed. */
export function canUseTemplate(
    room: Destination,
    ownedRooms: Record<string, boolean>,
    checking = false
) {
    return (
        room.tag.includes("free") ||
        room.tag.includes("uploaded") ||
        (!checking && !!ownedRooms[room.slug])
    );
}
