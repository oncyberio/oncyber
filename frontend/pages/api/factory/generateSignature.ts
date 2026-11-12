import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import config from "../../../config";
import { Wallet } from "@ethersproject/wallet";
import Pinata from "../../../utils/factory/pinata";

import { NextApiRequest, NextApiResponse } from "next";
import { getDestinationById } from "../../../utils/saveToDb";
import { auth } from "../../../utils/middlewares/authMiddleware";
import { getAddressCatch } from "../../../utils/factory/address";
import { signCreateDropRequest } from "../../../utils/factory/sign";
import { isDestinationOwner } from "../../../utils/firestore/destinationOwner";
import { corsMiddleware } from "../../../utils/middlewares/corsMiddleware";

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

    const userId = await auth(req);

    const { payload } = req.body;

    const address = getAddressCatch(userId);

    const { destinationId, _id } = payload;

    const destination = await getDestinationById(destinationId);

    const {
        name,
        status,
        token_id,
        description,
        thumbHash,
        destHash,
        quantity,
        price,
        contractName,
        startTime,
        endTime,
        animationHash,
        distributionType,
    } = destination?.data || {};

    // Only the destination's owner may become the drop's creator.
    if (
        status !== "verified" ||
        !isDestinationOwner(destination?.data, userId)
    ) {
        console.error("Was not verified", { payload });
        return res.status(400).json({
            status: "error",
            message: "Destination was not verified or not correct user",
            ipfsHashMetadata: null,
            ipfsHashImage: null,
            signature: null,
        });
    }

    // double check on token_id
    if (token_id) {
        console.error("destination has token_id", { payload });
        return res.status(405).json({
            status: "error",
            message: "Destination has already token id",
            ipfsHashMetadata: null,
            ipfsHashImage: null,
            signature: null,
        });
    }

    console.log("IT IS VERIFIED AT LEAST");

    if (
        !contractName ||
        !address ||
        !name ||
        name.length < 1 ||
        !description ||
        !price ||
        !quantity ||
        !startTime ||
        !endTime ||
        !destHash
    ) {
        console.log("Error on form data", {
            contractName,
            address,
            name,
            description,
            thumbHash,
            destHash,
        });

        return res.status(400).json({
            status: "error",
            message: "invalid request data",
            ipfsHashMetadata: null,
            ipfsHashImage: null,
            signature: null,
        });
    }

    // should take out and fetch contractName from DB instead
    if (
        contractName != "oncyber-ethereum-community" &&
        contractName != "factory-polygon"
    ) {
        console.log("Tried to mint on another contract", {
            contractName,
            address,
            name,
            description,
            thumbHash,
            destHash,
        });

        return res.status(400).json({
            status: "error",
            message: "tried to mint on another contract",
            ipfsHashMetadata: null,
            ipfsHashImage: null,
            signature: null,
        });
    }

    const signer = new Wallet(config[contractName].manager);

    // set in dashboard
    const amount =
        !isNaN(quantity) &&
        !isNaN(parseInt(quantity)) &&
        parseInt(quantity).toString() === quantity.toString() &&
        parseInt(quantity);

    // // set in dashboard
    const shareCyber = parseInt(destination?.shareCyber || 50);

    // // nonce set in frontend
    const nonce =
        !isNaN(payload.nonce) &&
        !isNaN(parseInt(payload.nonce)) &&
        parseInt(payload.nonce);

    const ipfsHashMetadata = await Pinata.uploadMetadata(
        thumbHash || "",
        animationHash || "",
        destHash,
        address,
        name,
        description
    );

    console.info("start processing", { address });

    const priceParse = parseEther(price.toString());

    const signature = await signCreateDropRequest(
        ipfsHashMetadata,
        parseInt(startTime),
        parseInt(endTime),
        BigNumber.from(priceParse),
        amount,
        shareCyber,
        address,
        nonce,
        signer
    );

    console.info("end processing", { payload, ipfsHashMetadata, signature });

    res.status(200).json({
        status: "success",
        signature,
        startTime,
        endTime,
        amount,
        shareCyber,
        ipfsHashMetadata,
        distributionType,
        price: priceParse,
        contractAddress: config[contractName].mainnetAddress,
    });
};
