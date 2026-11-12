import { db } from "@utils/firebaseAdmin";
import { auth } from "@utils/middlewares/authMiddleware";
import { corsMiddleware } from "@utils/middlewares/corsMiddleware";
import shortid from "shortid";

export default async (req, res) => {
    //

    // if (process.env.NODE_ENV !== "development")
    return res.status(400).json({
        success: false,
    });

    await corsMiddleware(req, res);

    try {
        var userId = await auth(req);

        const { spaceId } = req.body;

        // check first if exhibit

        if (!spaceId)
            return res.status(400).json({
                success: false,
                message: "You need to provide an exhibit id",
            });

        // fetch document to duplicate
        const doc = await db.collection("exhibits").doc(spaceId).get();

        if (!doc.exists) {
            return {
                success: false,
                message: "Exhibit doesn't exist.",
            };
        }

        const exhibit = doc.data();

        exhibit.info.headline = `${
            exhibit?.info?.headline?.split?.(" Duplicate")?.[0] || ""
        } Duplicate-${shortid.generate()}`;

        // we shouldn't duplicate custom link
        exhibit.info.customLink = "";

        exhibit.number_of_visits = 0;

        exhibit.createdAt = new Date();

        exhibit.owner = userId;

        exhibit.editors = [userId]; // comment this line in case we want to duplicate the editors too

        const batch = db.batch();

        const exhibitRef = db.collection("exhibits").doc();

        batch.create(exhibitRef, exhibit);

        batch.set(
            db
                .collection("users")
                .doc(userId)
                .collection("exhibits")
                .doc(exhibitRef.id),
            {
                id: exhibitRef.id,
            }
        );

        await batch.commit();

        exhibit.id = exhibitRef.id;

        return res.status(200).json({
            success: true,
            spaceId: exhibitRef.id,
            exhibit,
        });
        //
    } catch (err) {
        res.status(401).json({
            success: false,
            message: "You need to login first.",
        });
    }
};
