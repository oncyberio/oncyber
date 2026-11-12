import { socialServiceUrl, socialServiceHeaders } from "@utils/socialService";

export interface ContactPolicy { uid: string; allowed: boolean; activityHidden: boolean; }

async function operation(uid: string, operation: string, input: Record<string, unknown>) {
    if (!process.env.SOCIAL_SERVICE_SECRET) throw new Error("SOCIAL_POLICY_NOT_CONFIGURED");
    const response = await fetch(socialServiceUrl("/internal/oncyber/social"), {
        method: "POST", headers: socialServiceHeaders(), signal: AbortSignal.timeout(6000), redirect: "error",
        body: JSON.stringify({ identity: { uid }, operation, input }),
    });
    if (!response.ok) throw new Error("SOCIAL_POLICY_UNAVAILABLE");
    return response.json();
}

/** Server-only projection: canonical account IDs come from verified Oncyber identity. */
export async function contactPolicy(uid: string, targets: readonly string[]): Promise<Map<string, ContactPolicy>> {
    const unique = [...new Set(targets)];
    const policies = new Map<string, ContactPolicy>(unique.map(id => [id, { uid: id, allowed: false, activityHidden: true }]));
    if (!unique.length) return policies;
    const body = await operation(uid, "/friends/contact", { uids: unique });
    if (!Array.isArray(body.contacts)) throw new Error("SOCIAL_POLICY_UNAVAILABLE");
    for (const row of body.contacts) {
        if (row && policies.has(row.uid) && typeof row.allowed === "boolean" && typeof row.activityHidden === "boolean") {
            policies.set(row.uid, { uid: row.uid, allowed: row.allowed, activityHidden: !row.allowed || row.activityHidden });
        }
    }
    return policies;
}

/** Keep legacy public/hidden presence and the new friend graph's privacy consistent. */
export async function syncPresencePrivacy(uid: string, visibility: "public" | "hidden") {
    const setting = visibility === "hidden" ? "nobody" : "friends";
    const body = await operation(uid, "/friends/privacy", { presence: setting, activity: setting });
    if (body.privacy?.presence !== setting || body.privacy?.activity !== setting) throw new Error("SOCIAL_POLICY_UNAVAILABLE");
}
