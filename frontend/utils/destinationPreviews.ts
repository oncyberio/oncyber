import { destinationCover } from "./destinationCover";

export type DestinationPreviews = Record<string, string[]>;

function imageUrl(value: unknown): string {
    if (typeof value !== "string") return "";
    if (value.startsWith("ipfs://"))
        return `https://cyber.mypinata.cloud/ipfs/${value.slice(7)}`;
    return /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value) ? value : "";
}

/** Only public cover metadata, never model data or 360 captures. */
export function destinationPreviews(
    destinations: { slug?: string; image?: string; thumbnail?: string }[]
): DestinationPreviews {
    return Object.fromEntries(
        destinations.flatMap((room) => {
            if (!room?.slug) return [];
            const cover = destinationCover(room);
            // A local approved cover replaces outdated catalog art completely.
            const sources = cover?.startsWith("/")
                ? [cover]
                : [cover, room.image, room.thumbnail];
            const images = [...new Set(sources.map(imageUrl).filter(Boolean))];
            return images.length ? [[room.slug, images]] : [];
        })
    );
}

export function previewForRoom(previews: DestinationPreviews, room: string) {
    // Resolve shipped restorations even when the remote catalog is stale or unavailable.
    // Migrated exhibits retain _v2 IDs; the public destination uses its old slug.
    const slug = room.replace(/_v2$/, "");
    const restored =
        destinationCover({ slug: room }) || destinationCover({ slug });
    if (restored) return [restored];
    const images = previews[room] || previews[slug];
    return Array.isArray(images) ? images.map(imageUrl).filter(Boolean) : [];
}

/** Replace only known stock covers; an uploaded exhibit cover always wins. */
export function hasDefaultGalleryCover(imageUrls: string[]) {
    return imageUrls.every((source) => {
        try {
            const path = new URL(source, "https://oncyber.io").pathname;
            return (
                path.startsWith("/models/") ||
                path === "/images/sq_image_placeholder.png"
            );
        } catch {
            return false;
        }
    });
}
