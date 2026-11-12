/**
 * Firestore collections for the social layer (follows, presence, parties and
 * merged account identities). Deployments that already hold this data under
 * other names set SOCIAL_COLLECTION_PREFIX; new deployments use "social".
 */
const prefix = process.env.SOCIAL_COLLECTION_PREFIX || "social";

export const SOCIAL_COLLECTIONS = {
    accountRedirects: `${prefix}AccountRedirects`,
    identityRoots: `${prefix}IdentityRoots`,
    follows: `${prefix}Follows`,
    parties: `${prefix}Parties`,
    partyInvitations: `${prefix}PartyInvitations`,
    partyMemberships: `${prefix}PartyMemberships`,
    presence: `${prefix}Presence`,
    settings: `${prefix}Settings`,
} as const;
