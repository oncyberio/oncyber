import type { NextApiRequest, NextApiResponse } from "next";
import { SITE_ORIGIN } from "@utils/siteUrl";
import {
    SITEMAP_CACHE_CONTROL,
    sitemapIndexXml,
    sitemapParts,
} from "@utils/sitemap";

/** Served at /sitemap.xml (next.config.js rewrites): the list of sitemap parts. */
export default function sitemapIndex(
    _req: NextApiRequest,
    res: NextApiResponse
) {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", SITEMAP_CACHE_CONTROL);
    res.status(200).send(sitemapIndexXml(sitemapParts(SITE_ORIGIN)));
}
