import { NextApiRequest, NextApiResponse } from "next";
import { auth } from "../../../utils/middlewares/authMiddleware";
import { corsMiddleware } from "../../../utils/middlewares/corsMiddleware";
import {
    createDestination as firestoreCreate,
    updateDestination as firestoreUpdate,
    getDestinationById,
} from "@utils/firestore/destinations";

const createDestinationDoc = async (userId, payload) => {
    try {
        const data = {
            ...payload,
            userId,
            status: payload.status || "tested",
            tag: payload.tag || [],
        };
        const id = await firestoreCreate(data);
        const doc = await getDestinationById(id);
        return { success: true, data: doc };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

const updateDestinationDoc = async (id, payload) => {
    try {
        await firestoreUpdate(id, payload);
        const doc = await getDestinationById(id);
        return { success: true, data: doc };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

export default async (
    req: NextApiRequest,
    res: NextApiResponse
): Promise<void> => {
    await corsMiddleware(req, res);

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    if (req.body && typeof req.body === "string") {
        req.body = JSON.parse(req.body);
    }

    // decode token here, acts like a middleware
    let userId: string;
    try {
        userId = await auth(req);
    } catch (err) {
        return res.status(401).json({
            status: "error",
            message: "Sign in first.",
        });
    }

    console.log("load ..");

    const { payload, token, id } = req.body;

    // An edit rewrites the destination, author included, so it is for the
    // destination's owner only: the same check the destination procedures
    // make (assertOwnership in _v2/destinations/writeOperations).
    if (req.method === "PUT") {
        const destination = id ? await getDestinationById(id) : null;
        if (!destination || destination.userId !== userId) {
            return res.status(403).json({
                status: "error",
                message: "Not your destination.",
                destination: {},
            });
        }
    }

    const name = payload?.name;
    const paths = payload?.paths;
    const spline = payload?.spline;
    const quantity = payload?.quantity;
    const thumbnail = payload?.thumbnail;
    const email = payload?.author?.email;
    const openSeaUrl = payload?.openSeaUrl;
    const needReview = payload?.needReview;
    const description = payload?.description;
    const animationHash = payload?.animationHash;
    const distributionType = payload?.distributionType;

    if (req.method === "POST") {
        if (!name || name?.length < 1 || !paths || !thumbnail) {
            console.error("Error on form data", { payload });

            return res.status(400).json({
                status: "error",
                message: "invalid request data",
                ipfsHashMetadata: null,
                ipfsHashImage: null,
                signature: null,
            });
        }
    }

    payload.author.userId = userId;

    if (email) {
        payload.author.email = email;
    }

    let response = null;

    const body = JSON.stringify({
        name,
        thumbnail,
        params: payload.params,
        author: payload.author,
        ...(spline && { spline }),
        ...(needReview && { status: "tested" }),
        ...(quantity && { quantity }),
        ...(paths && { paths }),
        ...(openSeaUrl && { openSeaUrl }),
        slug: name.replace(/ /g, "").toLowerCase(),
        ...(description && { description }),
        ...(animationHash && { animationHash }),
        ...(distributionType && { distributionType }),
    });

    if (req.method === "POST") {
        response = await createDestinationDoc(userId, JSON.parse(body));
    } else if (req.method === "PUT") {
        response = await updateDestinationDoc(id, JSON.parse(body));
        console.log("response ", response);
    }

    if (response.success) {
        res.status(200).json({
            status: "success",
            destination: response?.data,
        });
    } else {
        console.error(response);
        res.status(400).json({
            status: "error",
            destination: {},
        });
    }
};
