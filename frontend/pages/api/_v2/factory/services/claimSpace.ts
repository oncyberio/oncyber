import { z } from "zod";
import moment from "moment";
import config from "@config/index";
import { Wallet } from "@ethersproject/wallet";
import { proc, NoApi } from "@utils/rpc/server";
import { getDestination } from "@utils/saveToDb";
import { signMintRequest } from "@utils/factory/sign";
import { checkUserWhitelisted } from "@utils/checkUserWhitelisted";

export const claimSpace = proc({
    // schema
    schema: z.object({
        slug: z.string(),
    }),

    // handler
    async handler({ slug }) {
        const destination = await getDestination(slug);

        if (!destination) {
            throw new Error(
                "Destination not found, Please contact someone from the team"
            );
        }

        const tokenId = destination?.token_id;

        const conf = config[destination?.contractName];

        if (destination?.status !== "active" || !(tokenId >= 0)) {
            throw new Error("Destination status is not active");
        }

        let quantity = 1;

        if (destination?.whitelist_url) {
            const isUserWhisteListed = await checkUserWhitelisted(
                destination.whitelist_url,
                this.userId
            );

            if (!isUserWhisteListed) {
                throw "Not eligible to claim!";
            }

            quantity = parseInt(isUserWhisteListed?.amount || 0);
        }

        const now = moment.utc();
        const endDate = moment(parseInt(destination?.endTime) * 1000);
        const startDate = moment(parseInt(destination.startTime) * 1000);

        const isBetween = now.isBetween(startDate, endDate);

        if (!isBetween) {
            throw "OOT";
        }

        const signer = new Wallet(
            conf.manager
        );

        const sig: string = await signMintRequest(
            tokenId,
            quantity,
            this.userId,
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
