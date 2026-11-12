import { prepareSocialIdentityMerge } from "@utils/accountIdentity";
import {
    getUserByDoc,
    getUserMergeMetadataByDoc,
} from "@api/accounts/user/utils";
import { db, fire } from "@utils/firebaseAdmin";
import { isSignedInAs } from "@utils/auth/accountOwnership";
import { transferDestinations } from "@utils/firestore/destinations";
import {
    getUserProfileByWalletId,
    invalidateUserProfile,
} from "@utils/firestore/userProfiles";

interface ICollectionToSave {
    [key: string]: Array<{
        ref: FirebaseFirestore.DocumentReference;
        data: any;
    }>;
}

export async function getAccountDoc(
    accountId: string,
    transaction?: any,
    type: "username" | "walletId" = "walletId"
) {
    let snap: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;

    if (type === "walletId") {
        accountId = accountId.toLowerCase();
    }

    const usersRef = db
        .collection("users")
        .where(type, "==", accountId)
        .limit(1);

    const linkedAccountRef = db
        .collection("users")
        .where("linkedAccounts", "array-contains", accountId)
        .limit(1);

    // Resolve the PRIMARY account first — this is the overwhelmingly common case
    // (an id is either a user's primary walletId/username OR a secondary in someone
    // else's linkedAccounts array, never both). Trying linkedAccounts first meant
    // every primary login ran an extra array-contains query that returned nothing
    // (~8k wasted executions / 6h). Fall back to linkedAccounts only on a miss, so
    // genuinely-linked secondary accounts still resolve to their primary doc.
    if (!transaction) {
        snap = await usersRef.get();
    } else {
        snap = await transaction.get(usersRef);
    }

    if (snap.empty) {
        if (!transaction) {
            snap = await linkedAccountRef.get();
        } else {
            snap = await transaction.get(linkedAccountRef);
        }
    }

    if (snap.empty) return null;

    return snap.docs[0];
}

/**
 * getAccountDoc for authenticated SSR *display* hydration, served through the
 * two-tier walletId profile cache. Returns a minimal snapshot adapter — the
 * SSR path only uses `.id` and `.data()` (never `.ref`). `data()` hands out a
 * copy because getUserByDoc mutates its input and the cached object is shared
 * across requests on a warm instance.
 *
 * Do NOT use for auth mutations (login/link/unlink/merge) — those need the
 * raw, transaction-capable query — or for studio (isFull) hydration, which
 * consumes `currentExhibitId`: several of its write sites don't invalidate
 * the profile cache, so a cached doc could reopen a stale exhibit.
 *
 * A cache miss (including secondary linked wallets, which resolve via the
 * array-contains fallback the cache can't model) falls back to the raw query.
 */
export async function getAccountDocCached(accountId: string) {
    try {
        const profile = await getUserProfileByWalletId(accountId);
        if (profile?.id) {
            return {
                id: profile.id,
                exists: true,
                data: () => ({ ...profile }),
            };
        }
    } catch (err) {
        // fall through to the raw query
    }
    return getAccountDoc(accountId);
}

