import type { AuthoredAvatar } from "./types";

/**
 * Avatars written as code, one module each. Listing one here makes it
 * loadable by its address and puts it in the lobby's avatar picker. The
 * modules load on demand, so nobody downloads an avatar they never see.
 */
export const AUTHORED_AVATARS = [
    { id: "tinker", name: "Tinker" },
    { id: "moth", name: "Moth" },
    { id: "juno", name: "Juno" },
    { id: "suit", name: "Suit" },
] as const;

const LOADERS: Record<string, () => Promise<{ default: AuthoredAvatar }>> = {
    tinker: () => import("./tinker"),
    moth: () => import("./moth"),
    juno: () => import("./juno"),
    suit: () => import("./suit"),
};

export const isAuthoredAvatarId = (id: unknown): id is string =>
    typeof id === "string" && Object.hasOwn(LOADERS, id);

export async function loadAuthoredAvatar(
    id: unknown
): Promise<AuthoredAvatar | null> {
    return isAuthoredAvatarId(id) ? (await LOADERS[id]()).default : null;
}
