import { loadMediaAlternatives } from "./alternatives";

/** Use the saved HTML copy before retired marketplace URLs. */
export async function loadArtworkDocument(data: any, abort?: AbortSignal) {
    const urls = [
        data.dcompressed_animation_url,
        data.animation_url,
        data.animation_original_url,
        data.original_animation_url,
    ].filter(Boolean);
    if (!urls.length && data.image_url) urls.push(data.image_url);
    return loadMediaAlternatives(
        urls,
        async (url, signal) => {
            const response = await fetch(url, { signal });
            if (!response.ok)
                throw new Error(`Artwork document HTTP ${response.status}`);
            return { url, text: await response.text() };
        },
        abort
    );
}
