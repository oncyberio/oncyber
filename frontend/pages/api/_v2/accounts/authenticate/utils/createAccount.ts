import { db } from "@utils/firebaseAdmin";
import { uploadAsset } from "pages/api/user/avatar";
import { isValidAndUniqueUsername } from "pages/api/user/update";
import { getAccountDoc } from "./link";
import { invalidateUserProfile } from "@utils/firestore/userProfiles";

export default function createAccount({
    accountId,
    providerId,
    type,
    userMetadata,
}) {
    return db.runTransaction(async (transaction) => {
        console.log(
            "[ CREATING OR UPDATING ACCOUNT ]",
            accountId,
            providerId,
            type
        );

        let isNew = false;

        const accountDoc = await getAccountDoc(accountId, transaction);

        const userRef = db.collection("users").doc(accountDoc?.id || accountId);

        const userDoc = await transaction.get(userRef);

        const user = userDoc.data();

        const payload: any = {};

        const updatePayload: any = {};

        if (userMetadata.photoURL) {
            // uploadAsset pins to Pinata and returns the gateway url; a failed
            // avatar copy must not block account creation.
            const url = await uploadAsset(
                accountId,
                userMetadata.photoURL,
                "0xnotanaddress",
                "1"
            ).catch((error) => {
                console.error("[ CREATE ACCOUNT ] avatar upload failed", error);
                return null;
            });

            if (url) {
                payload.avatar = url;
                payload.avatarContractAddress = "0xnotanaddress";
                payload.avatarTokenId = 1;
            }
        }

        if (userMetadata.displayName) {
            const result = await isValidAndUniqueUsername(
                userMetadata.displayName
            );

            if (result.success) payload.username = result.username;
        }

        if (userMetadata.email) {
            updatePayload.email = userMetadata.email;
        }

        if (userMetadata.twitterHandle) {
            updatePayload.socials = {
                ...(user?.socials || {}),
                twitter: {
                    handle: userMetadata.twitterHandle,
                    active: user?.socials?.twitter?.active || true,
                },
            };
        }

        if (!accountDoc) {
            // then create the new account
            await transaction.set(userRef, {
                walletId: accountId.toLowerCase(),
                providerId,
                type,
                ...payload,
                ...updatePayload,
            });

            isNew = true;
        } else {
            if (Object.keys(updatePayload).length > 0) {
                await transaction.update(userRef, updatePayload);
            }
        }

        return {
            accountId: accountDoc?.id || accountId,
            isNew,
        };
    }).then((result) => {
        // A pre-signup lookup may have negative-cached this walletId; drop it
        // so the fresh account resolves immediately.
        invalidateUserProfile(accountId);
        return result;
    });
}
