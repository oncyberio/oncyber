import { nodeEnv } from "@env";
import { Asset } from "@uitypes/Asset";
import { clamp } from "./js";
import { extToMime, isUploadable } from "./mimeUtils";

export function getExt(url: string) {
    const idx = url.lastIndexOf(".");

    if (idx < 0 || idx >= url.length - 1) return null;

    return url.slice(idx + 1, url.length);
}

export async function isUrlOk(url: string) {
    if (!url) return false;
    try {
        const response = await fetch(url, {
            method: "HEAD",
        });
        return response.ok;
    } catch (err) {
        return false;
    }
}

const IPFS_PREFIX = "ipfs://";

const IPFS_HTTPS = "https://ipfs.io/ipfs/";

export function ipfsToHttp(url: string) {
    let cid = ipfsCID(url);

    if (cid) {
        return `${IPFS_HTTPS}${cid}`;
    } else {
        return url;
    }
}

export function isIPFS(url: string) {
    return url?.startsWith(IPFS_PREFIX);
}

export function isIPFSHttp(url: string) {
    return url?.startsWith(IPFS_HTTPS);
}

export function ipfsCID(url: string) {
    if (isIPFS(url)) {
        return url.slice(IPFS_PREFIX.length);
    }

    return ipfsHttpCID(url);
}

export function ipfsHttpCID(url: string) {
    if (isIPFSHttp(url)) {
        return url.slice(IPFS_HTTPS.length);
    }

    return null;
}

export type IPFSGateway = "ipfs" | "cyber" | "autograph";

export const IPFS = {
    ipfs(cid: string) {
        return `https://ipfs.io/ipfs/${cid}`;
    },

    cyber(cid: string) {
        return `https://cyber.mypinata.cloud/ipfs/${cid}`;
    },

    autograph(cid: string) {
        return `https://gateway.autograph.io/ipfs/${cid}`;
    },

    gateway(cid: string, ...types: IPFSGateway[]) {
        //
        let urls = [];

        types.forEach((type) => {
            if (type === "autograph") {
                urls.push(IPFS.autograph(cid));
            } else if (type === "cyber") {
                urls.push(IPFS.cyber(cid));
            } else if (type === "ipfs") {
                urls.push(IPFS.ipfs(cid));
            }
        });

        return urls;
    },
};

let WRES_RE = /w_\d+/;

let HRES_RE = /h_\d+/;

let WHRES_RE = /(?:w_\d+,h_\d+)|(?:h_\d+,w_\d+)/;

let MAX_RES = 4096;
let MIN_RES = 0;

const REDIRECT_RE =
    /http(?:s)?:\/\/res\.cloudinary\.com\/(oncyber-io|oncybertesting)\/(.*)\/upload.*\/v/;

/*
cf https://cloudinary.com/documentation/upload_images#public_id

    Public ID values cannot begin or end with a space or forward slash (/).
    Additionally, they cannot include the following characters: ? & # \ % < > +

*/

