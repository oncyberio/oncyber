import config from "../../../../config";
import { ethers } from "ethers";
import maticFactoryContract from "../../../../config/mainnet/DiamondCyberDestinationUtilityFactory.json";
import { nodeEnv } from "../../../../env";
import { corsMiddleware } from "../../../../utils/middlewares/corsMiddleware";

// Comma-separated wallets that bypass balance checks on preview deployments.
const DEV_WALLETS = (process.env.QA_WALLETS || "")
    .split(",")
    .map((it) => it.trim())
    .filter(Boolean);

export function isQA(req) {
    return (
        process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" &&
        DEV_WALLETS.some(
            (it) => it.toLowerCase() === req.query.walletId?.toLowerCase()
        )
    );
}

export const getBalance = async (owner, collection, contractName, token_id) => {
    let balance = 0;

    try {
        // if
        if (
            contractName == "factory" ||
            contractName == "curated" ||
            contractName == "rtfkt" ||
            contractName == "oncyber-ethereum-community" ||
            contractName == "andfriends" ||
            contractName == "exopods"
        ) {
            const balanceContract = config[contractName].json;

            const provider = new ethers.providers.JsonRpcProvider(
                nodeEnv.ETH_BALANCE_CHECKER_RPC
            );

            const contract = new ethers.Contract(
                balanceContract.address,
                balanceContract.abi,
                provider
            );

            return (
                //!todo can we balance of multiple token_ids?
                +ethers.utils.formatUnits(
                    await contract.balanceOf(owner, parseInt(token_id))
                ) * 1000000000000000000
            );
        } else if (contractName == "autograph") {
            const response = await fetch(
                `https://api.autograph.io/v1/api/nfts/6206e621c19ea3000e496f3f/public/count?address=${owner}`
            );
            const data = await response.json();

            return data;
        } else if (contractName == "factory-polygon") {
            const balanceContract = maticFactoryContract;

            const provider = new ethers.providers.JsonRpcProvider(
                nodeEnv.POLYGON_RPC
            );

            const contract = new ethers.Contract(
                balanceContract.address,
                balanceContract.abi,
                provider
            );

            return (
                +ethers.utils.formatUnits(
                    await contract.balanceOf(owner, token_id)
                ) * 1000000000000000000
            );
        } else if (collection) {
            try {
                const response = await fetch(
                    `${nodeEnv.OPENSEA_API}/assets?owner=${owner}&collection=${collection}&limit=50`,
                    {
                        headers: {
                            "X-API-KEY": nodeEnv.OPENSEA_X_API_KEY,
                        },
                    }
                );
                const data = await response.json();

                if (data?.assets?.length) return data.assets.length;

                // if data.results means it's matic. iterate and find asset with token_id

                data?.results?.map((result) => {
                    if (result.token_id == token_id) {
                        balance++;
                    }
                });

                return balance;
            } catch (e) {
                console.log("ERROR CAUGT");
                console.log(e);
                return 1;
            }
        } else {
            return 1;
        }
    } catch (e) {
        console.error(e);
        return 1;
    }
};

export default async (req, res) => {
    await corsMiddleware(req, res);

    try {
        if (isQA(req)) {
            return res.json({
                success: true,
                balance: 1,
            });
        }
        const balance = await getBalance(
            req.query.walletId,
            req.query.collection,
            req.query.contractName,
            req.query.token_id
        );
        return res.json({
            success: true,
            balance: balance,
        });
    } catch (e) {
        console.error(e);
        return res.json({
            success: false,
            balance: 0,
        });
    }
};
