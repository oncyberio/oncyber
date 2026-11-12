import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { Experience } from "@uitypes/experience";
import { getExhibitById } from "pages/api/exhibit";

/**
 * Read path for the terminal `pull`/`push` CLI (see `scripts/world-cli.mjs`)
 * — there wasn't one: the browser studio always reads exhibits live via
 * Firestore's `onSnapshot` (`ExhibitStore.ts`), which a plain Node script
 * can't do without shipping Firestore client credentials to a terminal. This
 * reuses the same cached `getExhibitById` the SSR path already reads
 * through, and returns only the fields the CLI's pull/push loop needs, not
 * the full resolved view (portal destinations, owner data, etc).
 */

function isEditorOrOwner(exhibit: Experience, userId: string) {
    if (exhibit.owner?.toLowerCase() === userId?.toLowerCase()) return true;
    return exhibit.editors?.some((id) => id.toLowerCase() === userId?.toLowerCase());
}

export const get = proc({
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

        return {
            id: exhibit.id,
            info: exhibit.info,
            artworks: exhibit.artworks ?? {},
            kitbash: exhibit.kitbash ?? {},
        };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
