import type { NextApiRequest, NextApiResponse } from "next";
import { llmsText } from "@features/docs/content";

/** Served at /llms.txt. */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
    const host = req.headers.host || "oncyber.io";
    const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(200).send(llmsText(`${local ? "http" : "https"}://${host}`));
}
