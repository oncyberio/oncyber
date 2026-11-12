import { firestore } from "firebase-admin";
import algoliarecommend, { RecommendSearchOptions, TrendingItemsQuery } from '@algolia/recommend';
import { auth } from "../../../utils/middlewares/authMiddleware";
import { db, fire } from "../../../utils/firebaseAdmin";
import { getContentByIds } from "../../../utils/getContentByIds";
import { Experience } from "../../../@types/experience";
import { corsMiddleware } from "../../../utils/middlewares/corsMiddleware";
import uniqBy from "lodash/uniqBy";
import omit from "lodash/omit";
import scaleData from "@utils/metadata/scaleData.json";
import { formatExhibit, formatUpdate } from "@utils/metadata/formatExhibit";
import { deepClone } from "@utils/js";
import { getSlug, pathToSlug } from "@utils/saveToDb";

const client = algoliarecommend("6BQRQVD9VW", process.env.ALGOLIA_KEY);

function formatExhibitData(it: Experience) {
    it.createdAt =
        (it?.createdAt as any)?.toDate?.()?.toISOString?.() ||
        new Date()?.toISOString?.();
}

export async function getExhibitsByIds(ids): Promise<Experience[]> {
    // const exhibits = [];
    // const snapshot = await db
    //     .collection("exhibits")
    //     .where(firestore.FieldPath.documentId(), "in", ids)
    //     .get();
    // console.log("SNAPSHOT");
    // console.log(snapshot);
    // snapshot.forEach((doc) => {
    //     console.log(doc.data());
    //     exhibits.push({
    //         id: doc.id,
    //         ...doc.data(),
    //     });
    // });
    const exhibits = await getContentByIds(
        "exhibits",
        firestore.FieldPath.documentId(),
        ids
    );

    exhibits.forEach(formatExhibitData);

    return exhibits;
}

export const getExhibitById = async (id: string): Promise<Experience> => {
    const doc = await db.collection("exhibits").doc(id).get();

    const exhibit = doc.data() as Experience;

    formatExhibitData(exhibit);

    return {
        id: doc.id,
        ...exhibit,
    };
};

const getRadUserExhibits = async (walletId: string, lastVisible: string) => {
    let exhibits = [];
    let snapshot;

    if (lastVisible !== undefined) {
        const last = await db.collection("exhibits").doc(lastVisible).get();
        snapshot = await db
            .collection("exhibits")
            .where("owner", "==", walletId)
            .startAfter(last)
            .limit(50)
            .get();
    } else {
        snapshot = await db
            .collection("exhibits")
            .where("owner", "==", walletId)
            .limit(30)
            .get();
    }

    snapshot.forEach((doc) => {
        const data = omit(doc.data(), ["artworks"]);
        exhibits.push({ id: doc.id, ...data });
    });

    return exhibits;
};

/**
 * Search exhibit by user and space using agolia search.
 *
 * @function
 * @param {string} search
 * @param {boolean} collection
 * @returns {void}
 */
const recommendExhibits = async (
    page: number = 0
): Promise<any> => {
    try {
        const hitsPerPage = 40;
        const searchSettings: TrendingItemsQuery = { page, hitsPerPage };
        // search owner and headline exhibts

        const recommendations: any = await client
        .getTrendingItems([
            {
                indexName: 'experiences',
                // queryParameters: searchSettings
            },
        ])

        console.log("RECOMMENDATIONS")
        console.log(recommendations)

        // const exhibits = await Promise.all(
        //     recommendations.map(async ({ objectID }) => {
        //         const snapshot = await db
        //             .collection("exhibits")
        //             .doc(objectID)
        //             .get();
        //         const data = omit(snapshot.data(), ["artworks"]);
        //         return {
        //             id: snapshot.id,
        //             ...data,
        //         };
        //     })
        // );


        return [];

    } catch (error) {
        // error
        console.error(error);
    }
};


export default async (req, res) => {
    await corsMiddleware(req, res);

    // We need to check first if user logged in and if he is an editor of the exhibit before he can update...

    try {
        if (req.body && typeof req.body === "string") {
            req.body = JSON.parse(req.body);
        }

        recommendExhibits(0);
        return res
            .status(200)
            .json({ success: true, exhibits: []});

    } catch (err) {
        console.error(err);
        return res
            .status(400)
            .json({ success: false, message: "Failed to execute operation." });
    }
};
