import crypto from "crypto";
import { checkGatingRules } from "@utils/checkGatingRules";
import { auth } from "@utils/middlewares/authMiddleware";
import { corsMiddleware } from "@utils/middlewares/corsMiddleware";
import { NextApiRequest, NextApiResponse } from "next";
import { getExhibitByCustomLink } from "../exhibit";
import { serialize } from "@utils/js";
import { db } from "@utils/firebaseAdmin";
import { getUserByDoc } from "@api/accounts/user/utils";

function singleParam(p: string | string[]) {
    if (Array.isArray(p)) return p[0];
    return p;
}

function generateCheckum(obj: any) {
    const hasher = crypto.createHash("SHA256");
    const str = serialize(obj);
    let data = new TextEncoder().encode(str).map((n) => ~n);
    return hasher.update(data).digest("hex");
}

function checksum(obj, ts: number) {
    const cs = generateCheckum({ ...obj, __kh__: ~ts });
    return {
        _s: "0x" + cs + ts,
        _v: obj,
    };
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
    let walletId = singleParam(req.query.walletId);

    let spaceId = singleParam(req.query.spaceId);

    let onlyCheckCap = singleParam(req.query.cap);

    let ts = +singleParam(req.query.ts);

    let nbPlayers = +singleParam(req.query.nbPlayers);

    try {
        if (!isFinite(nbPlayers) || !isFinite(ts)) {
            return res.status(400).json(
                checksum(
                    {
                        success: false,
                        error: "Invalid number [nbPlayers]",
                    },
                    ts
                )
            );
        }

        await corsMiddleware(req, res);

        let exhibit = await getExhibitByCustomLink(spaceId);

        if (exhibit == null) {
            return res.status(500).json(
                checksum(
                    {
                        success: false,
                        error: "Failed to get exhibit data for " + spaceId,
                    },
                    ts
                )
            );
        }

        if (!exhibit.gating) return res.json(checksum({ success: true }, ts));

        let userId;

        try {
            userId = await auth(req);
        } catch (err) {
            userId = null;
        }

        // Skip gating test for editors
        if (
            exhibit.editors.some(
                (it) => it.toLowerCase() === userId?.toLowerCase()
            )
        ) {
            return res.json(
                checksum({ success: true, result: { type: "success" } }, ts)
            );
        }

        const { roomCapacity, ...rest } = exhibit.gating;

        let gating = onlyCheckCap ? { roomCapacity } : rest;

        // let userId = walletId;
        const userSnap = await db
            .collection("users")
            .where("walletId", "==", userId.toLowerCase())
            .get();

        if (userSnap.empty) {
            return { type: "other-error", error: "user not found" };
        }

        const userDoc = userSnap.docs[0];

        const user = await getUserByDoc(userDoc);

        const result = await checkGatingRules(gating, user, nbPlayers);

        return res.json(
            checksum(
                {
                    success: true,
                    result,
                },
                ts
            )
        );
    } catch (err) {
        console.error(err);
        return res.status(500).json(
            checksum(
                {
                    success: false,
                    error: err?.message || "Gating Server error",
                },
                ts
            )
        );
    }
};
