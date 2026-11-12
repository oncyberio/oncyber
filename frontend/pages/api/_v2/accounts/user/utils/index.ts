import {
    getAccountDoc,
    getAccountDocCached,
} from "@api/accounts/authenticate/utils/link";
import { db } from "@utils/firebaseAdmin";
import { getExhibitById } from "pages/api/exhibit";
import { countDestinationsByUserId } from "@utils/firestore/destinations";
import {
    getUserProfilesByWalletIds,
    publicUserProfile,
} from "@utils/firestore/userProfiles";

export async function getSpaceEditors(exhibitId) {
    const doc = await db.collection("exhibits").doc(exhibitId).get();

    if (!doc.exists) return null;

    const exhibit = doc.data();

    const users = await getProfiles(exhibit.editors);

    const editors = await Promise.all(
        Object.values(users).map(async (editor: any) => {
            const doc = await db
                .collection("users")
                .doc(editor.id)
                .collection("exhibits")
                .doc(exhibitId)
                .get();

            const userExhibit = doc.data();

            let privilege:
                | ""
                | "co-curator"
                | "delegator"
                | "owner"
                | "admin-curator" = "";

            if (exhibit.owner.toLowerCase() === editor.id.toLowerCase()) {
                privilege = "owner";
            } else if (userExhibit?.isAdminCurator) {
                privilege = "admin-curator";
            } else if (userExhibit?.isAssetsShared || !userExhibit?.invited) {
                privilege = "delegator";
            } else {
                privilege = "co-curator";
            }

            return {
                ...editor,
                privilege,
            };
        })
    );

    return editors;
}

export async function getProfiles(editorIds = [], loadNumOfSpaces = false) {
    let editors = {};

    const batches = [];

    for (let i = 0; i < Math.ceil(editorIds.length / 10); i++) {
        batches.push(editorIds.slice(i * 10, i * 10 + 10));
    }

    await Promise.all(
        batches.map(async (batch) => {
            const profiles = await getProfile(
                batch.map((walletId) => walletId.toLowerCase()),
                loadNumOfSpaces
            );

            if (!profiles) {
                return;
            }

            editors = {
                ...editors,
                ...profiles,
            };
        })
    );

    return editors;
}

export async function getProfile(batch, loadNumOfSpaces = false) {
    // Editor/owner profile resolution for the space view. Shares the two-tier
    // walletId profile cache with getUsers/getUser, so the same handful of
    // editor/owner walletIds resolved on every view of a popular space hit the
    // cache instead of re-running `walletId in` against Firestore each time.
    const users = await getUserProfilesByWalletIds(batch);

    if (!users.length) {
        return null;
    }

    const profiles = {};

    await Promise.all(
        users.map(async (user) => {
            // user.id is the original-case account/doc id (as before).
            profiles[user.id] = {
                id: user.id,
                walletId: user.id, // shouldn't be lower case for tezos and solana
                username: user.username,
                avatar: user.avatar,
                description: user.description,
            };

            // too heavy
            if (loadNumOfSpaces) {
                const spaces = await db
                    .collection("users")
                    .doc(user.id)
                    .collection("exhibits")
                    .get();

                const createdSpaces = await Promise.all(
                    spaces.docs.map(async (doc) => {
                        const data = doc.data();

                        if (!data.invited) {
                            // this is too heavy, especially for 6529
                            const exhibitDoc = await db
                                .collection("exhibits")
                                .doc(doc.id)
                                .get();

                            const exhibit = exhibitDoc.data();

                            if (
                                exhibit?.info?.headline &&
                                (exhibit?.info?.cHeroImg ||
                                    exhibit?.info?.fHeroImg ||
                                    exhibit?.info?.heroImg)
                            ) {
                                return true;
                            }

                            return null;
                        }

                        return null;
                    })
                );

                profiles[user.id].numOfSpaces = createdSpaces.filter(
                    (doc) => doc
                ).length;
            }
        })
    );

    return profiles;
}

export async function fetchUserByUsername(username, isFull = false) {
    if (!username) return null;

    if (username[0] == "@") username = username.substr(1);

    const account = await getAccountDoc(username, null, "username");

    if (!account) {
        return null;
    }

    return getUserByDoc(account, isFull);
}

export async function fetchUserByWalletId(accountId, isFull = false) {
    if (!accountId) return null;

    if (accountId[0] == "@") accountId = accountId.substr(1);

    const account = await getAccountDoc(accountId);

    if (!account) {
        return null;
    }

    return getUserByDoc(account, isFull);
}

// Cached variant for authenticated SSR *display* hydration only — resolves
// the account through the walletId profile cache (see getAccountDocCached in
// link.ts for the constraints: never auth mutations, never isFull=true).
export async function fetchUserByWalletIdCached(accountId, isFull = false) {
    if (!accountId) return null;

    if (accountId[0] == "@") accountId = accountId.substr(1);

    const account = await getAccountDocCached(accountId);

    if (!account) {
        return null;
    }

    return getUserByDoc(account, isFull);
}

