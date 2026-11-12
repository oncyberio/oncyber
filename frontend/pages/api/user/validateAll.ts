import { auth, verify } from "../../../utils/middlewares/authMiddleware";
import { corsMiddleware } from "../../../utils/middlewares/corsMiddleware";

export default async (req, res) => {
    await corsMiddleware(req, res);

    try {
        const validatedAccounts = [];

        await Promise.all(
            Object.keys(req?.cookies)?.map(async (accountId) => {
                console.log(req.body.accounts[accountId]);

                if (req.body.accounts[accountId]) {
                    const value = await verify(req?.cookies?.[accountId]);

                    if (value) {
                        validatedAccounts.push(value);
                    }
                }
            })
        );

        res.json({ success: true, validatedAccounts });
    } catch (err) {
        console.log(err);

        res.json({ success: false, error: "user not valid." });
    }
};
