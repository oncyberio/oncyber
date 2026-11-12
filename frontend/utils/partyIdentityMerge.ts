import { createHash } from "crypto";
import { db } from "@utils/firebaseAdmin";
import { SOCIAL_COLLECTIONS } from "@utils/socialCollections";

/** Prepare all reads before the enclosing account merge starts writing. */
export async function preparePartyIdentityMerge(tx: any, sourceId: string, destinationId: string) {
    if (sourceId === destinationId) return () => {};
    const membership = db.collection(SOCIAL_COLLECTIONS.partyMemberships), parties = db.collection(SOCIAL_COLLECTIONS.parties);
    const sourceRef = membership.doc(sourceId), destinationRef = membership.doc(destinationId);
    const [sourceMember, destinationMember, incoming] = await Promise.all([
        tx.get(sourceRef), tx.get(destinationRef),
        tx.get(db.collection(SOCIAL_COLLECTIONS.partyInvitations).where("toId", "==", sourceId).where("state", "==", "pending")),
    ]);
    const sourcePartyId = sourceMember.data()?.partyId, destinationPartyId = destinationMember.data()?.partyId;
    const [sourcePartyDoc, destinationPartyDoc] = await Promise.all([
        sourcePartyId ? tx.get(parties.doc(sourcePartyId)) : null,
        destinationPartyId && destinationPartyId !== sourcePartyId ? tx.get(parties.doc(destinationPartyId)) : null,
    ]);
    const sourceParty = sourcePartyDoc?.data();
    const destinationParty = destinationPartyId === sourcePartyId ? sourceParty : destinationPartyDoc?.data();
    const destinationHasParty = destinationParty && !destinationParty.closed && destinationParty.members?.[destinationId];
    let moveMembership = false;
    let changedParty: any;
    if (sourceParty && !sourceParty.closed && sourceParty.members?.[sourceId]) {
        changedParty = { ...sourceParty, members: { ...sourceParty.members }, version: (sourceParty.version || 0) + 1 };
        const prior = changedParty.members[sourceId];
        delete changedParty.members[sourceId];
        delete changedParty.pendingMove;
        if (changedParty.destination) changedParty.destination = { ...changedParty.destination, unavailableAt: Date.now() };
        if (!destinationHasParty || destinationPartyId === sourcePartyId) {
            changedParty.members[destinationId] ||= { ...prior, id: destinationId };
            if (changedParty.leaderId === sourceId) changedParty.leaderId = destinationId;
            moveMembership = true;
        } else {
            const remaining: any[] = Object.values(changedParty.members).sort((a: any, b: any) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
            if (!remaining.length) changedParty.closed = true;
            else if (changedParty.leaderId === sourceId) changedParty.leaderId = remaining[0].id;
        }
    }
    const invitations = await Promise.all(incoming.docs.map(async (doc: any) => {
        const invitation = doc.data();
        const id = createHash("sha256").update(`${invitation.partyId}:${destinationId}`).digest("hex").slice(0, 32);
        const ref = db.collection(SOCIAL_COLLECTIONS.partyInvitations).doc(id);
        const existing = await tx.get(ref);
        return { doc, invitation, id, ref, existing: existing.data() };
    }));
    return () => {
        tx.delete(sourceRef);
        if (changedParty) tx.set(parties.doc(sourcePartyId), changedParty);
        if (moveMembership) tx.set(destinationRef, { partyId: sourcePartyId });
        for (const { doc, invitation, id, ref, existing } of invitations) {
            tx.delete(doc.ref);
            if (existing && ["pending", "accepted"].includes(existing.state)) continue;
            // Merging never accepts an invitation. Keep an existing canonical
            // invitation, otherwise move the pending request to its canonical key.
            tx.set(ref, { ...invitation, id, toId: destinationId,
                state: invitation.fromId === destinationId || invitation.fromId === sourceId ? "declined" : "pending" });
        }
    };
}
