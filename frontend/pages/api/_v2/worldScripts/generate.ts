import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import {
    askForScript,
    checkAiAccess,
    editableSpace,
    recordAiUsage,
    worldScriptsEnabled,
} from "@utils/worldScripts/server";
import { WORLD_SCRIPT_LIMITS } from "@features/world-scripts/protocol";

const experienceId = z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/);

/** Whether this account may ask the model, and how many asks are left. */
export const access = proc({
    auth: true,
    schema: z.object({ experienceId }),
    async handler({ experienceId }) {
        if (!worldScriptsEnabled())
            return { allowed: false, canEdit: false, reason: "Off." };
        const space = await editableSpace(experienceId, this.userId);
        if (!space)
            return {
                allowed: false,
                canEdit: false,
                reason: "Only this space's owner and editors can change its scripts.",
            };
        return { ...(await checkAiAccess(this.userId)), canEdit: true };
    },
});

/** Writes or changes a script from the creator's request. Nothing is saved. */
export const generate = proc({
    auth: true,
    schema: z.object({
        experienceId,
        request: z.string().trim().min(1).max(1200),
        currentSource: z
            .string()
            .max(WORLD_SCRIPT_LIMITS.maxSourceBytes)
            .optional(),
        artworks: z
            .array(
                z.object({ id: z.string().max(200), name: z.string().max(120) })
            )
            .max(200)
            .optional(),
    }),
    async handler(input) {
        if (!worldScriptsEnabled())
            return { ok: false as const, error: "World scripts are off here." };
        const space = await editableSpace(input.experienceId, this.userId);
        if (!space)
            return {
                ok: false as const,
                error: "Only this space's owner and editors can change its scripts.",
            };
        const accessNow = await checkAiAccess(this.userId);
        if (!accessNow.allowed)
            return { ok: false as const, error: accessNow.reason };
        const request = input.request.replace(
            /[\u0000-\u0008\u000b-\u001f\u007f]/g,
            " "
        );
        try {
            const { answer, usage } = await askForScript({ ...input, request });
            await recordAiUsage({
                ...usage,
                userId: this.userId,
                experienceId: input.experienceId,
                ok: true,
            });
            return {
                ok: true as const,
                ...answer,
                remaining: accessNow.remaining - 1,
            };
        } catch (error) {
            const usage = (error as any).usage;
            if (usage)
                await recordAiUsage({
                    ...usage,
                    userId: this.userId,
                    experienceId: input.experienceId,
                    ok: false,
                });
            return { ok: false as const, error: (error as Error).message };
        }
    },
});

export default NoApi;
