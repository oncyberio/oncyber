import { SOCIAL_COLLECTIONS } from "@utils/socialCollections";
/** A directed follow is display/social data. It never grants room or party access. */
export function visiblePresence(presence: any, exhibit: any, now = Date.now()) {
    if (!presence || !exhibit || !Number.isFinite(presence.expiresAt) || presence.expiresAt <= now) return null;
    const visibility = exhibit.visibility || exhibit.info?.visibility;
    if (["private", "unlisted", "draft"].includes(visibility) || exhibit.private || exhibit.isPrivate || exhibit.deleted || exhibit.hidden || exhibit.isPublic === false || exhibit.published === false || exhibit.info?.private) return null;
    const gating = exhibit.gating || {};
    if (gating.password || gating.whitelist?.length || gating.nftOwnership?.length || gating.noAnonymous || gating.date) return null;
    // Presence never contains a join credential, instance id, password or raw account.
    return { experienceId: presence.experienceId, worldId: presence.worldId, updatedAt: presence.updatedAt };
}

export class DirectedFollows {
    constructor(private db: any, private canonical: (id: string) => Promise<string>) {}
    private collection(id: string) { return this.db.collection("users").doc(id).collection(SOCIAL_COLLECTIONS.follows); }
    async list(owner: string) {
        const rows = await this.collection(owner).limit(201).get();
        if (rows.docs.length > 200) throw new Error("FOLLOW_LIMIT");
        const targets = await Promise.all(rows.docs.map((row: any) => this.canonical(row.data().targetId || row.id)));
        return [...new Set(targets)].filter((id) => id !== owner) as string[];
    }
    async set(owner: string, target: string, following: boolean) {
        target = await this.canonical(target);
        if (owner === target) throw new Error("SELF_FOLLOW");
        const collection = this.collection(owner);
        const rows = await collection.limit(201).get();
        const aliases = await Promise.all(rows.docs.map(async (row: any) => ({ ref: row.ref, target: await this.canonical(row.data().targetId || row.id) })));
        if (following && !aliases.some((row) => row.target === target) && rows.docs.length >= 200) throw new Error("FOLLOW_LIMIT");
        const batch = this.db.batch();
        for (const row of aliases) if (row.target === target) batch.delete(row.ref);
        if (following) batch.set(collection.doc(target), { targetId: target, createdAt: Date.now() });
        await batch.commit();
    }
}
