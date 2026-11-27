import type { NextApiRequest, NextApiResponse } from "next";
import { verify } from "@utils/middlewares/authMiddleware";
import {
    UPLOAD_ID,
    mayPublish,
    publishingEnabled,
} from "@features/games/publish/publishedGames";
import { acceptUploadedFile } from "@features/games/publish/publishedGamesServer";

/**
 * Upload mode `site` of publishing from outside the repository
 * (docs/games/publishing.md): `PUT /api/games/uploads/<uploadId>/<path>`
 * with one file of the release as the body.
 *
 * The session token comes in the Authorization header only, never from a
 * cookie, so a page cannot make a visitor's browser upload. The body is
 * streamed to disk, never parsed or held whole. What is taken, and where
 * it goes, is decided by what `begin` recorded for this upload: see
 * `acceptUploadedFile`.
 */
export const config = { api: { bodyParser: false } };

function answer(res: NextApiResponse, status: number, body: object) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(status).json(body);
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (!publishingEnabled()) return res.status(404).end();
    if (req.method !== "PUT") {
        res.setHeader("Allow", "PUT");
        return res.status(405).end();
    }
    const header = req.headers.authorization;
    const token =
        typeof header === "string" && header.startsWith("Bearer ")
            ? header.slice(7)
            : "";
    const owner = token
        ? await verify(token).catch(() => null as string | null)
        : null;
    if (!owner || typeof owner !== "string")
        return answer(res, 401, { error: "Sign in to upload." });
    if (!mayPublish(owner))
        return answer(res, 403, {
            error: "This account may not publish games on this site.",
        });
    const [uploadId, ...rest] = ([] as string[]).concat(req.query.path ?? []);
    if (!UPLOAD_ID.test(uploadId ?? "") || !rest.length)
        return answer(res, 404, { error: "No such upload." });
    const sent = req.headers["content-length"];
    const result = await acceptUploadedFile({
        owner,
        uploadId,
        path: rest.join("/"),
        body: req,
        length:
            typeof sent === "string" && /^[0-9]{1,12}$/.test(sent)
                ? Number(sent)
                : null,
    });
    if (result.status === 200) {
        const { status, ...file } = result;
        return answer(res, status, file);
    }
    // A refused body may still be arriving: stop reading it.
    res.setHeader("Connection", "close");
    return answer(res, result.status, { error: result.error });
}
