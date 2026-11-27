import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import {
    editableSpace,
    scriptsSavedAt,
    scriptsSavedMark,
    worldScriptsEnabled,
} from "@utils/worldScripts/server";
import { WORLD_SCRIPT_LIMITS } from "@features/world-scripts/basics";
import { WORLD_SCRIPT_REFERENCE } from "@features/world-scripts/brief";
import { SCRIPT_GLOBALS } from "@features/world-scripts/scriptApi";
import { cleanStyle } from "@features/world-scripts/style";
import { db } from "@utils/firebaseAdmin";

const OFF = { ok: false as const, error: "World scripts are off here." };

/**
 * What a script is written against, for someone writing one outside the
 * sidebar (`pnpm world script reference`, docs/world-scripts.md): the same
 * reference the model is given, the names a script is handed, and the
 * limit on its length.
 */
export const reference = proc({
    auth: true,
    schema: z.object({}),
    async handler() {
        if (!worldScriptsEnabled()) return OFF;
        return {
            ok: true as const,
            reference: WORLD_SCRIPT_REFERENCE,
            names: [...SCRIPT_GLOBALS],
            maxSourceBytes: WORLD_SCRIPT_LIMITS.maxSourceBytes,
        };
    },
});

/**
 * A space's script as it is saved, for one of the space's admins to carry
 * on from (`pnpm world script pull`). `savedAt` is what the next save says
 * it builds on (./save.ts).
 */
export const get = proc({
    auth: true,
    schema: z.object({
        experienceId: z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/),
    }),
    async handler({ experienceId }) {
        if (!worldScriptsEnabled()) return OFF;
        const space = await editableSpace(experienceId, this.userId);
        if (!space)
            return {
                ok: false as const,
                error: "Only this space's admins can read its script here.",
            };
        const saved = Array.isArray(space.experience.worldScripts)
            ? space.experience.worldScripts
            : [];
        return {
            ok: true as const,
            scripts: saved
                .filter((script) => typeof script?.source === "string")
                .map((script) => ({
                    id: String(script.id),
                    name: String(script.name || "World script"),
                    source: script.source as string,
                    enabled: script.enabled !== false,
                })),
            style: cleanStyle(space.experience.worldStyle) || null,
            savedAt: scriptsSavedAt(space.experience),
        };
    },
});

/**
 * The script a space runs now, for a world that is open and has heard of a
 * save (features/world-scripts/livePickup.ts). Anyone may ask: it is what
 * the space's page hands every visitor when it loads, gated or not, and
 * nothing more (no ids, names or who saved it).
 */
export const current = proc({
    auth: false,
    schema: z.object({
        experienceId: z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/),
    }),
    async handler({ experienceId }) {
        if (!worldScriptsEnabled()) return OFF;
        // Only what is asked for is read: the document is large, and this
        // is asked by every open space each time its script is saved.
        const [document] = await db.getAll(
            db.collection("exhibits").doc(experienceId),
            {
                fieldMask: [
                    "worldScripts",
                    "worldStyle",
                    "worldScriptsSavedAt",
                    "deleted",
                ],
            }
        );
        const experience = document?.exists ? document.data() : null;
        if (!experience || experience.deleted === true)
            return { ok: false as const, error: "This space doesn't exist." };
        const saved = Array.isArray(experience.worldScripts)
            ? experience.worldScripts
            : [];
        const running = saved.find(
            (script: any) =>
                script?.enabled !== false && typeof script?.source === "string"
        );
        return {
            ok: true as const,
            source: (running?.source as string) || "",
            style: cleanStyle(experience.worldStyle) || null,
            savedAt: scriptsSavedMark(experience),
        };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
