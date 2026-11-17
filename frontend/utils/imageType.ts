/**
 * The image format of a file, read from its first bytes. A URL's extension
 * or a server's Content-Type can't be trusted: NFT media hosts answer with
 * whatever format they like for the same address.
 */
export type ImageType = "jpeg" | "png" | "gif" | "webp" | "avif" | "heic";

export function sniffImageType(
    data: ArrayBuffer | Uint8Array
): ImageType | null {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const text = (from: number, to: number) =>
        String.fromCharCode(...bytes.subarray(from, to));
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
        return "jpeg";
    if (text(1, 4) === "PNG" && bytes[0] === 0x89) return "png";
    if (text(0, 4) === "GIF8") return "gif";
    if (text(0, 4) === "RIFF" && text(8, 12) === "WEBP") return "webp";
    if (text(4, 8) === "ftyp") {
        const brand = text(8, 12);
        if (brand === "avif" || brand === "avis") return "avif";
        if (["heic", "heix", "hevc", "mif1", "msf1"].includes(brand))
            return "heic";
    }
    return null;
}

/** Formats the gateway's image resizer (`?img-width=`) accepts. */
export function gatewayCanResize(type: ImageType | null) {
    return (
        type === "jpeg" || type === "png" || type === "gif" || type === "webp"
    );
}
