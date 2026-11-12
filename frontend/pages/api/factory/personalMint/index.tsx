import { Wallet } from "@ethersproject/wallet";
import { signMintRequest } from "@utils/factory/sign";
import { NextApiRequest, NextApiResponse } from "next";
import { auth } from "@utils/middlewares/authMiddleware";
import { corsMiddleware } from "@utils/middlewares/corsMiddleware";
import { getDestination } from "@utils/saveToDb";

import config from "../../../../config";

export default async (req: NextApiRequest, res: NextApiResponse) => {
    await corsMiddleware(req, res);

    if (req.body && typeof req.body === "string") {
        req.body = JSON.parse(req.body);
    }

    const sender: string =
        process.env.NODE_ENV == "test" ? req.body.walletId : await auth(req);

    const { slug, type } = req?.body;

    const destination = await getDestination(slug, null, true);

    console.info("invalid request data", {
        type,
        destination,
    });

    const tokenId = type === "estimateGas" ? 0 : destination?.token_id;

    if (!destination?.author?.userId) {
        console.error("invalid request data", {
            author: destination?.author,
        });
        return res.status(400).json({
            status: "error",
            message: "invalid request data",
        });
    }

    console.log("tokenId", tokenId);

    if (destination?.author?.userId !== sender) {
        return res.json({
            status: 405,
            msg: "Not allowed",
        });
    }

    const conf = config[destination.contractName];

    const signer = new Wallet(
        conf.manager
    );

    const sig: string = await signMintRequest(
        tokenId,
        1,
        destination?.author?.userId,
        0,
        signer
    );

    return res.status(200).json({ sig });
};
