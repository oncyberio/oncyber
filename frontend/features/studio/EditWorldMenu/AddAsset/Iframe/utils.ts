//

import { nodeEnv } from "@env";

export const ERRORS = {
    BAD_URL: "BAD_URL",
    BLOCKED: "BLOCKED",
    NO_FOUND: "NOT_FOUND",
} as const;

export type FetchError = keyof typeof ERRORS;

export async function fetchIframeDoc(q: string) {
    //

    try {
        let urlObj = new URL(
            q.startsWith("http://") || q.startsWith("https://")
                ? q
                : "http://" + q
        );
    } catch (err) {
        //
        console.error(err);
        throw new Error(ERRORS.BAD_URL);
    }

    const params = new URLSearchParams();

    params.set("url", q);

    const { url, html, blocked, notFound } = await fetch(
        `${nodeEnv.PUBLIC_API}/api/proxy?${params}`
    ).then(function (response) {
        return response.json();
    });

    if (notFound) throw new Error(ERRORS.NO_FOUND);

    if (blocked) throw new Error(ERRORS.BLOCKED);

    const parser = new DOMParser();

    const doc = parser.parseFromString(html, "text/html");

    return formatWebsiteAsset(doc, url);
}

export async function formatWebsiteAsset(data: Document, url: string) {
    //
    return {
        name: data?.querySelector("title")?.innerHTML || url,
        description: url || "Website",
        token_id: `${url}`,
        mime_type: "embed/html/website",
        image_preview_url:
            // @ts-ignore
            data?.head?.querySelector("[property~=image][content]")?.content ||
            "https://cyber.mypinata.cloud/ipfs/QmaKJaq9fgYAJ3XgqkHDh9w4WQvEhBcZ1kmJ2Xjnvq7gMn?filename=PNG_4_ptzniu.png",
        image_url:
            // @ts-ignore
            data?.head?.querySelector("[property~=image][content]")?.content ||
            "https://cyber.mypinata.cloud/ipfs/QmeiBuhgVbvtohKDdwzXRXkGcaCZkFjLrRGNUb4nVF8qzn?filename=websiteDefaultIcon_d0k2bo.png",
        animation_url: url,
        blockchain: null,
        scale: 0.5,
        size: 600,
        dimensions: [1980 / 3, 1080 / 3],
        type: "website",
    };
}
