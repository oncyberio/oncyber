import { nodeEnv } from "../../../../env";
import { corsMiddleware } from "../../../../utils/middlewares/corsMiddleware";
import { fetchOwnedTezosAssets } from "../../../../utils/tezosAssets";

const getMaticAssets = async (url, assets = []) => {
    const maticResponse = await fetch(url, {
        headers: {
            "X-API-KEY": nodeEnv.OPENSEA_X_API_KEY,
        },
    });

    const matic = await maticResponse.json();

    console.log("IN MATIC LOOP");
    console.log(matic.results);

    if (matic && matic.results && matic.next) {
        return await getMaticAssets(matic.next, [...assets, ...matic.results]);
    } else if (matic && matic.results) {
        return [...assets, ...matic.results];
    } else {
        return [];
    }
};

const getAssets = async (account, offset = 0, type) => {
    try {
        if (type == "tezos") {
            const tzData = await fetchOwnedTezosAssets(account, offset);
            return tzData.assets;
        } else {
            const response = await fetch(
                `${nodeEnv.OPENSEA_API}/assets?owner=${account}&limit=50&offset=${offset}`,
                {
                    headers: {
                        "X-API-KEY": nodeEnv.OPENSEA_X_API_KEY,
                    },
                }
            );

            const data = await response.json();

            // if (data.assets.length > 0) {
            //     return [...data.assets, ...await getAssets(account, parseInt(offset) + 1, type)];
            // }

            // if (offset == 0) {
            //     try {
            //         const assets = await getMaticAssets(
            //             `${nodeEnv.OPENSEA_API_V2}/assets/matic?owner=${account}`
            //         );

            //         if (assets.length) {
            //             return [...data.assets, ...assets];
            //         }
            //     } catch (e) {
            //         console.log("No matic assets");
            //     }
            // }
            return data.assets;
        }
    } catch (e) {
        console.error(e);
        return [];
    }
};

export default async (req, res) => {
    await corsMiddleware(req, res);

    try {
        const assets = await getAssets(
            req.query.walletId,
            req.query.offset,
            req.query.blockchain
        );
        return res.json({
            success: true,
            assets: assets,
        });
    } catch (e) {
        console.error(e);
        return res.json({
            success: false,
            assets: [],
        });
    }
};
