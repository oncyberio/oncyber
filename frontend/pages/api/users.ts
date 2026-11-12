import { NextApiRequest, NextApiResponse } from "next";

import { corsMiddleware } from "@utils/middlewares/corsMiddleware";

import {
    getUserProfilesByWalletIds,
    publicUserProfile,
} from "@utils/firestore/userProfiles";

import { Failure, Result, Success } from "@utils/js";

import { User } from "@uitypes/user";

export async function getUsers(ids: string[]): Promise<Result<User[]>> {
    try {
        // Served from the two-tier walletId profile cache (in-process +
        // cross-instance caches/user-profile-{walletId}) instead of a raw
        // `walletId in` query on every call. These are display-only lookups
        // (portal owners, avatars, owner lists) that repeat the same walletIds
        // across views, so caching collapses the biggest read bucket.
        const users = await getUserProfilesByWalletIds(ids);

        // Anyone may call this: return the public shape, without e-mails.
        return Success(users.map(publicUserProfile));
    } catch (err) {
        console.error(err);
        return Failure(err?.message || "Failed to get users data");
    }
}

const users = async (req: NextApiRequest, res: NextApiResponse) => {
    try {
        await corsMiddleware(req, res);
        const walletIds = req.body.walletIds;

        const result = await getUsers(walletIds || []);

        if (result.success === true) {
            return res.status(200).json({ success: true, users: result.value });
        } else {
            return res
                .status(404)
                .json({ success: false, error: result.error });
        }
    } catch (err) {
        // take in account the update method that throws error code 400
        return res.status(400).json({
            success: false,
            message: "Could not find users.",
        });
    }
};

export default users;
