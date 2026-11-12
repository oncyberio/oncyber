import { z } from "zod";
import config from "config/index";
import { BigNumber } from "ethers";
import Pinata from "@utils/factory/pinata";
import { parseEther } from "ethers/lib/utils";
import { Wallet } from "@ethersproject/wallet";
import { proc, NoApi } from "@utils/rpc/server";
import { getDestinationById } from "@utils/saveToDb";
import { getAddressCatch } from "@utils/factory/address";
import { signCreateDropRequest } from "@utils/factory/sign";
import { isDestinationOwner } from "@utils/firestore/destinationOwner";

export const generateSignature = proc({
    // schema
    schema: z
        .object({
            destinationId: z.string(),
            nonce: z.string(),
        })
        .required(),

    // handler
    async handler({ destinationId, nonce }) {
        const address = getAddressCatch(this.userId);

        const destination = await getDestinationById(destinationId);

        if (!destination?.data) {
            throw "User Destination not found";
        }

        // The signature makes the caller the drop's creator, so only the
        // destination's owner may ask for it (as in assertOwnership).
        if (!isDestinationOwner(destination.data, this.userId)) {
            throw new Error(
                "Destination was not verified or incorrect user, Please try again"
            );
        }

        const {
            name,
            price,
            status,
            endTime,
            destHash,
            quantity,
            token_id,
            startTime,
            thumbHash,
            description,
            contractName,
            animationHash,
            distributionType,
        } = destination.data;

        if (status !== "verified") {
            throw new Error(
                "Destination was not verified or incorrect user, Please try again"
            );
        }

        if (token_id) {
            throw new Error("Destination has already token id");
        }

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
                price,
                quantity,
                startTime,
                endTime,
            });

            throw new Error("Invalid request data");
        }

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

            throw new Error(
                "Unsupported contract, Please contact someone from the team."
            );
        }

        const signer = new Wallet(config[contractName].manager);

        const amount =
            !isNaN(quantity) &&
            !isNaN(parseInt(quantity)) &&
            parseInt(quantity).toString() === quantity.toString() &&
            parseInt(quantity);

        const shareCyber = parseInt(destination?.shareCyber || 50);

        const nc = !isNaN(parseInt(nonce)) && parseInt(nonce);

        const ipfsHashMetadata = await Pinata.uploadMetadata(
            thumbHash || "",
            animationHash || "",
            destHash,
            address,
            name,
            description
        );

        const priceParse = parseEther(price.toString());

        const signature = await signCreateDropRequest(
            ipfsHashMetadata,
            parseInt(startTime),
            parseInt(endTime),
            BigNumber.from(priceParse),
            amount,
            shareCyber,
            address,
            nc,
            signer
        );

        return {
            amount,
            endTime,
            signature,
            startTime,
            shareCyber,
            ipfsHashMetadata,
            distributionType,
            price: priceParse,
            contractAddress: config[contractName]?.mainnetAddress,
        };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
