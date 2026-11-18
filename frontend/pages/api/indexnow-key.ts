import type { NextApiRequest, NextApiResponse } from "next";
import { indexNowKey } from "@utils/indexNow";

/** Served at /indexnow-key.txt: proof that IndexNow notices come from this site. */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
    const key = indexNowKey();
    if (!key) {
        res.status(404).send("Not found");
        return;
    }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.status(200).send(key);
}
