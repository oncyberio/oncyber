import { db } from "@utils/firebaseAdmin";

import nookies from "nookies";

import { auth } from "../middlewares/authMiddleware";
import { fetchUserByWalletIdCached } from "@api/accounts/user/utils";
import { profileWrittenAt } from "@utils/auth/profileWrites";

export const feedBasicServerSideProps = async (context) => {
    try {
        const cookies = nookies.get(context);

        let token = cookies?.[cookies?.["_CCA"]];

        const walletId = await auth({ cookies });

        // Their own account, at least as fresh as their last change to it.
        let user = await fetchUserByWalletIdCached(
            walletId.toLowerCase(),
            false,
            { notBefore: profileWrittenAt(cookies) }
        );

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
