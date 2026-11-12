import { corsMiddleware } from "@utils/middlewares/corsMiddleware";
import { isCollectionOwner } from "@dapp/ownership/collections";

export default async (req, res) => {
    await corsMiddleware(req, res);

    try {
        const result = await isCollectionOwner(
            req.query.blockchain,
            req.query.walletId,
            req.query.address,
            req.query.slug,
            req.query.type
        );

        if (result.success === true) {
            return res.json({
                success: true,
                isOwner: result.value,
            });
        } else {
            return res.json({
                success: false,
                error: result.error,
            });
        }
    } catch (e) {
        console.error(e);
        return res.json({
            success: false,
            error: e.message,
        });
    }
};
