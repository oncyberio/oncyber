import { useEffect, useState } from "react";
import { fetchSpaceSearch } from "../data";
import { closeMatches, searchWordSuggestions } from "../notFound";
import { DiscoveryFilters, LandingCard } from "../types";

/**
 * When a search of several words finds nothing, the worlds matching each of
 * its words ("frahm genesis" finds the Frahm galleries). Null while loading
 * or when not enabled.
 */
export default function useWordMatches(
    filters: DiscoveryFilters,
    enabled: boolean
): LandingCard[] | null {
    const key = JSON.stringify(filters);
    const [found, setFound] = useState<{ key: string; cards: LandingCard[] }>(
        null
    );
    useEffect(() => {
        if (!enabled) return;
        const words = searchWordSuggestions(filters.q);
        const controller = new AbortController();
        void Promise.all(
            words.map((word) =>
                fetchSpaceSearch(
                    { ...filters, q: word },
                    "",
                    controller.signal
                ).then(
                    ({ cards }) => cards,
                    () => [] as LandingCard[]
                )
            )
        ).then((groups) => {
            if (!controller.signal.aborted)
                setFound({ key, cards: closeMatches(groups) });
        });
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, enabled]);
    return enabled && found?.key === key ? found.cards : null;
}
