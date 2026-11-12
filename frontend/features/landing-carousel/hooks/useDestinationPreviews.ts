import { useEffect, useMemo, useState } from "react";
import {
    hasDefaultGalleryCover,
    previewForRoom,
    type DestinationPreviews,
} from "@utils/destinationPreviews";
import type { LandingCard } from "../types";

let cached: DestinationPreviews | null = null;
let pending: Promise<DestinationPreviews> | null = null;

function loadPreviews() {
    if (cached) return Promise.resolve(cached);
    if (pending) return pending;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    pending = fetch("/api/destinations/previews", { signal: controller.signal })
        .then(async (response) => {
            if (!response.ok) throw new Error("Preview catalog unavailable");
            const result = await response.json();
            if (
                !result.success ||
                !result.previews ||
                typeof result.previews !== "object"
            )
                throw new Error("Invalid preview catalog");
            cached = result.previews;
            return cached;
        })
        .finally(() => {
            clearTimeout(timeout);
            pending = null;
        });
    return pending;
}

export default function useDestinationPreviews(
    cards: LandingCard[],
    active: boolean
) {
    const [previews, setPreviews] = useState<DestinationPreviews | null>(null);
    const needsPreviews =
        active &&
        cards.some(
            (card) =>
                card.room &&
                !card.buildStatus &&
                hasDefaultGalleryCover(card.imageUrls) &&
                !previewForRoom({}, card.room).length
        );
    useEffect(() => {
        if (!needsPreviews) return;
        let cancelled = false;
        void loadPreviews()
            .then((result) => {
                if (!cancelled) setPreviews(result);
            })
            .catch(() => {
                // Retain the existing local mark if the catalog is unavailable.
            });
        return () => {
            cancelled = true;
        };
    }, [needsPreviews]);

    return useMemo(() => {
        if (!active) return cards;
        let changed = false;
        const resolved = cards.map((card) => {
            if (
                !card.room ||
                card.buildStatus ||
                !hasDefaultGalleryCover(card.imageUrls)
            )
                return card;
            const sources = previewForRoom(previews || {}, card.room);
            if (!sources.length) return card;
            changed = true;
            return {
                ...card,
                imageUrls: [...new Set([...sources, ...card.imageUrls])],
            };
        });
        return changed ? resolved : cards;
    }, [cards, previews, active]);
}
