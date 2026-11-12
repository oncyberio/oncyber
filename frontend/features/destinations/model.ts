import type { Destination } from "@uitypes/destinations";
import type { LandingCard } from "@features/landing-carousel/types";
import { destinationCover } from "@utils/destinationCover";
import {
    DESTINATION_UPLOADED_LABEL,
    destinationStatusLabel,
} from "@utils/destinations";

export type DestinationFilters = Partial<
    Record<"status" | "contractName" | "distributionType", string[]>
>;

export const DESTINATION_FILTERS = [
    {
        key: "status",
        title: "Status",
        items: [
            { key: "uploaded", title: "Uploaded" },
            { key: "tested", title: "Testing" },
            { key: "submitted", title: "Under review" },
            { key: "verified", title: "Ready for minting" },
            { key: "active", title: "Published / deployed" },
            { key: "failed", title: "Failed" },
            { key: "rejected", title: "Rejected" },
        ],
    },
    {
        key: "contractName",
        title: "Contract",
        items: [
            { key: "oncyber-ethereum-community", title: "Community Ethereum" },
            { key: "factory-polygon", title: "Community Polygon" },
        ],
    },
    {
        key: "distributionType",
        title: "Distribution",
        items: [
            { key: "self_claim_tokens", title: "Self claim tokens" },
            { key: "create_claim_page", title: "Create claim page" },
        ],
    },
] as const;

export function destinationStatus(room: Destination): string {
    // Kitbash uploads are not tested for review, so they stay "Uploaded".
    if (room.status === "tested" && room.params?.isFuture)
        return DESTINATION_UPLOADED_LABEL;
    return destinationStatusLabel(room.status);
}

export function destinationLabel(
    key: "contractName" | "distributionType",
    value?: string
): string {
    return (
        DESTINATION_FILTERS.find((group) => group.key === key)?.items.find(
            (item) => item.key === value
        )?.title ||
        value ||
        ""
    );
}

export function destinationCard(room: Destination): LandingCard {
    const id = room.slug || room._id;
    const contract = destinationLabel("contractName", room.contractName);
    const distribution = destinationLabel(
        "distributionType",
        room.distributionType
    );
    return {
        id,
        title: room.name || "Untitled destination",
        href: `/destinations/${encodeURIComponent(id)}`,
        actionLabel: `Manage ${room.name || "Untitled destination"}`,
        description:
            room.description ||
            [
                room.params?.isFuture ? "Kitbash" : "Gallery destination",
                contract,
            ]
                .filter(Boolean)
                .join(" · "),
        creator: room.author?.name || "",
        owner: room.author?.userId || "",
        room: id,
        visits: 0,
        chains: [room.blockchain || room.chain].filter(Boolean),
        collections: contract ? [contract] : [],
        tags: [...(room.tag || []), distribution].filter(Boolean),
        imageUrls: [
            ...new Set(
                [destinationCover(room), room.thumbnail].filter(Boolean)
            ),
        ],
        portrait: false,
        buildStatus: distribution || contract || "Uploaded destination",
        destinationStatus: destinationStatus(room),
    };
}

export function filterDestinations(
    rooms: Destination[],
    filters: DestinationFilters,
    query: string
): Destination[] {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return rooms.filter((room) => {
        const matchesFilters = Object.entries(filters).every(
            ([key, values]) => {
                if (!values?.length) return true;
                // Uploaded groups everything still in the upload/review pipeline.
                if (
                    key === "status" &&
                    values.includes("uploaded") &&
                    room.status !== "active"
                )
                    return true;
                return values.includes(room[key]);
            }
        );
        if (!matchesFilters) return false;
        const search = [
            room.name,
            room.description,
            room.slug,
            room.author?.name,
            destinationStatus(room),
            destinationLabel("contractName", room.contractName),
            destinationLabel("distributionType", room.distributionType),
            room.params?.isFuture ? "Kitbash" : "Gallery",
        ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase();
        return terms.every((term) => search.includes(term));
    });
}