export async function linkAccounts({
    accountToLink,
    chainType,
    accountId,
    type,
    providerId,
    userMetadata,
    token,
}) {
    const result = await db.runTransaction(async (transaction) => {
        if (accountToLink.toLowerCase() === accountId.toLowerCase())
            throw new Error("You cannot link the same account", {
                cause: "link:same-account",
            });

        // check if an account with the same id exists
        const accountDoc = await getAccountDoc(accountToLink, transaction);

        if (accountDoc) {
            const account = accountDoc.data();

            if (
                (account.linkedAccounts || []).includes(
                    accountToLink.toLowerCase()
                )
            ) {
                throw new Error(
                    `Account ${
                        account?.username || accountDoc.id
                    } already linked to another account.`,
                    {
                        cause: "link:already-linked",
                    }
                );
            }

            // TODO: moving forward we will just be using the walletId to fetch the user
            const userFullDoc = await getUserMergeMetadataByDoc(
                accountDoc,
                token
            );

            return {
                success: false,
                message: `Account ${
                    account?.username || accountDoc.id
                } already linked to another account.`,
                type: "link:account-exists",
                account: userFullDoc,
            };

            throw new Error(
                `Account ${account?.username || accountDoc.id} already exists`,
                {
                    cause: "link:account-exists",
                }
            );
        }

        const userRef = db
            .collection("users")
            .where("walletId", "==", accountId.toLowerCase())
            .limit(1);

        const userSnap = await transaction.get(userRef);

        if (userSnap.empty) {
            throw new Error(
                "The account you are trying to link to does not exist",

                {
                    cause: "link:account-not-found",
                }
            );
        }

        const userDoc = userSnap.docs[0];

        const user = userDoc.data();

        const payload: any = {
            linkedAccounts: [
                ...(user?.linkedAccounts || []),
                accountToLink.toLowerCase(),
            ],
        };

        if (userMetadata.twitterHandle) {
            payload.socials = {
                ...(user?.socials || {}),
                twitter: {
                    handle: userMetadata.twitterHandle,
                    active: true,
                },
            };
        }

        const linkedAccountRef = userDoc.ref
            .collection("linkedAccounts")
            .doc(accountToLink.toLowerCase());

        const linkedAccountsSnap = await transaction.get(
            userDoc.ref.collection("linkedAccounts")
        );

        const linkedAccounts = [];

        linkedAccountsSnap.forEach((doc) => {
            linkedAccounts.push({
                id: doc.id,
                ...doc.data(),
            });
        });

        const linkedAccountPayload =
            type === "web2"
                ? {
                      providerId,
                      type,
                      accountId: accountToLink.toLowerCase(),
                      ...userMetadata,
                  }
                : {
                      providerId,
                      type,
                      accountId: accountToLink.toLowerCase(),
                      chainType,
                      originalWalletId: accountToLink,
                  };

        // Keep the denormalized object copy on the user doc in sync (read by
        // getUserByDoc instead of the subcollection).
        payload.linkedAccountsData = linkedAccounts.concat({
            id: accountToLink.toLowerCase(),
            ...linkedAccountPayload,
        });

        await transaction.set(linkedAccountRef, linkedAccountPayload);

        await transaction.update(userDoc.ref, payload);

        return {
            success: true,
            account: {
                id: userDoc.id,
                ...user,
                ...payload,
                linkedAccounts: linkedAccounts.concat(linkedAccountPayload),
            },
        };
    });

    // Linked accounts ride the profile cache (and the CDN-cached /api/user/me),
    // so drop both wallets' cached profiles after the write.
    invalidateUserProfile(accountId);
    invalidateUserProfile(accountToLink);

    return result;
}

export async function unlinkAccount({ accountId, accountToUnlink }) {
    const result = await db.runTransaction(async (transaction) => {
        // get account to unlink
        const userRef = db
            .collection("users")
            .where("walletId", "==", accountId.toLowerCase())
            .limit(1);

        const userSnap = await transaction.get(userRef);

        if (userSnap.empty) {
            throw new Error(
                "The account you are trying to link to does not exist"
            );
        }

        const userDoc = userSnap.docs[0];

        const user = userDoc.data();

        if (!user.linkedAccounts.includes(accountToUnlink.toLowerCase())) {
            throw new Error("Account is not linked to the user");
        }

        const linkedAccountsRef = db
            .collection("users")
            .doc(userDoc.id)
            .collection("linkedAccounts");

        const linkedAccountsSnap = await transaction.get(linkedAccountsRef);

        const linkedAccounts = [];

        linkedAccountsSnap.forEach((doc) => {
            linkedAccounts.push({
                id: doc.id,
                ...doc.data(),
            });
        });

        const newLinkedAccounts = user.linkedAccounts.filter(
            (account) => account !== accountToUnlink.toLowerCase()
        );

        const accountToUnlinkData = linkedAccounts.find(
            (account) => account.accountId === accountToUnlink.toLowerCase()
        );

        const payload = {
            linkedAccounts: newLinkedAccounts,
            // Keep the denormalized object copy in sync with the subcollection.
            linkedAccountsData: linkedAccounts.filter(
                (account) =>
                    account.accountId !== accountToUnlink.toLowerCase()
            ),
        };

        if (accountToUnlinkData.providerId === "twitter.com") {
            payload["socials.twitter"] = fire.FieldValue.delete();

            delete user.socials.twitter;
        }

        await transaction.update(userDoc.ref, payload);

        const linkedAccountRef = userDoc.ref
            .collection("linkedAccounts")
            .doc(accountToUnlink.toLowerCase());

        await transaction.delete(linkedAccountRef);

        return {
            success: true,
            account: {
                ...user,
                linkedAccounts: linkedAccounts.filter(
                    (account) =>
                        account.accountId !== accountToUnlink.toLowerCase()
                ),
            },
        };
    });

    invalidateUserProfile(accountId);
    invalidateUserProfile(accountToUnlink);

    return result;
}

