import type { WorldMod, WorldModContext } from "./types";

export type { WorldMod, WorldModContext } from "./types";

/**
 * Worlds with custom code, by slug (lower case). Each one is its own chunk,
 * loaded only when that world opens, so the rest of the site never ships it.
 * To add one: a folder under worlds/<slug>/ whose index.ts default-exports a
 * WorldMod, and a line here.
 */
const WORLD_MODS: Record<string, () => Promise<{ default: WorldMod }>> = {
    thestarrynight_skydome: () => import("./worlds/thestarrynight_skydome"),
};

export function hasWorldMod(slug: string | null | undefined) {
    return typeof slug === "string" && slug.toLowerCase() in WORLD_MODS;
}

/**
 * Runs the world's mod, if it has one. Never rejects: a failing mod logs and
 * leaves the world as the engine made it.
 */
export async function applyWorldMod(
    slug: string | null | undefined,
    context: Omit<WorldModContext, "slug">,
    mods: typeof WORLD_MODS = WORLD_MODS
): Promise<void> {
    if (typeof slug !== "string") return;
    const key = slug.toLowerCase();
    const load = mods[key];
    if (!load) return;
    try {
        const { default: mod } = await load();
        await mod.onBackground?.({ ...context, slug: key });
    } catch (error) {
        console.warn(`World mod for ${key} failed`, error);
    }
}
