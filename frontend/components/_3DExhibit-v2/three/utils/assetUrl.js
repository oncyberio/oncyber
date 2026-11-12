/** Recognize model filenames without changing the request URL or its cache key. */
export const isGlbUrl = (value) => {
    if (typeof value !== "string") return false;
    try {
        const url = new URL(value, "https://local.invalid/");
        const path = decodeURIComponent(url.pathname);
        if (/\.glb$/i.test(path)) return true;
        // An explicit JSON glTF path must not be reclassified by arbitrary query text.
        if (/\.gltf$/i.test(path)) return false;
        return /\.glb$/i.test(url.searchParams.get("filename") || "");
    } catch {
        return false;
    }
};

/** The managed gateway also serves GLBs whose migration removed the extension.
 * Used only by the model loader; parse(arrayBuffer) supports binary and JSON glTF.
 */
export const isManagedModelUrl = (value) => {
    try {
        const url = new URL(value);
        return (
            url.protocol === "https:" &&
            url.hostname === "cyber.mypinata.cloud" &&
            !url.port &&
            !url.username &&
            !url.password &&
            /^\/ipfs\/[a-zA-Z0-9]{32,}\/?$/.test(url.pathname)
        );
    } catch {
        return false;
    }
};
