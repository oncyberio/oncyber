import { nodeEnv } from "../../../env";
import { corsMiddleware } from "../../../utils/middlewares/corsMiddleware";

export default async (req, res) => {
    await corsMiddleware(req, res);

    const { userId, offset = 0, limit = 50, owner } = req.query;

    // console.log(req.query);

    // console.log(
    //     `${
    //         nodeEnv.OPENSEA_API
    //     }/assets?owner=${owner}&limit=50&offset=${offset || 0}`
    // );

    try {
        const response = await fetch(
            `${nodeEnv.OPENSEA_API}/assets?owner=${owner}&limit=${limit}&offset=${offset}`,
            {
                headers: {
                    "X-API-KEY": nodeEnv.OPENSEA_X_API_KEY,
                },
            }
        );

        // console.log(
        //     `${
        //         nodeEnv.OPENSEA_API
        //     }/assets?owner=${userId}&limit=50&offset=${offset || 0}`
        // );
        const data = await response.json();

        // return res.status(400).json({
        //     success: false,
        //     message: "Something weird with opensea is happening...",
        // });

        if (response.status > 299) {
            res.statusCode = response.status;
            res.json(data);
            return;
        }

        // console.log(data);
        res.json(data);
    } catch (err) {
        return res.status(400).json({
            success: false,
            message: "Something weird with opensea is happening...",
        });
    }
};
