import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";
import { Experience } from "@uitypes/experience";
import { getExhibitById } from "pages/api/exhibit";

/**
 * Minimal snapshot-before-bulk-write primitive. There is no versioning,
 * history, or rollback mechanism anywhere in the exhibit pipeline today
 * (`_version` on a kitbash item is just a last-write-wins change-detection
 * timestamp, overwritten not appended) — so before this pass, "undo a bad
 * AI-generated batch" had nothing to build on. This captures current
 * `kitbash`/`artworks` under `exhibits/{id}/snapshots/{snapshotId}`; the CLI
 * calls `create` before a bulk `push`. Restoring is manual for this pass
 * (read the snapshot doc, hand it back through `update`'s patches) — a
 * restore UI is Workstream C's "named version snapshots", not this one.
 */

function isEditorOrOwner(exhibit: Experience, userId: string) {
    if (exhibit.owner?.toLowerCase() === userId?.toLowerCase()) return true;
    return exhibit.editors?.some((id) => id.toLowerCase() === userId?.toLowerCase());
}

export const create = proc({
    auth: true,
    cors: true,

    schema: z.object({
        id: z.string().min(1),
        label: z.string().max(200).optional(),
    }),

    async handler({ id, label }) {
        const exhibit = await getExhibitById(id);

        if (!exhibit) {
            throw new Error("Exhibit not found");
        }

        if (!isEditorOrOwner(exhibit, this.userId)) {
            throw new Error("Forbidden");
        }

        const snapshotId = String(Date.now());

        await db
            .collection("exhibits")
            .doc(id)
            .collection("snapshots")
            .doc(snapshotId)
            .set({
                id: snapshotId,
                createdAt: Date.now(),
                createdBy: this.userId,
                label: label ?? null,
                kitbash: exhibit.kitbash ?? {},
                artworks: exhibit.artworks ?? {},
            });

        return { id: snapshotId };
    },
});

export const list = proc({
    auth: true,
    cors: true,

    schema: z.object({
        id: z.string().min(1),
    }),

    async handler({ id }) {
        const exhibit = await getExhibitById(id);

        if (!exhibit) {
            throw new Error("Exhibit not found");
        }

        if (!isEditorOrOwner(exhibit, this.userId)) {
            throw new Error("Forbidden");
        }

        const snap = await db
            .collection("exhibits")
            .doc(id)
            .collection("snapshots")
            .orderBy("createdAt", "desc")
            .limit(50)
            .get();

        return snap.docs.map((d) => {
            const data = d.data();
            return {
                id: data.id,
                createdAt: data.createdAt,
                createdBy: data.createdBy,
                label: data.label,
            };
        });
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
