/** Keep only the selected preview; never retain a wallet-sized texture cache. */
let selected: { url: string; canvas: HTMLCanvasElement; aspect: number } | undefined;

export function rememberFlashPreview(url: string, image: HTMLImageElement) {
    selected = undefined;
    if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return;
    try {
        const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) return;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        // Only CORS-safe previews may be uploaded to the renderer.
        context.getImageData(0, 0, 1, 1);
        selected = { url, canvas, aspect: image.naturalWidth / image.naturalHeight };
    } catch {
        // Fall back to the normal image loader if a preview cannot be reused.
    }
}

export function takeFlashPreview(url: string) {
    if (selected?.url !== url) return undefined;
    const preview = selected;
    selected = undefined;
    return preview;
}
