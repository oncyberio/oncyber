import { z } from "zod";

import { proc, NoApi } from "@utils/rpc/server";

import * as cheerio from "cheerio";

import { publicFetch } from "@utils/net/publicFetch";

const isValid = (path) =>
    path && (path.startsWith("http") || path.startsWith("https"));

// Prefix the site host to the relative favicon paths
const createValidUri = (host, path) => {
    if (!path) return path;

    if (isValid(path)) return path;

    const updatedPath = path.replace("/", "");
    return `${host}${updatedPath}`;
};

export const getMetadata = proc({
    cors: true,
    auth: false,

    // schema
    schema: z.object({
        url: z.string(),
    }),

    // handler
    async handler(opts) {
        const urlString = opts.url.trim();

        const response = await publicFetch(urlString, {
            maxBytes: 2 * 1024 * 1024,
            accept: "text/html,*/*",
        });

        const content = response.body.toString("utf8");

        const $ = cheerio.load(content);

        const head = $("head");

        const website = response.url;

        const title =
            head.find("title").text() ||
            head.find('meta[property="og:title"]').attr("content") ||
            head.find('meta[name="twitter:title"]').attr("content") ||
            head.find('meta[property="twitter:title"]').attr("content");

        const icon =
            head.find('link[rel="icon"]').attr("href") ||
            head.find('link[rel="apple-touch-icon"]').attr("href") ||
            head
                .find('link[rel="apple-touch-icon-precomposed"]')
                .attr("href") ||
            head.find('link[rel="icon" i]').attr("href");

        const description =
            head.find("meta[name=description]").attr("content") ||
            head.find('meta[property="og:title"]').attr("content") ||
            head.find('meta[property="twitter:title"]').attr("content");

        const banner =
            head.find('meta[name="og:image"]').attr("content") ||
            head.find('meta[property="og:image"]').attr("content") ||
            head.find('meta[name="twitter:image"]').attr("content") ||
            head.find('meta[property="twitter:image"]').attr("content") ||
            head.find('meta[property="og:image:secure_url"]').attr("content") ||
            head.find('meta[property="og:image:url"]').attr("content") ||
            head.find('meta[name="thumbnail"]').attr("content");

        const themeColor = head
            .find('meta[name="theme-color"]')
            .attr("content");

        return {
            website,
            title,
            description,
            banner,
            themeColor,
            icon: createValidUri(website, icon),
        };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
