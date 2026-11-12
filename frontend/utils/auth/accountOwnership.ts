/**
 * What "owns an account" means for the account endpoints: the request's
 * verified session token (`this.userId` in a procedure, the `user` claim of
 * the JWT issued at sign-in) names that account. Account ids compare
 * case-insensitively, because the session keeps the original casing while
 * wallet ids are stored lowercased.
 *
 * Linking and merging both write to the account being linked or merged INTO,
 * so both ask for this proof of that account. Control of the other account
 * (the one being attached) is proved separately, by its signature or id
 * token (`validateSig`).
 */
export function isSignedInAs(sessionUserId: unknown, accountId: unknown) {
    return (
        typeof sessionUserId === "string" &&
        typeof accountId === "string" &&
        sessionUserId !== "" &&
        sessionUserId.toLowerCase() === accountId.toLowerCase()
    );
}

/**
 * The fields of a user document that say which accounts it stands for. Only
 * sign-in, link, unlink and merge write them (after the proof above); a
 * profile update that carried them could claim someone else's wallet.
 */
export const ACCOUNT_IDENTITY_FIELDS = ["linkedAccounts", "linkedAccountsData"];

/** Does a user-document update try to write one of those fields? */
export function writesAccountIdentity(payload: unknown) {
    if (!payload || typeof payload !== "object") return false;
    return Object.keys(payload).some((key) =>
        // Firestore reads "a.b" as a path into field "a".
        ACCOUNT_IDENTITY_FIELDS.includes(key.split(".")[0])
    );
}
