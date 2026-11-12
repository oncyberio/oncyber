import { db } from "@utils/firebaseAdmin";
import { auth } from "@utils/middlewares/authMiddleware";
import { corsMiddleware } from "@utils/middlewares/corsMiddleware";
import shortid from "shortid";
import { stripSecretsFromJson } from "@utils/worldPassword/publicGating";
import { copyWorldPassword, secretRef } from "@utils/worldPassword/server";

export default async (req, res) => {
    await corsMiddleware(req, res);

    stripSecretsFromJson(res);

    try {
        var userId = await auth(req);

        const { spaceId } = req.body;

        // check first if exhibit

        if (!spaceId)
            return res.status(400).json({
                success: false,
                message: "You need to provide an exhibit id",
            });

        const transaction = await db.runTransaction(async (transaction) => {
            // fetch document to duplicate
            const ref = await db.collection("exhibits").doc(spaceId);

            const doc = await transaction.get(ref);

            if (!doc.exists) {
                return {
                    success: false,
                    message: "Exhibit doesn't exist.",
                };
            }

            const exhibit = doc.data();

            // check if duplicate is made by the owner
            if (exhibit.owner.toLowerCase() !== userId.toLowerCase())
                return {
                    success: false,
                    message: "You don't own this exhibit.",
                };

            exhibit.info.headline = `${
                exhibit?.info?.headline?.split?.(" Duplicate")?.[0] || ""
            } Duplicate-${shortid.generate()}`;

            // we shouldn't duplicate custom link
            exhibit.info.customLink = "";

            exhibit.number_of_visits = 0;

            exhibit.createdAt = new Date();

            exhibit.editors = [exhibit.owner]; // comment this line in case we want to duplicate the editors too

            // we make sure that the editor is indeed an editor of the space
            const editors = await Promise.all(
                exhibit.editors.map(async (editor) => {
                    const editorRef = db
                        .collection("users")
                        .doc(editor)
                        .collection("exhibits")
                        .doc(spaceId);

                    const editorDoc = await transaction.get(editorRef);

                    if (editorDoc.exists) {
                        return {
                            id: editor,
                            editor: editorDoc.data(),
                        };
                    } else {
                        return {};
                    }
                })
            );

            // we create a new exhibit with the duplicated data
            const newExhibitRef = db.collection("exhibits").doc();

            // The copy keeps the world's password, hashed, under its own
            // revision.
            const password = await copyWorldPassword(spaceId);

            if (password) {
                exhibit.gating = {
                    ...exhibit.gating,
                    password: password.password,
                };
                if (password.secret)
                    transaction.set(
                        secretRef(newExhibitRef.id),
                        password.secret
                    );
            }

            await transaction.create(newExhibitRef, exhibit);

            // add the exhibit to the editors
            await Promise.all(
                editors.map(async ({ id, editor }) => {
                    if (id) {
                        const userExhibitRef = db
                            .collection("users")
                            .doc(id) // userId
                            .collection("exhibits")
                            .doc(newExhibitRef.id);

                        // id of the space needs to be the new one
                        editor.id = newExhibitRef.id;

                        await transaction.set(userExhibitRef, editor);
                    }
                })
            );

            return {
                success: true,
                spaceId: newExhibitRef.id,
                exhibit: {
                    ...exhibit,
                    id: newExhibitRef.id,
                },
            };
        });

        if (!transaction.success) {
            return res.status(400).json({
                success: false,
                message: transaction.message,
            });
        }

        return res.status(200).json({
            success: true,
            spaceId: transaction.spaceId,
            exhibit: transaction.exhibit,
        });
    } catch (err) {
        res.status(401).json({
            success: false,
            message: "You need to login first.",
        });
    }
};
