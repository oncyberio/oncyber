import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db, fire } from "@utils/firebaseAdmin";
import { getMimeType } from "@utils/mimeUtils";
import { Asset } from "@uitypes/Asset";
import { MAX_UPLOADS, readUploadIndex } from "./uploadIndex";

export interface UserAssetUpload {
    name: string;
    hash: string;
    url: string;
    d_optimized_files?: Asset["d_optimized_files"];
    mimeType: string;
    createdAt: number;
    lastModified: number;
}

//? Used to get all uploaded artworks of a user
//? used in add any artwork

// The library read is capped at MAX_UPLOADS docs (in document-id order —
// createdAt/lastModified are unreliable on these docs) and, for the default
// no-cursor call, served from the single caches/upload-index-{userId} doc
// (see ./uploadIndex.ts) so a picker open costs 1 read instead of up to
// MAX_UPLOADS. Callers can still page through with `cursor` (the last hash of
// the previous page) + `limit` — paged calls keep the direct query.

function normalizeUploads(items: any[]): Array<UserAssetUpload> {
    return items
        .map((x) => {
            //
            let data = { ...x } as UserAssetUpload;

            if (!data.createdAt) {
                data.createdAt = 0;
            }

            if (!data.mimeType) {
                data.mimeType = getMimeType(data.url);
            }

            if (!data.lastModified) {
                data.lastModified = 0;
            }

            return data;
            //
        })
        .filter((x) => {
            //
            return x.mimeType;
        });
}

export const getUploadedAssets = proc({
    cors: true,
    auth: true,

    // Both optional — calling with `{}` returns the first MAX_UPLOADS docs,
    // identical to the original (un-paginated) behavior.
    schema: z.object({
        limit: z.number().int().positive().max(MAX_UPLOADS).optional(),
        cursor: z.string().optional(),
    }),

    async handler(opts): Promise<Array<UserAssetUpload>> {
        //
        // Default (no-cursor, no-limit) call: serve the whole capped library
        // from the index doc. Falls back to the direct query when the library
        // can't be indexed (oversized).
        if (!opts?.cursor && opts?.limit == null) {
            const indexed = await readUploadIndex(this.userId);
            if (indexed) return normalizeUploads(indexed);
        }

        // Explicit document-id order (matches the previous implicit order) so
        // `startAfter(cursor)` paginates deterministically.
        let contentDBRef = db
            .collection("users")
            .doc(this.userId)
            .collection("assets-upload-content")
            .orderBy(fire.FieldPath.documentId())
            .limit(opts?.limit ?? MAX_UPLOADS);

        if (opts?.cursor) {
            contentDBRef = contentDBRef.startAfter(opts.cursor);
        }

        let contentDBDoc = await contentDBRef.get();

        if (contentDBDoc?.empty) return [];

        return normalizeUploads(contentDBDoc.docs.map((x) => x.data()));
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
