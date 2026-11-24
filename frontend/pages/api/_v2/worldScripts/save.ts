import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";
import { cleanStyle } from "@features/world-scripts/style";
import { worldScriptsEnabled } from "@utils/worldScripts/server";
import {
    byteLength,
    WorldScriptRecord,
    WORLD_SCRIPT_LIMITS,
} from "@features/world-scripts/protocol";

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
    prompt: z.string().max(1200).optional(),
});

/** Replaces a space's scripts. Owners and editors only, checked in the write. */
export const save = proc({
    auth: true,
    schema: z.object({
        experienceId: z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/),
        scripts: z.array(scriptSchema).max(L.maxScriptsPerSpace).optional(),
        /** The world's creative direction; checked by cleanStyle. */
        style: z.record(z.string(), z.unknown()).optional(),
    }),
    async handler({ experienceId, scripts, style: rawStyle }) {
        const style = rawStyle ? cleanStyle(rawStyle) : null;
        if (rawStyle && !style)
            return { ok: false as const, error: "That style isn't valid." };
        if (!scripts && !style)
            return { ok: false as const, error: "Nothing to save." };
        if (!worldScriptsEnabled())
            return { ok: false as const, error: "World scripts are off here." };
        const userId = this.userId.toLowerCase();
        const ref = db.collection("exhibits").doc(experienceId);
        const now = Date.now();
        const records: WorldScriptRecord[] | null = scripts
            ? scripts.map((script) => ({ ...script, updatedAt: now }))
            : null;
        const error = await db.runTransaction(async (transaction) => {
            const document = await transaction.get(ref);
            if (!document.exists || document.data().deleted === true)
                return "This space doesn't exist.";
            const experience = document.data();
            const editors = [experience.owner, ...(experience.editors || [])];
            if (
                !editors.some(
                    (editor) =>
                        typeof editor === "string" &&
                        editor.toLowerCase() === userId
                )
            )
                return "Only this space's owner and editors can change its scripts.";
            transaction.update(ref, {
                ...(records ? { worldScripts: records } : {}),
                ...(style ? { worldStyle: style } : {}),
                worldScriptsUpdatedBy: userId,
                lastUpdatedAt: now,
            });
            return null;
        });
        if (error) return { ok: false as const, error };
        return { ok: true as const, scripts: records, style };
    },
});

export default NoApi;
