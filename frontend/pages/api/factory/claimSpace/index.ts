import moment from "moment";
import { Wallet } from "@ethersproject/wallet";
import { getDestination } from "@utils/saveToDb";
import { signMintRequest } from "@utils/factory/sign";
import { auth } from "@utils/middlewares/authMiddleware";
import { corsMiddleware } from "@utils/middlewares/corsMiddleware";
import config from "../../../../config";
import find from "lodash/find";

export default async (req, res) => {
    await corsMiddleware(req, res);

    if (req.body && typeof req.body === "string") {
        req.body = JSON.parse(req.body);
    }

    const sender: string = await auth(req);

    const { slug } = req?.body?.payload;

    const destination = await getDestination(slug);

    const tokenId = destination?.token_id;

    const conf = config[destination?.contractName];

    if (!destination) {
        return res.status(404).json({ err: "destination not found" });
    }

    if (destination?.status !== "active" || !(tokenId >= 0)) {
        return res
            .status(401)
            .json({ err: "destination status is not active" });
    }

    // TODO: this NFT Community distribution must be removed after the end of cryptobullsociety drop.
    const allowedTypes = ["create_claim_page", "NFT Community distribution"];

    if (!allowedTypes.includes(destination?.distributionType)) {
        return res.status(401).json({ err: "destination type not allowed" });
    }

    const whisteListed = find<Record<string, any>>(
        destination?.whitelist?.data,
        (o) => o?.address?.toLowerCase?.() === sender?.toLowerCase?.()
    );

    if (!whisteListed) {
        return res.status(403).json({ err: "WL" });
    }

    const now = moment.utc();
    const endDate = moment(parseInt(destination?.endTime) * 1000);
    const startDate = moment(parseInt(destination.startTime) * 1000);

    const isBetween = now.isBetween(startDate, endDate);

    if (!isBetween) {
        return res.status(401).json({ err: "OOT" });
    }

    const quantity = parseInt(whisteListed?.amount || 0);

    const signer = new Wallet(
        conf.manager
    );

    const sig: string = await signMintRequest(
        tokenId,
        quantity,
        sender,
        0,
        signer
    );

    res.json({ sig });
};
