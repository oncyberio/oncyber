import { z } from "zod";
import config from "@config/index";
import { Wallet } from "@ethersproject/wallet";
import { proc, NoApi } from "@utils/rpc/server";
import { getDestination } from "@utils/saveToDb";
import { signMintRequest } from "@utils/factory/sign";

export const selfClaimTokens = proc({
    // schema
    schema: z.object({
        slug: z.string(),
        type: z.string().optional(),
    }),

    // handler
    async handler({ slug, type }) {
        const destination = await getDestination(slug, null, true);
        const tokenId = type === "estimateGas" ? 0 : destination?.token_id;
        const userId = destination?.author?.userId;
        const quantity = destination?.quantity;

        if (!userId) {
            throw new Error("Destination user not found!");
        }

        if (!quantity) {
            throw new Error("Destination quantity not found!");
        }

        if (userId !== this.userId) {
            throw new Error("User not allowed to self claim tokens!");
        }

        if (!destination?.contractName) {
            throw new Error("Contract not found, Please try again!");
        }

        const conf = config[destination.contractName];

        const signer = new Wallet(
            conf.manager
        );

        const sig: string = await signMintRequest(
            tokenId,
            quantity,
            userId,
            0,
            signer
        );

        return { sig };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
