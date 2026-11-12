import config from "../../../../config";
import { ethers } from "ethers";
import maticFactoryContract from "../../../../config/mainnet/DiamondCyberDestinationUtilityFactory.json";
import { nodeEnv } from "../../../../env";
import { corsMiddleware } from "../../../../utils/middlewares/corsMiddleware";

import {
    createAlchemyNftClient,
    hexToDecimalString,
} from "../../../../utils/alchemyNfts";
import { getBalance, isQA } from "./balance";

const getBatchBalance = async (
    owner,
    contractAddresses,
    isAutograph = false
) => {
    try {
        // if
        const web3 = createAlchemyNftClient(nodeEnv.ETH_BALANCE_CHECKER_RPC);

        const data = await web3.alchemy.getNfts({
            contractAddresses,
            owner,
            withMetadata: false,
        });

        let nfts = {};

        data.ownedNfts.map((nft) => {
            if (nft?.contract?.address && nft?.id?.tokenId) {
                let tokenId = hexToDecimalString(nft.id.tokenId);
                let contract_address = nft.contract.address.toLowerCase();

                if (nfts[contract_address])
                    nfts[contract_address][tokenId] = nft.balance;
                else nfts[contract_address] = { [tokenId]: nft.balance };
            }
        });

        const web3Matic = createAlchemyNftClient(nodeEnv.POLYGON_RPC);
        const maticNfts = await web3Matic.alchemy.getNfts({
            contractAddresses: ["0x6eba841f1201ffdde7ddc2ba995d3308f6c4aea0"],
            owner,
            withMetadata: false,
        });

        maticNfts.ownedNfts.map((nft) => {
            if (nft?.contract?.address && nft?.id?.tokenId) {
                let tokenId = hexToDecimalString(nft.id.tokenId);
                // matic nfts
                let contract_address = "m" + nft.contract.address.toLowerCase();

                if (nfts[contract_address])
                    nfts[contract_address][tokenId] = nft.balance;
                else nfts[contract_address] = { [tokenId]: nft.balance };
            }
        });

        if (isAutograph) {
            nfts["autograph"] = {
                [0]: await getBalance(owner, null, "autograph", null),
            };
        }

        return nfts;
    } catch (e) {
        console.error(e);
        return {};
    }
};

export default async (req, res) => {
    await corsMiddleware(req, res);

    try {
        if (isQA(req)) {
            let balance = {};

            req.body.contractAddresses.forEach((ca) => {
                balance[ca] = 1;
            });

            return res.json({
                success: true,
                balance,
            });
        }

        const balance = await getBatchBalance(
            req.query.walletId,
            req.body.contractAddresses,
            req.query.isAutograph
        );
        return res.json({
            success: true,
            balance,
        });
    } catch (e) {
        console.error(e);
        return res.json({
            success: false,
            balance: {},
        });
    }
};