export async function fetchUserByAccountId(accountId, isFull = false) {
    const account = await getAccountDoc(accountId);

    if (!account) {
        return null;
    }

    return getUserByDoc(account, isFull);
}

export async function getUserMergeMetadataByDoc(doc, token) {
    const userDoc = doc;

    const user = userDoc.data();

    const linkedAccountsSnap = await db
        .collection("users")
        .doc(userDoc.id)
        .collection("linkedAccounts")
        .count()
        .get();

    const userExhibitsSnapshot = await db
        .collection("users")
        .doc(userDoc.id)
        .collection("exhibits")
        .count()
        .get();

    const userUploadedAssetsSnapshot = await db
        .collection("users")
        .doc(userDoc.id)
        .collection("assets-upload-content")
        .count()
        .get();

    const favoritesSnapshot = await db
        .collection("users")
        .doc(userDoc.id)
        .collection("favorites")
        .count()
        .get();

    const destinationsCount = await countDestinationsByUserId(user.walletId);

    return {
        id: userDoc.id,
        ...user,
        linkedAccounts: linkedAccountsSnap.data().count,
        exhibitIds: userExhibitsSnapshot.data().count,
        uploadedAssets: userUploadedAssetsSnapshot.data().count,
        destinations: destinationsCount,
        favorites: favoritesSnapshot.data().count,
    };
}

/**
 * isFull modes:
 * - true:   full field set + exhibits subcollection (`exhibitIds`) + current
 *           exhibit doc. Only the studio actually consumes exhibitIds
 *           (features/studio/context/ExhibitContext), so this belongs on
 *           studio SSR only — it costs a whole-subcollection read per call.
 * - "self": the authenticated user's own doc — full field set (email etc.)
 *           and linkedAccounts resolution, but NO exhibits/current-exhibit
 *           reads. For non-studio authenticated SSR.
 * - false:  another user's public shape (email/visitedSpaces/currentExhibitId
 *           stripped), no exhibits reads.
 */
export async function getUserByDoc(
    doc,
    isFull = false,
    overwrite = {
        currentExhibitId: "",
    }
) {
    const userDoc = doc;

    const user = userDoc.data();

    const exhibitIds = [];

    let linkedAccounts = [];

    // The user doc carries two linked-account shapes: `linkedAccounts` (string
    // array, kept for the array-contains lookup in getAccountDoc — do not
    // change) and `linkedAccountsData` (denormalized copy of the subcollection
    // OBJECT docs, written through on every link/unlink and lazily backfilled
    // below). Preferring the field saves the per-navigation subcollection read
    // for every user with linked accounts.
    if (Array.isArray(user.linkedAccountsData)) {
        linkedAccounts = user.linkedAccountsData;
    } else if (
        Array.isArray(user.linkedAccounts) &&
        user.linkedAccounts.length > 0
    ) {
        const linkedAccountsSnap = await db
            .collection("users")
            .doc(userDoc.id)
            .collection("linkedAccounts")
            .get();

        linkedAccountsSnap.forEach((doc) => {
            linkedAccounts.push({
                id: doc.id,
                ...doc.data(),
            });
        });

        // Lazy backfill so this user's next read skips the subcollection.
        // Best-effort, and via a plain doc ref — `userDoc` may be a
        // cache-served adapter without a real `.ref`.
        db.collection("users")
            .doc(userDoc.id)
            .update({ linkedAccountsData: linkedAccounts })
            .catch(() => {});
    }

    delete user.linkedAccountsData;
    user.linkedAccounts = linkedAccounts;

    if (isFull === "self") {
        return {
            id: userDoc.id,
            ...user,
        };
    }

    if (isFull) {
        const userExhibitsSnapshot = await db
            .collection("users")
            .doc(userDoc.id)
            .collection("exhibits")
            .get();

        userExhibitsSnapshot.forEach((doc) => {
            exhibitIds.push({
                id: doc.id,
                ...doc.data(),
            });
        });

        if (user.currentExhibitId) {
            const exhibitId =
                overwrite.currentExhibitId || // !after we access template/duplicate link
                user?.currentExhibitId ||
                exhibitIds?.[0]?.id ||
                ""; // "eOvZ3M4LTVxrQHnV8dnx";

            if (exhibitId) {
                var exhibit = await getExhibitById(exhibitId);
            }
        }

        return {
            id: userDoc.id,
            ...user,
            exhibitIds,
            exhibit,
        };
    }

    // we dont need all this when getting other users
    const { email, visitedSpaces, currentExhibitId, ...rest } = user;

    // Linked sign-ins carry their own e-mail; leave those out too.
    return publicUserProfile({
        id: userDoc.id,
        ...rest,
    });
}