export async function forceMergeAccount({
    sourceMetadata,
    sourceAccountId,
    destinationAccountId,
    signedInAccountId,
    source,
    token,
}) {
    // The destination account is rewritten and the source account deleted.
    // Refuse unless the caller's session is the destination account; the
    // route proves control of the source account by signature before this.
    if (!isSignedInAs(signedInAccountId, destinationAccountId)) {
        throw new Error("Sign in to the account you are merging into.", {
            cause: "link:not-owner",
        });
    }

    const result = await db.runTransaction(async (transaction) => {
        if (
            sourceAccountId.toLowerCase() === destinationAccountId.toLowerCase()
        )
            throw new Error("You cannot link the same account", {
                cause: "link:same-account",
            });

        // fetch source user
        const userSnapRef = db
            .collection("users")
            .where("walletId", "==", sourceAccountId.toLowerCase())
            .limit(1);

        const userSnap = await transaction.get(userSnapRef);

        console.log("1. [ forceMergeAccount ] get source user");

        if (userSnap.empty) {
            throw new Error(
                "The account you are trying to link to does not exist"
            );
        }

        const userDoc = userSnap.docs[0];

        const user = userDoc.data();

        // fetch destination user

        const destinationUserRef = db
            .collection("users")
            .where("walletId", "==", destinationAccountId.toLowerCase())
            .limit(1);

        const destinationUserSnap = await transaction.get(destinationUserRef);

        console.log("2. [ forceMergeAccount ] get destination user");

        if (destinationUserSnap.empty) {
            throw new Error(
                "The account you are trying to link to does not exist"
            );
        }

        const destinationUserDoc = destinationUserSnap.docs[0];

        const destinationUser = destinationUserDoc.data();
        const commitSocialIdentity = await prepareSocialIdentityMerge(transaction, userDoc, destinationUserDoc);

        // fetch subcollection

        const { collections, total } = await getSubcollections({
            source: userDoc.ref,
            transaction,
        });

        await overwriteExhibitSubcollection({
            destinationUserId: destinationUserDoc.id,
            transaction,
            collections,
        });

        console.log("3. [ forceMergeAccount ] fetch subcollection");

        const exhibits = await getExhibitsAndFormat(
            collections,
            transaction,
            destinationUserDoc.id,
            userDoc.id
        );

        const vrmsSnapRef = db
            .collection("vrm")
            .where("userId", "==", sourceAccountId.toLowerCase());

        const vrmsSnap = await transaction.get(vrmsSnapRef);

        // I. backup everything first

        // Define the document path in the destination collection
        const backupRef = db.collection("backupusers").doc(userDoc.id);

        // I.1 get subcollections

        // Define the source and destination collection paths

        // Copy the documents from the source collection to the destination collection

        // Handle subcollections within each document
        await saveSubcollections({
            collections,
            destination: backupRef,
            transaction,
        });

        console.log("4. [ forceMergeAccount ] backup: save subcollections");

        await transaction.set(backupRef, user);

        console.log("5. [ forceMergeAccount ] backup: save user document");

        // II. merge accounts (only copy the subcollections and make sure to update the userId to the new one)

        // make sure to update exhibit owner

        // exhibits
        // exhibits.shared
        // favorites
        // kitbash
        // likes
        // assets-upload-content
        // linkedAccounts

        await saveSubcollections({
            collections,
            destination: destinationUserDoc.ref,
            transaction,
        });

        console.log(
            "6. [ forceMergeAccount ] destination user: save subcollections"
        );

        // vrms too...

        await saveExhibits(exhibits, transaction);

        const newLinkedAccounts = (destinationUser?.linkedAccounts || [])
            .concat(user?.linkedAccounts || [])
            .concat(sourceAccountId.toLowerCase());

        console.log(
            "7. [ forceMergeAccount ] destination user: update exhibit metadata",
            destinationUserDoc.ref.path,
            newLinkedAccounts
        );
        // then link the accounts

        const updatePayload: any = {
            linkedAccounts: newLinkedAccounts,
            // The merged subcollection isn't read inside this transaction, so
            // drop the denormalized copy; getUserByDoc rebuilds + backfills it
            // from the (now merged) subcollection on the next read.
            linkedAccountsData: fire.FieldValue.delete(),
        };

        if (source === "target") {
            if (user.username) {
                updatePayload.username = user.username;
            }

            if (user.avatar) {
                updatePayload.avatar = user.avatar;
            }

            if (user.avatarContractAddress) {
                updatePayload.avatarContractAddress =
                    user.avatarContractAddress;
            }

            if (user.avatarTokenId) {
                updatePayload.avatarTokenId = user.avatarTokenId;
            }
        }

        if (sourceMetadata.twitterHandle) {
            updatePayload.socials = {
                ...(destinationUser?.socials || {}),
                twitter: {
                    handle: sourceMetadata.twitterHandle,
                    active: true,
                },
            };
        }

        await transaction.update(destinationUserDoc.ref, updatePayload);

        console.log(
            "8. [ forceMergeAccount ] destination user: update destination user linkedAccounts"
        );

        await transaction.set(
            destinationUserDoc.ref
                .collection("linkedAccounts")
                .doc(sourceAccountId.toLowerCase()),
            sourceMetadata
        );

        // update vrms

        if (!vrmsSnap.empty) {
            await Promise.all(
                vrmsSnap.docs.map(async (doc) => {
                    await transaction.update(doc.ref, {
                        userId: destinationUserDoc.id,
                    });
                })
            );
        }

        console.log(
            "9. [ forceMergeAccount ] destination user: add linkedAccount document"
        );

        // III. delete source account

        // Both users' upload-library index docs are now stale (the
        // assets-upload-content subcollection moved) — drop them; the next
        // picker open rebuilds from the merged subcollection.
        transaction.delete(
            db.collection("caches").doc(`upload-index-${userDoc.id}`)
        );
        transaction.delete(
            db
                .collection("caches")
                .doc(`upload-index-${destinationUserDoc.id}`)
        );

        commitSocialIdentity();
        await transaction.delete(userDoc.ref);

        console.log(
            "10. [ forceMergeAccount ] destination user: delete document"
        );

        await deleteSubcollections({
            collections,
            transaction,
        });

        console.log(
            "11. [ forceMergeAccount ] destination user: delete collections"
        );

        let totalWrites =
            total * 3 + 4 + (vrmsSnap?.size || 0) + (exhibits?.length || 0);

        if (totalWrites <= 500) {
            await transferDestinations(
                user.walletId,
                destinationAccountId.toLowerCase()
            );
        }

        return {
            success: true,
        };
    });

    invalidateUserProfile(sourceAccountId);
    invalidateUserProfile(destinationAccountId);

    return result;
}

