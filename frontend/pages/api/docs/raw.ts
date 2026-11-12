import type { NextApiRequest, NextApiResponse } from "next";
import { allDocs } from "@features/docs/content";

/** Served at /docs.md and /docs/<page>.md. */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
    const slug = typeof req.query.slug === "string" ? req.query.slug : "";
    const doc = allDocs().find((entry) => entry.slug === slug);
    if (!doc) {
        res.status(404).send("Not found");
        return;
    }
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(200).send(doc.body);
}
