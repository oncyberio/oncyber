import { Experience } from "@uitypes/experience";

export function hasCSSEmbeds(exhibit: Experience) {
    return Object.values(exhibit.artworks || {}).some((asset) => {
        return (
            asset.data?.mime_type?.startsWith?.("embed/") ||
            asset.data?.mime_type === "text/html"
        );
    });
}