async function saveExhibits(
    exhibits,
    transactions: FirebaseFirestore.Transaction
) {
    await Promise.all(
        exhibits.map(async ({ data, ref }) => {
            console.log(ref.id, data);

            await transactions.update(
                db.collection("exhibits").doc(ref.id),
                data
            );
        })
    );
}

async function getExhibitsAndFormat(
    collections: ICollectionToSave,
    transaction: FirebaseFirestore.Transaction,
    newUserId: string,
    prevUserId?: string
) {
    const exhibits = [];

    if (collections["exhibits"]) {
        await Promise.all(
            collections["exhibits"].map(async (exhibit) => {
                const payload: any = {};

                const exhibitDoc = await transaction.get(
                    db.collection("exhibits").doc(exhibit.ref.id)
                );

                if (!exhibitDoc.exists) return;

                const exhibitData = exhibitDoc.data();

                if (
                    exhibitData.owner.toLowerCase() === prevUserId.toLowerCase()
                ) {
                    payload.owner = newUserId;
                }

                payload.editors = exhibitData.editors.map((editor) => {
                    if (editor.toLowerCase() === prevUserId.toLowerCase()) {
                        return newUserId;
                    }

                    return editor;
                });

                // check if there duplicates in payload.editors, if yes then remove the last one
                const editors = payload.editors;

                const editorsSet = new Set(editors);

                if (editorsSet.size !== editors.length) {
                    payload.editors = Array.from(editorsSet);
                }

                exhibits.push({
                    ref: exhibit.ref,
                    data: {
                        ...exhibitData,
                        ...payload,
                    },
                });
            })
        );
    }

    return exhibits;
}

