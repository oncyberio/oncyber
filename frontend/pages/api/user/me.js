import { auth } from "../../../utils/middlewares/authMiddleware";
import { db } from "../../../utils/firebaseAdmin";

import { corsMiddleware } from "../../../utils/middlewares/corsMiddleware";
import {
    getUserProfileByWalletId,
    publicUserProfile,
} from "../../../utils/firestore/userProfiles";
import { stripSecretsFromJson } from "../../../utils/worldPassword/publicGating";

export default async (req, res) => {
    // console.log("coookies", req.cookies);

    await corsMiddleware(req, res);

    // `exhibit` below is the stored document: no world password in it.
    stripSecretsFromJson(res);

    if (!req.query.id && !req.query.username && !req.query.walletId)
        return res.status(400).json({
            success: false,
            message: "Failed to execute operation.",
        });

    // Public profile lookup — the response varies only by query params (no auth,
    // no cookies), so let the CDN absorb repeat reads of the same profile (e.g.
    // every visitor of a space loading its owner's profile). A fixed CORS header
    // (instead of the per-origin corsMiddleware value above) keeps the response
    // cache-key-stable, same approach as /api/destinations/active.
    res.setHeader("Access-Control-Allow-Origin", "*");
    // Display-only profile data: let the CDN hold it for an hour (404s for
    // profile-less wallets are cacheable too, which is what absorbs scraper
    // probes of the same wallet — the origin can't go below 1 read/execution).
    res.setHeader(
        "Cache-Control",
        "public, s-maxage=3600, stale-while-revalidate=86400"
    );

    let walletId = req.query.walletId;

    // Every answer below is public and CDN-cached, so it carries the public
    // shape of the profile: no e-mail addresses.

    // if (req.cookies.token || req.body.token) {
    //   walletId = await auth(req);
    // }

    if (walletId) {
        let slug = walletId.toLowerCase();

        if (walletId[0] == "@") slug = slug.substr(1);

        // Shared walletId->profile cache instead of a live
        // `walletId == ? limit 1` query per call.
        let user = publicUserProfile(await getUserProfileByWalletId(slug));

        if (!user) {
            // Legacy fallback: a few old docs are keyed by a lowercase id but
            // have no matching `walletId` field, so the cache can't see them.
            const snapshot = await db.collection("users").doc(slug).get();

            if (snapshot.exists) {
                return res.status(200).json({
                    success: true,
                    user: publicUserProfile({
                        ...snapshot.data(),
                        id: snapshot.id,
                    }),
                });
            }

            return res.status(404).json({
                success: false,
                message: "Profile not found.",
            });
        }

        if (req.query.all === "true") {
            const userExhibitsSnapshot = await db
                .collection("users")
                .doc(user.id)
                .collection("exhibits")
                .get();

            const exhibitIds = [];

            userExhibitsSnapshot.forEach((doc) => {
                exhibitIds.push({
                    id: doc.id,
                    ...doc.data(),
                });
            });

            if (user.currentExhibitId) {
                var exhibitDoc = await db
                    .collection("exhibits")
                    .doc(user.currentExhibitId)
                    .get();
            }

            return res.status(200).json({
                success: true,
                user: { ...user, exhibitIds },
                exhibit:
                    exhibitDoc && exhibitDoc.exists
                        ? {
                              id: exhibitDoc.id,
                              ...exhibitDoc.data(),
                          }
                        : {},
            });
        }

        return res.status(200).json({
            success: true,
            user,
        });
    }

    if (req.query.username) {
        let slug = req.query.username;

        if (slug[0] == "@") slug = slug.substr(1);

        const snapshot = await db
            .collection("users")
            .where("username", "==", slug)
            .limit(1)
            .get();

        if (snapshot.empty)
            return res.status(404).json({
                success: false,
                message: "Profile not found.",
            });

        return res.status(200).json({
            success: true,
            user: publicUserProfile({
                ...snapshot.docs[0].data(),
                ...{ id: snapshot.docs[0].id },
            }),
        });
    }

    const user = publicUserProfile(
        await getUserProfileByWalletId(req.query.id.toLowerCase())
    );

    if (!user) {
        return res.status(404).json({
            success: false,
            message: "Profile not found.",
        });
    }

    const userExhibitsSnapshot = await db
        .collection("users")
        .doc(user.id)
        .collection("exhibits")
        .get();

    const exhibitIds = [];

    userExhibitsSnapshot.forEach((doc) => {
        exhibitIds.push({
            id: doc.id,
            ...doc.data(),
        });
    });

    console.log("IT WORKED WITH ALL IDS");

    res.status(200).json({
        success: true,
        exhibitIds,
        ...user,
    });
};

// export default async (req, res) => {
//     try {
//         const { token } = JSON.parse(req.headers.authorization || {});
//         if (!token) {
//             return res.status(403).json({
//                 success: false,
//                 message: "Auth token missing."
//             })
//         }

//         const result = await validate(token);
//         return res.status(200).json(result);
//     } catch (err) {
//         console.log(err);
//         return res.status(400).json({
//             success: false,
//             message: "Error happen when authenticating."
//         })
//     }
// }
