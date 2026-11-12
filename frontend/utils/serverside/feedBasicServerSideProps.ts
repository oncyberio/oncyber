import { db } from "@utils/firebaseAdmin";

import nookies from "nookies";

import { auth } from "../middlewares/authMiddleware";
import { fetchUserByWalletIdCached } from "@api/accounts/user/utils";

export const feedBasicServerSideProps = async (context) => {
    try {
        const cookies = nookies.get(context);

        let token = cookies?.[cookies?.["_CCA"]];

        const walletId = await auth({ cookies });

        let user = await fetchUserByWalletIdCached(walletId.toLowerCase());

        if (!user) {
            return {
                props: {
                    authenticated: false,
                },
            };
        }

        return {
            props: {
                userId: walletId,
                user,
                authenticated: true,
                token,
            },
        };
    } catch (err) {
        return {
            props: {
                authenticated: false,
            },
        };
    }
};
