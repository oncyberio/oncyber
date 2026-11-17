import type { NextApiRequest, NextApiResponse } from "next";
import { firestore } from "firebase-admin";
import { db } from "@utils/firebaseAdmin";
import { allDocs } from "@features/docs/content";
import { SITE_ORIGIN } from "@utils/siteUrl";
import {
    SITEMAP_CACHE_CONTROL,
    SITEMAP_MAX_URLS,
    SITEMAP_SPACE_FIELDS,
    SitemapEntry,
    shardRange,
    spaceSitemapEntry,
    urlsetXml,
} from "@utils/sitemap";

/** Site pages worth a search engine's visit (everything else is a space). */
const SITE_PAGES = ["/", "/discover", "/about"];

function pageEntries(origin: string): SitemapEntry[] {
    const docs = allDocs().map((doc) =>
        doc.slug ? `/docs/${doc.slug}` : "/docs"
    );
    return [...SITE_PAGES, ...docs].map((path) => ({ loc: origin + path }));
}

const PAGE_SIZE = 2000;

/** The listed spaces whose ids fall in one part's range. */
export async function spaceEntries(
    key: string,
    origin: string,
    store = db
): Promise<SitemapEntry[] | null> {
    const range = shardRange(key);
    if (!range) return null;
    const entries: SitemapEntry[] = [];
    const id = firestore.FieldPath.documentId();
    let last: string | null = null;
    for (;;) {
        let query = store
            .collection("exhibits")
            .select(...SITEMAP_SPACE_FIELDS)
            .orderBy(id);
        if (last) query = query.startAfter(last);
        else if (range.start) query = query.startAt(range.start);
        if (range.end) query = query.endBefore(range.end);
        const page = await query.limit(PAGE_SIZE).get();
        for (const doc of page.docs) {
            const entry = spaceSitemapEntry(doc.id, doc.data(), origin);
            if (entry) entries.push(entry);
        }
        if (page.docs.length < PAGE_SIZE || entries.length >= SITEMAP_MAX_URLS)
            return entries;
        last = page.docs[page.docs.length - 1].id;
    }
}

/** Served at /sitemaps/<name>.xml: "pages", or "spaces-<first id character>". */
export default async function sitemapPart(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const name = String(req.query.name || "").replace(/\.xml$/, "");
    let entries: SitemapEntry[] | null = null;
    try {
        if (name === "pages") entries = pageEntries(SITE_ORIGIN);
        else if (name.startsWith("spaces-"))
            entries = await spaceEntries(
                name.slice("spaces-".length),
                SITE_ORIGIN
            );
    } catch (error) {
        console.error("[sitemap]", name, error);
        // Crawlers come back later; an empty list would drop every space.
        res.setHeader("Retry-After", "3600");
        return res.status(503).end();
    }
    if (!entries) return res.status(404).end();
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", SITEMAP_CACHE_CONTROL);
    res.status(200).send(urlsetXml(entries));
}
