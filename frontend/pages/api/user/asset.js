import { nodeEnv } from "../../../env";
import { formatAsset } from "../../../utils/formatAssets";
import { corsMiddleware } from "../../../utils/middlewares/corsMiddleware";

export default async (req, res) => {
    await corsMiddleware(req, res);

    const fetchCreatedAsset = async (contract_address, token_id) => {
        try {
            const resp = await fetch(
                `${nodeEnv.OPENSEA_API}/asset/${contract_address}/${token_id}`,
                {
                    headers: {
                        "X-API-KEY": nodeEnv.OPENSEA_X_API_KEY,
                    },
                }
            );
            const data = await resp.json();

            if (!data.token_id) {
                return { success: false, asset: false };
            }

            return { success: true, asset: formatAsset(data) };
        } catch (e) {
            console.error(e);
            return { success: false, asset: false };
        }
    };

    const { success, asset } = await fetchCreatedAsset(
        req.query.token_address,
        req.query.token_id
    );

    res.json({
        success,
        freshAsset: asset,
    });
};
