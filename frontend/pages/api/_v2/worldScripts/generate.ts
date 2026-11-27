import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import {
    aiModel,
    askForScript,
    checkAiAccess,
    editableSpace,
    recordAiUsage,
    reserveAiRequest,
    scriptsSavedAt,
    SCRIPT_CHANGED_ELSEWHERE,
    worldScriptsEnabled,
} from "@utils/worldScripts/server";
import { WORLD_SCRIPT_LIMITS } from "@features/world-scripts/basics";

const experienceId = z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/);

/** Whether this account may ask the model, and how many asks are left. */
export const access = proc({
    auth: true,
    schema: z.object({ experienceId }),
    async handler({ experienceId }) {
        if (!worldScriptsEnabled())
            return {
                allowed: false,
                earlyAccess: false,
                canEdit: false,
                reason: "Off.",
            };
        const space = await editableSpace(experienceId, this.userId);
        if (!space)
            return {
                allowed: false,
                earlyAccess: false,
                canEdit: false,
                reason: "Only this space's admins can change its scripts.",
            };
        const { allowed, earlyAccess, reason } = await checkAiAccess(
            this.userId
        );
        return { allowed, earlyAccess, reason, canEdit: true };
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
        // Checked by cleanStyle before it reaches the model.
        style: z.record(z.string(), z.unknown()).optional(),
        world: z
            .object({
                title: z.string().max(200).optional(),
                place: z.string().max(200).optional(),
                sky: z.string().max(40).optional(),
                fog: z.string().max(40).optional(),
            })
            .optional(),
        failure: z
            .object({
                source: z.string().max(WORLD_SCRIPT_LIMITS.maxSourceBytes),
                reason: z.string().max(4000),
            })
            .optional(),
        /**
         * When the script this request builds on was saved, as the page
         * knows it. Refused before the model is asked when the space's
         * script has changed since.
         */
        base: z.number().nonnegative().optional(),
    }),
    async handler(input) {
        if (!worldScriptsEnabled())
            return { ok: false as const, error: "World scripts are off here." };
        const space = await editableSpace(input.experienceId, this.userId);
        if (!space)
            return {
                ok: false as const,
                error: "Only this space's admins can change its scripts.",
            };
        const accessNow = await checkAiAccess(this.userId);
        if (!accessNow.allowed)
            return { ok: false as const, error: accessNow.reason };
        if (
            input.base != null &&
            input.base !== scriptsSavedAt(space.experience)
        )
            return { ok: false as const, error: SCRIPT_CHANGED_ELSEWHERE };
        // Counted before the call, and whatever comes of it.
        const reserved = await reserveAiRequest(this.userId);
        if (!reserved.allowed)
            return { ok: false as const, error: reserved.reason };
        const request = input.request.replace(
            /[\u0000-\u0008\u000b-\u001f\u007f]/g,
            " "
        );
        const who = { userId: this.userId, experienceId: input.experienceId };
        try {
            const { answer, usage } = await askForScript({ ...input, request });
            await recordAiUsage({ ...usage, ...who, ok: true });
            return { ok: true as const, ...answer };
        } catch (error) {
            // A call that timed out or was refused says nothing of its
            // cost: it is in the ledger all the same.
            await recordAiUsage({
                model: aiModel(),
                promptTokens: 0,
                completionTokens: 0,
                costUsd: null,
                ...(error as any).usage,
                ...who,
                ok: false,
            });
            return { ok: false as const, error: (error as Error).message };
        }
    },
});

export default NoApi;