const INVALID_PUBLIC_ID_CHARS = /[?&#\\\/%<>+]/g;

/** Formats a resize URL can ask the host to convert an image to. */
export type ImageFormat = "webp";

// Still images only: animated GIFs, SVGs and movies keep their own format,
// and a URL that already names a format keeps it.
const KEEP_FORMAT_RE =
    /\.(gif|svg|mp4|webm|mov|m4v)(?:[?#]|$)|[/,]f_[a-z0-9]+/i;

function canConvert(url: string) {
    return !KEEP_FORMAT_RE.test(url);
}

export const isOldPolarMountainProxy = (url) => {
    return url.startsWith("https://polar-mountain-96590.herokuapp.com/")
}

export const cloudinary = {
    //
    isCloudinaryUrl(url: string) {
        return (
            url?.startsWith("https://res.cloudinary.com/") ||
            url?.startsWith("http://res.cloudinary.com/")
        );
    },

    isBrokenCloudinaryUrl(url: string) {
        return (
            url?.startsWith("https://res.cloudinary.com/oncyber-io") ||
            url?.startsWith("http://res.cloudinary.com/oncyber-io") ||
            url?.startsWith("https://res.cloudinary.com/oncybertesting") ||
            url?.startsWith("http://res.cloudinary.com/oncybertesting") ||
            // dead account, returns 401 for everything
            url?.startsWith("https://res.cloudinary.com/ugc-oo-oo") ||
            url?.startsWith("http://res.cloudinary.com/ugc-oo-oo")
        );
    },

    artworkMissingUpload(artwork: Asset) {
        if (!isUploadable(artwork.mime_type)) return false;

        return (
            !artwork.dcompressed_animation_url && !artwork.dcompressed_image_url
        );
    },

    sanitizePublicID(id: string) {
        return id.trim().replace(INVALID_PUBLIC_ID_CHARS, "");
    },

    /**
     * `format` adds Cloudinary's fetch_format (`f_webp`) to the resize this
     * builds. URLs that already carry a size transform keep theirs unchanged.
     */
    res(url: string, size: number, size2 = size, format?: ImageFormat) {
        if (!cloudinary.isCloudinaryUrl(url)) return url;

        size = clamp(Math.floor(size), MIN_RES, MAX_RES);

        if (WHRES_RE.test(url)) {
            return url
                .replace(WRES_RE, `w_${size}`)
                .replace(HRES_RE, `h_${size2}`);
        } else {
            const toFormat = format && canConvert(url) ? `,f_${format}` : "";
            return url.replace(
                "/upload/",
                `/upload/c_limit,fl_keep_dar,h_${size},w_${size2}${toFormat}/`
            );
        }
    },

    asImage(url: string) {
        if (!cloudinary.isCloudinaryUrl(url)) return url;

        let idx = url.lastIndexOf(".");

        if (idx > 0) {
            var ext = url.slice(idx);

            if (ext == ".mp4" || ext == ".webm") {
                ext = ".jpg";
            }

            return url.slice(0, idx) + ext;
        }

        return url;
    },

    toExt(url: string, ext: keyof typeof extToMime) {
        //
        if (!cloudinary.isCloudinaryUrl(url)) return url;

        let idx = url.lastIndexOf(".");

        if (idx > 0) {
            return url.slice(0, idx) + "." + ext;
        }

        return url;
    },

    lod(url: string, res = 300) {
        if (!cloudinary.isCloudinaryUrl(url)) return url;

        url = cloudinary.asImage(url);
        url = cloudinary.res(url, res);

        return url;
    },

    noTransform(url) {
        return url.replace(
            REDIRECT_RE,
            "https://res.cloudinary.com/$1/$2/upload/v"
        );
    },

    toWebmVideo(url: string) {
        if (!cloudinary.isCloudinaryUrl(url) || !url.endsWith(".mp4")) {
            return url;
        }

        return url.slice(0, url.length - 3) + "webm";
    },

    async redirect(url) {
        if (!cloudinary.isCloudinaryUrl(url)) {
            return url;
        }

        const response = await fetch(url, {
            method: "HEAD",
            mode: "cors",
        });

        if (response.ok) {
            return url;
        } else {
            return cloudinary.noTransform(url);
        }
    },
};

export const opensea = {
    isOldOpenSeaUrl(url) {
        return url.startsWith("https://storage.opensea.io/");
    },

    async redirect(url) {
        if (opensea.isOldOpenSeaUrl(url)) {
            return opensea.toNewUrl(url);
        }
        return url;
    },

    toNewUrl(url) {
        if (opensea.isOldOpenSeaUrl(url)) {
            return url.replace(
                "https://storage.opensea.io/",
                "https://openseauserdata.com/"
            );
        }
        return url;
    },
};

export const pinata = {
    isPinataUrl(url: string) {
        return url?.startsWith("https://cyber.mypinata.cloud/ipfs/");
    },

    res(url: string, width: number, height = width) {
        if (!pinata.isPinataUrl(url)) return url;

        let urlObj = new URL(url);

        // get search params & path
        let params = urlObj.searchParams;
        let path = urlObj.pathname;

        if (path.endsWith("/")) {
            path = path.slice(0, path.length - 1);
        }

        width = clamp(Math.floor(width), MIN_RES, MAX_RES);
        params.set("img-width", width.toString());

        if (height) {
            height = clamp(Math.floor(height), MIN_RES, MAX_RES);
            params.set("img-height", height.toString());
        }

        params.set("img-fit", "scale-down");

        return `${urlObj.origin}${path}?${params.toString()}`;
    },
};

const iseadn = {
    isIseadnUrl(url: string) {
        // Matches every seadn CDN host (i.seadn.io, i2c.seadn.io, …). OpenSea v2
        // now serves i2c.seadn.io; missing it meant those URLs were never
        // resized and loaded at seadn's 500×500 SQUARE default — which made
        // portrait NFTs render as squares.
        return /^https?:\/\/([a-z0-9-]+\.)*seadn\.io\//i.test(url || "");
    },

    // NOTE: no `height = width` default. seadn crops to a square when given
    // equal w & h, but preserves the true aspect ratio when given width only.
    // Single-arg `resize(url, size)` callers therefore get an aspect-correct
    // image (consistent with cloudinary's fl_keep_dar and pinata's scale-down).
    res(url: string, width: number, height?: number) {
        // https://i.seadn.io/s/raw/files/ccff6542a9a7be3d33373a553eee21d5.jpg?w=1024&auto=format

        if (!iseadn.isIseadnUrl(url)) return url;

        let urlObj = new URL(url);

        // get search params & path
        let params = urlObj.searchParams;
        let path = urlObj.pathname;

        if (path.endsWith("/")) {
            path = path.slice(0, path.length - 1);
        }

        width = clamp(Math.floor(width), MIN_RES, MAX_RES);

        params.set("w", width.toString());

        if (height) {
            height = clamp(Math.floor(height), MIN_RES, MAX_RES);
            params.set("h", height.toString());
        }
        // params.set("auto", "format");

        return `${urlObj.origin}${path}?${params.toString()}`;
    },
};

export function isUrlResizable(url: string) {
    if (!url) return false;
    return (
        cloudinary.isCloudinaryUrl(url) ||
        pinata.isPinataUrl(url) ||
        iseadn.isIseadnUrl(url)
    );
}

export function isSeadnUrl(url: string) {
    return iseadn.isIseadnUrl(url);
}

/**
 * A bounded derivative of `url` on hosts that resize; other URLs come back
 * unchanged. With `format`, hosts whose resize API can convert (Cloudinary,
 * `f_webp`) also convert; Pinata and seadn are asked for size only.
 */
export function resize(
    url: string,
    width: number,
    height?: number,
    format?: ImageFormat
) {
    if (!url) return url;
    if (cloudinary.isCloudinaryUrl(url)) {
        return cloudinary.res(url, width, height, format);
    } else if (pinata.isPinataUrl(url)) {
        return pinata.res(url, width, height);
    } else if (iseadn.isIseadnUrl(url)) {
        return iseadn.res(url, width, height);
    } else {
        return url;
    }
}

export function isRelay(url: string) {
    return url?.startsWith(nodeEnv.POLAR_SAMA);
}

export function relay(url: string) {
    // Query-based proxies must preserve the nested URL's query and fragment.
    return nodeEnv.POLAR_SAMA +
        (nodeEnv.POLAR_SAMA.includes("?url=") ? encodeURIComponent(url) : url);
}

export function fixCloudinaryBehindProxy(url: string) {
    //
    if (!isRelay(url)) return url;

    const original = url.slice(nodeEnv.POLAR_SAMA.length);
    if (!nodeEnv.POLAR_SAMA.includes("?url=")) return original;
    // Legacy proxy URLs stored their nested URL unencoded.
    if (!/^https?%3A%2F%2F/i.test(original)) return original;
    try { return decodeURIComponent(original); } catch { return original; }
}

export const removeQueryParam = (router, param) => {
    const { pathname, query } = router;

    const params = new URLSearchParams(query);

    params.delete(param);

    router.replace({ pathname, query: params.toString() }, undefined, {
        shallow: true,
    });
};

export function checkUrlResponse(url: string) {
    const headers = {
        Range: "bytes=0-399", // Modify this range if needed
    };

    return fetch(url, {
        headers: headers,
    })
        .then((response) => {
            return response.ok;
        })
        .catch((error) => {
            console.error("Fetch error:", error);
            return false;
        });
}
