import type { NextApiRequest, NextApiResponse } from "next";
import { llmsFullText, llmsText } from "@features/docs/content";

/** Served at /llms.txt, and at /llms-full.txt with every page in full. */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
    const host = req.headers.host || "www.oncyber.com";
    const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    const origin = `${local ? "http" : "https"}://${host}`;
    res.status(200).send(
        req.query.full === "1" ? llmsFullText(origin) : llmsText(origin)
    );
}
