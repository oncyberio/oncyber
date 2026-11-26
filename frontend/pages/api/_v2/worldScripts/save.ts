import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";
import { cleanStyle } from "@features/world-scripts/style";
import {
    hasEarlyAccess,
    isSpaceAdmin,
    scriptsSavedAt,
    SCRIPT_CHANGED_ELSEWHERE,
    worldScriptsEnabled,
} from "@utils/worldScripts/server";
import {
    byteLength,
    WORLD_SCRIPT_LIMITS,
} from "@features/world-scripts/basics";
import type { WorldScriptRecord } from "@features/world-scripts/protocol";

const L = WORLD_SCRIPT_LIMITS;

const scriptSchema = z.object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
    name: z.string().trim().min(1).max(40),
    source: z
        .string()
        .max(L.maxSourceBytes)
        .refine(
            (source) => byteLength(source) <= L.maxSourceBytes,
            "The script is too long."
        ),
    enabled: z.boolean(),
});

/**
 * Replaces a space's scripts. This is the only way they are written (the
 * space's other updates refuse these fields, utils/firestore/exhibitWrites).
 *
 * For the space's admins, checked in the write. Putting a script or a style
 * on a space is in early access, as asking the model for one is; taking a
 * space's scripts away (an empty list) is its admins' to do whenever.
 *
 * `base` is when the script the caller started from was saved (0 for none).
 * A save that builds on something older than what the space has now is
 * refused with `conflict`, so one editor does not write over another's
 * change without seeing it.
 */
export const save = proc({
    auth: true,
    schema: z.object({
        experienceId: z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/),
        // One script to a space: a list, as it is stored, of one or none.
        scripts: z.array(scriptSchema).max(1).optional(),
        /** The world's creative direction; checked by cleanStyle. */
        style: z.record(z.string(), z.unknown()).optional(),
        base: z.number().nonnegative().optional(),
    }),
    async handler({ experienceId, scripts, style: rawStyle, base }) {
        const style = rawStyle ? cleanStyle(rawStyle) : null;
        if (rawStyle && !style)
            return { ok: false as const, error: "That style isn't valid." };
        if (!scripts && !style)
            return { ok: false as const, error: "Nothing to save." };
        if (!worldScriptsEnabled())
            return { ok: false as const, error: "World scripts are off here." };
        const adding = !!style || !!scripts?.length;
        if (adding && !(await hasEarlyAccess(this.userId)))
            return {
                ok: false as const,
                error: "World scripts are in early access for now.",
            };
        const userId = this.userId.toLowerCase();
        const ref = db.collection("exhibits").doc(experienceId);
        const now = Date.now();
        let records: WorldScriptRecord[] | null = null;
        const refused = await db.runTransaction(async (transaction) => {
            const document = await transaction.get(ref);
            if (!document.exists || document.data().deleted === true)
                return { error: "This space doesn't exist." };
            const experience = document.data();
            if (!isSpaceAdmin(experience, userId))
                return {
                    error: "Only this space's admins can change its scripts.",
                };
            const savedAt = scriptsSavedAt(experience);
            if (scripts && base != null && base !== savedAt)
                return { error: SCRIPT_CHANGED_ELSEWHERE, conflict: true };
            records = scripts ? stamped(scripts, now, savedAt) : null;
            transaction.update(ref, {
                ...(records ? { worldScripts: records } : {}),
                ...(style ? { worldStyle: style } : {}),
                worldScriptsUpdatedBy: userId,
                lastUpdatedAt: now,
            });
            return null;
        });
        if (refused) return { ok: false as const, ...refused };
        return {
            ok: true as const,
            // Set in the transaction, which the compiler does not follow.
            scripts: records as WorldScriptRecord[] | null,
            style,
        };
    },
});

/**
 * The scripts as they are stored: each with the time of this save, which
 * is always later than the one before it (two saves in one millisecond, a
 * clock set back), so `base` tells them apart.
 */
function stamped(
    scripts: z.infer<typeof scriptSchema>[],
    now: number,
    savedAt: number
): WorldScriptRecord[] {
    const updatedAt = Math.max(now, savedAt + 1);
    return scripts.map((script) => ({ ...script, updatedAt } as any));
}

export default NoApi;
