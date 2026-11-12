import { db } from "../../../utils/firebaseAdmin";
import { corsMiddleware } from "../../../utils/middlewares/corsMiddleware";
import { publicUserProfile } from "../../../utils/firestore/userProfiles";

export async function getProfile(batch, loadNumOfSpaces = false) {
    batch = batch.map((walletId) => walletId.toLowerCase());

    const snapshot = await db
        .collection("users")
        .where("walletId", "in", batch)
        .get();

    if (snapshot.empty) {
        return null;
    }

    const profiles = {};

    await Promise.all(
        snapshot.docs.map(async (doc) => {
            // Anyone may call this: the public shape, without e-mails.
            profiles[doc.id] = publicUserProfile({
                id: doc.id,
                ...doc.data(),
            });

            if (loadNumOfSpaces) {
                const spaces = await db
                    .collection("users")
                    .doc(doc.id)
                    .collection("exhibits")
                    .get();

                const createdSpaces = await Promise.all(
                    spaces.docs.map(async (doc) => {
                        const data = doc.data();

                        if (!data.invited) {
                            // this is too heavy, especially for 6529
                            const exhibitDoc = await db
                                .collection("exhibits")
                                .doc(doc.id)
                                .get();

                            const exhibit = exhibitDoc.data();

                            if (
                                exhibit?.info?.headline &&
                                (exhibit?.info?.cHeroImg ||
                                    exhibit?.info?.fHeroImg ||
                                    exhibit?.info?.heroImg)
                            ) {
                                return true;
                            }

                            return null;
                        }
                        return null;
                    })
                );

                profiles[doc.id].numOfSpaces = createdSpaces.filter(
                    (doc) => doc
                ).length;
            }
        })
    );

    return profiles;
}

export async function getProfiles(editorIds = [], loadNumOfSpaces = false) {
    let editors = {};

    const batches = [];

    for (let i = 0; i < Math.ceil(editorIds.length / 10); i++) {
        batches.push(editorIds.slice(i * 10, i * 10 + 10));
    }

    await Promise.all(
        batches.map(async (batch) => {
            const profiles = await getProfile(batch, loadNumOfSpaces);

            if (!profiles) {
                return;
            }

            editors = {
                ...editors,
                ...profiles,
            };
        })
    );

    return editors;
}

export default async (req, res) => {
    try {
        await corsMiddleware(req, res);

        if (req.body.loadNumOfSpaces) {
            res.setHeader(
                "Cache-Control",
                "public, s-maxage=3600, stale-while-revalidate=30"
            );
        }

        res.status(200).json({
            success: true,
            editors: await getProfiles(
                req.body?.editorIds || [],
                req.body?.loadNumOfSpaces
            ),
        });
    } catch (err) {
        console.log("err", err);
        res.status(400).json({
            success: false,
        });
    }
};
