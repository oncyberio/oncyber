import { db } from "@utils/firebaseAdmin";
import Data from "@3gl/modules/cinematic/data.json";
import { formatCinematic, parseCinematic } from "@utils/formatCinematic";
import { corsMiddleware } from "@utils/middlewares/corsMiddleware";
import { parse } from "path";
import { doc } from "prettier";

export async function getCinematic(opts: { slug?: string; id?: string }) {
    //

    let doc;

    try {
        if (opts?.id) {
            doc = await db.collection("cinematic").doc(opts?.id).get();
        }

        if (!doc?.exists && opts?.slug) {
            //
            doc = await db
                .collection("cinematic")
                .doc(opts?.slug.replace("_v2", ""))
                .get();
        }

        if (!doc?.exists) return null;

        return parseCinematic(doc.data());
    } catch (error) {
        console.error(error);
        return null;
    }
}

export default async (req, res) => {
    //
    await corsMiddleware(req, res);

    let cinematic = await getCinematic(req.query);

    if (cinematic == null) {
        return res.json({
            success: false,
            cinematic: {},
        });
    }

    return res.json({
        success: true,
        cinematic,
    });
};
