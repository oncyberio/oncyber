import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import {
    earlyAccessPeople,
    grantEarlyAccess,
    isSiteAdmin,
    revokeEarlyAccess,
    worldScriptsEnabled,
} from "@utils/worldScripts/server";

const OFF = { ok: false as const, error: "World scripts are off here." };
const NOT_ADMIN = {
    ok: false as const,
    error: "Only Oncyber's site admins can say who is in early access.",
};
const who = z.object({ who: z.string().trim().min(1).max(200) });

/**
 * Who is in early access for world scripts, for a site admin to read
 * (`pnpm world script access`, docs/world-scripts.md). Site admins are
 * always in and are not listed.
 */
export const people = proc({
    auth: true,
    schema: z.object({}),
    async handler() {
        if (!worldScriptsEnabled()) return OFF;
        if (!isSiteAdmin(this.userId)) return NOT_ADMIN;
        return { ok: true as const, ...(await earlyAccessPeople()) };
    },
});

/** A site admin adds an account, named by id, wallet or username. */
export const grant = proc({
    auth: true,
    schema: who,
    async handler({ who }) {
        if (!worldScriptsEnabled()) return OFF;
        if (!isSiteAdmin(this.userId)) return NOT_ADMIN;
        const person = await grantEarlyAccess(who, this.userId);
        if (!person)
            return {
                ok: false as const,
                error: `No account goes by "${who}".`,
            };
        return { ok: true as const, person };
    },
});

/** A site admin takes an account out again. */
export const revoke = proc({
    auth: true,
    schema: who,
    async handler({ who }) {
        if (!worldScriptsEnabled()) return OFF;
        if (!isSiteAdmin(this.userId)) return NOT_ADMIN;
        return { ok: true as const, ...(await revokeEarlyAccess(who)) };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
