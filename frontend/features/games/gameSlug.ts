/**
 * A game's short address. The owner's rule: a game is at /games/<id>, and
 * also at /<slug> once it has one (a space is at /spaces/<id> until its
 * link is set). This file is the pure part; who holds which name is
 * gameSlugServer.ts.
 *
 * One space of names. `/<name>` is shared by the site's own pages and
 * redirects, spaces (their `customLink`), profiles (always `/@name`, which
 * no slug can spell) and games. Nothing is claimed twice:
 *
 *   - a catalogued game's slug (`page.slug` in game.json) is generated into
 *     catalog.slugs.json, which makes it one of the site's reserved links
 *     (utils/reservedLinks.js): no space can take it, and building the
 *     catalog fails on a slug that is a page of the site or another game's;
 *   - a published game's slug is on its record, claimed in a transaction
 *     that looks at spaces and at the other games; a space claiming a link
 *     looks at the games the same way.
 *
 * When a slug is set, /<slug> is the game's canonical address: both
 * addresses answer, and both say so in their canonical link.
 */
import { isReservedLink } from "@utils/reservedLinks";
import { GAMES, type GameEntry } from "./catalog";

/**
 * 3 to 40 lowercase letters and digits, in words joined by single dashes.
 * The same rule as `GAME_SLUG` in scripts/games/listing.mjs.
 */
export const GAME_SLUG = /^(?=.{3,40}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Why a name cannot be a game's slug, or null. Who holds it is asked elsewhere. */
export function gameSlugProblem(slug: unknown): string | null {
    if (typeof slug !== "string" || !GAME_SLUG.test(slug))
        return "A game's link is 3 to 40 lowercase letters and digits, in words joined by single dashes.";
    // The site's pages and redirects, and the catalogued games' own slugs.
    if (isReservedLink(slug)) return `/${slug} is taken; choose another link.`;
    return null;
}

/** The catalogued game at /<slug>, if one has that slug. Lower case only. */
export function catalogGameBySlug(
    slug: unknown,
    catalog: Record<string, GameEntry> = GAMES
): GameEntry | null {
    if (typeof slug !== "string" || !GAME_SLUG.test(slug)) return null;
    return Object.values(catalog).find((game) => game.slug === slug) ?? null;
}

/** A game's address on the site: its slug when it has one. */
export function gamePath(game: { id: string; slug?: string | null }): string {
    return game.slug && GAME_SLUG.test(game.slug)
        ? `/${game.slug}`
        : `/games/${game.id}`;
}
