//
import { isEditor } from "@utils/exhibit";
import { NoApi, proc } from "@utils/rpc/server";
import { z } from "zod";
import { getExhibitByCustomLink } from "../../exhibit";
import { ADMINS } from "@utils/siteAdmins";

export { ADMINS };

export async function checkMod(
    userId: string,
    spaceId: string
): Promise<boolean> {
    //
    if (ADMINS.includes(userId?.toLowerCase?.())) {
        return true;
    }

    const exhibit = await getExhibitByCustomLink(spaceId);

    if (exhibit == null) {
        throw new Error("Exhibit not found " + spaceId);
    }

    userId = userId?.toLowerCase?.();

    return exhibit.owner?.toLowerCase?.() === userId || isEditor(exhibit, userId);
}

export async function checkVoiceRights(spaceId: string): Promise<boolean> {
    // Asuming you checked mod first if you call this function

    const exhibit = await getExhibitByCustomLink(spaceId);

    if (exhibit == null) {
        throw new Error("Exhibit not found " + spaceId);
    }

    return exhibit?.params?.voiceAllowed;
}

export const isMod = proc({
    // schema
    schema: z.object({
        slug: z.string().min(1),
    }),

    // handler
    async handler({ slug }) {
        return checkMod(this.userId, slug);
    },
});

export default NoApi;
