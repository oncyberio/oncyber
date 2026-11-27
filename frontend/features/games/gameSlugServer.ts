/**
 * Who holds a short address among the games published from outside the
 * repository (gameSlug.ts has the rule and the rest of the name space).
 *
 * One document per claimed slug in the `gameLinks` collection, named by
 * the slug: `{ game, owner, claimedAt }`. It is written only in the
 * transaction that puts the slug on the game's record
 * (publishedGamesServer.ts, `setGameLink`), which also looks for a space
 * with that link; and it is read here by a space that wants a link, so
 * neither can take a name the other holds. Only the Admin SDK touches the
 * collection. No index is needed: every read is one document by its name.
 *
 * Kept apart from publishedGamesServer.ts so the procedures that set a
 * space's link load this and nothing else of the registry.
 */
import { db } from "@utils/firebaseAdmin";
import { GAME_SLUG } from "./gameSlug";

export const GAME_LINKS = "gameLinks";

/** The document a slug's claim is kept in. */
export const gameLinkRef = (slug: string) =>
    db.collection(GAME_LINKS).doc(slug);

/**
 * Whether a published game holds this name. Asked by a space claiming a
 * link (`get` is the transaction's read where there is one). Names are
 * compared in lower case: a game's slug is always lower case, and a space
 * may not take one by spelling it with capitals.
 */
export async function publishedGameHoldsLink(
    link: unknown,
    get: (
        ref: FirebaseFirestore.DocumentReference
    ) => Promise<{ exists: boolean }> = (ref) => ref.get()
): Promise<boolean> {
    const name = typeof link === "string" ? link.trim().toLowerCase() : "";
    if (!GAME_SLUG.test(name)) return false;
    return (await get(gameLinkRef(name))).exists;
}
