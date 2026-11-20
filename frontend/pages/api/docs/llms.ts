import type { NextApiRequest, NextApiResponse } from "next";
import { FeaturedSpace, llmsFullText, llmsText } from "@features/docs/content";
import { readLandingFeed } from "@utils/serverside/landingServerSideProps";

/** The spaces the landing features, or none when they can't be read. */
async function featuredSpaces(): Promise<FeaturedSpace[]> {
    try {
        const feed = await readLandingFeed("staff");
        return feed.cards
            .filter((card) => !card.section)
            .slice(0, 20)
            .map(({ title, href, creator, description }) => ({
                title,
                href,
                creator,
                description,
            }));
    } catch {
        return [];
    }
}

/** Served at /llms.txt, and at /llms-full.txt with every page in full. */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const host = req.headers.host || "www.oncyber.com";
    const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
    const origin = `${local ? "http" : "https"}://${host}`;
    const full = req.query.full === "1";
    const text = full
        ? llmsFullText(origin)
        : llmsText(origin, await featuredSpaces());
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    // The featured spaces are read from the database: once an hour at the
    // CDN is plenty.
    res.setHeader(
        "Cache-Control",
        "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
    );
    res.status(200).send(text);
}
