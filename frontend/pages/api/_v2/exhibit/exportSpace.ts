import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { getExhibitByCustomLink, getExhibitById } from "pages/api/exhibit";
import { getDestinationBySlug } from "@utils/firestore/destinations";
import { isSiteAdmin } from "@utils/siteAdmins";
import {
    isBuiltInRoom,
    portableDestination,
    portableSpace,
    PortableSpace,
} from "@utils/worldContent/portable";

const same = (a?: string, b?: string) =>
    !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * A whole space and the world it is built on, for a copy in a developer's
 * local stack (`pnpm world import`, local-dev/import.mjs). `get` beside
 * this returns only what the terminal's pull and push edit.
 *
 * For the space's owner and editors, and for a site admin, who is asked to
 * debug other people's spaces. Nobody else: a gated space's content must
 * not leave through here.
 */
export const exportSpace = proc({
    auth: true,
    cors: true,

    schema: z
        .object({
            id: z.string().min(1).max(200).optional(),
            link: z.string().min(1).max(200).optional(),
        })
        .refine((input) => !!input.id !== !!input.link, {
            message: "give the space's id or its link, one of them",
        }),

    async handler({ id, link }): Promise<PortableSpace> {
        const exhibit = id
            ? await getExhibitById(id)
            : await getExhibitByCustomLink(link);
        // One answer for "no such space" and "not yours": a link says
        // nothing about a space to someone who may not copy it.
        const allowed =
            !!exhibit &&
            (same(exhibit.owner, this.userId) ||
                exhibit.editors?.some((editor) => same(editor, this.userId)) ||
                isSiteAdmin(this.userId));
        if (!allowed)
            throw new Error(
                "No space of yours by that id or link. A copy is for the space's owner and editors."
            );

        const room = exhibit.info?.room;
        const destination = isBuiltInRoom(room)
            ? null
            : await getDestinationBySlug(room);

        return {
            id: exhibit.id,
            space: portableSpace(exhibit),
            destination: portableDestination(destination),
        };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
