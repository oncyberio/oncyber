import type { LandingCard } from "./types";

/** Stable reference-mark variants: a world keeps its cover across pages/filters. */
export function fallbackCover(id: string): string {
    let hash = 2166136261;
    for (let index = 0; index < id.length; index++) {
        hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
    }
    return `/brand/world-placeholders/mark-${((hash >>> 0) % 6) + 1}-gpt.webp`;
}

/** Real covers always win; the same local fallback serves DOM and WebGL cards. */
export function coverSources(card: Pick<LandingCard, "id" | "imageUrls">) {
    return [...card.imageUrls, fallbackCover(card.id)];
}