// for merging an account that has been invited to the same exhibit
async function overwriteExhibitSubcollection({
    destinationUserId,
    transaction,
    collections,
}: {
    transaction: FirebaseFirestore.Transaction;
    destinationUserId: string;
    collections: ICollectionToSave;
}) {
    if (!collections["exhibits"]) return;

    const userExhibitsRef = db
        .collection("users")
        .doc(destinationUserId)
        .collection("exhibits");

    const userExhibitsSnap = await transaction.get(userExhibitsRef);

    collections["exhibits"] = collections["exhibits"].map((exhibit) => {
        const exhibitDoc = userExhibitsSnap.docs.find(
            (doc) => doc.id === exhibit.ref.id
        );

        if (!exhibitDoc) return exhibit;

        const exhibitData = exhibitDoc.data();

        const shouldOverwriteIfOwner = !exhibitData?.invited;

        const shouldOverwriteIfAdminCurator =
            exhibit.data.privilege !== "admin-curator" &&
            !exhibit.data.isAdminCurator &&
            (exhibitData.privilege === "admin-curator" ||
                exhibitData.isAdminCurator);

        if (shouldOverwriteIfAdminCurator || shouldOverwriteIfOwner) {
            return {
                ref: exhibit.ref,
                data: exhibitData,
            };
        }

        return exhibit;
    });
}

export async function getSubcollections({
    source,
    transaction,
}: {
    transaction: FirebaseFirestore.Transaction;
    source: FirebaseFirestore.DocumentReference;
}) {
    let total = 0;

    const subcollectionsList = await source.listCollections();

    // Retrieve all subcollections of the source document

    const collections: ICollectionToSave = {};

    await Promise.all(
        subcollectionsList.map(async (collection) => {
            // const snapshot = await  collection.get();
            const snapshot = await transaction.get(collection);

            collections[collection.id] = [];

            snapshot.docs.map(async (doc) => {
                if (!doc.exists) return;

                const docData = doc.data();

                collections[collection.id].push({
                    ref: doc.ref,
                    data: docData,
                });

                total++;
            });
        })
    );

    return { collections, total };
}

export async function saveSubcollections({
    collections,
    destination,
    transaction,
}: {
    transaction: FirebaseFirestore.Transaction;
    collections: ICollectionToSave;
    destination: FirebaseFirestore.DocumentReference;
}) {
    // Save the subcollection documents to the destination collection

    await Promise.all(
        Object.keys(collections).map(async (collectionId) => {
            const docs = collections[collectionId];

            await Promise.all(
                docs.map(async (doc) => {
                    const { ref, data } = doc;

                    const destinationRef = destination
                        .collection(collectionId)
                        .doc(ref.id);

                    await transaction.set(destinationRef, data);
                })
            );
        })
    );

    console.log("Subcollections copied");
}

async function deleteSubcollections({
    collections,
    transaction,
}: {
    transaction: FirebaseFirestore.Transaction;
    collections: ICollectionToSave;
}) {
    await Promise.all(
        Object.keys(collections).map(async (collectionId) => {
            const docs = collections[collectionId];

            await Promise.all(
                docs.map(async (doc) => {
                    const { ref, data } = doc;

                    await transaction.delete(ref, data);
                })
            );
        })
    );

    console.log("Subcollections deleted");
}
