/**
 * What a browser may know about a world's password: that there is one, the
 * message shown with the prompt, and a revision that changes whenever the
 * password does. The password itself, and its hash, stay on the server
 * (`exhibitSecrets/{exhibitId}`, see ./server.ts).
 *
 * Shapes of `gating.password` in an exhibit document:
 * - `{ message, rev }`: current. `rev` is random, not derived from the
 *   password, so it cannot be used to check a guess offline.
 * - `{ message, password }`: older documents, from before passwords were
 *   hashed. They are migrated on the next save, on the next check, or by
 *   `tasks/world-passwords`; until then every read strips them.
 * - `{ message }` (no password, no rev): a message without a password, which
 *   has never been enforced.
 *
 * Pure: safe to import from the browser and from the server.
 */

/** Revision a browser sees for a document that still holds a plain value. */
export const UNMIGRATED_REV = "unmigrated";

type PasswordGate = { message?: string; password?: string; rev?: string };
type AnyGating = { password?: PasswordGate | null; [key: string]: any };

const filled = (value: unknown): value is string =>
    typeof value === "string" && value.length > 0;

/** Does entering this world need a password? Either shape counts. */
export function hasWorldPassword(gating: AnyGating | null | undefined) {
    const gate = gating?.password;
    if (!gate || typeof gate !== "object") return false;
    return filled(gate.rev) || filled(gate.password);
}

/**
 * The password's current revision, or null when unknown (no password, or a
 * document not migrated yet). Two revisions only mean a change when both are
 * known: migrating a document is not a password change.
 */
export function worldPasswordRevision(
    gating: AnyGating | null | undefined
): string | null {
    if (!hasWorldPassword(gating)) return null;
    const rev = gating.password.rev;
    return filled(rev) && rev !== UNMIGRATED_REV ? rev : null;
}

/** Did the world get a password, or a new one, between two reads? */
export function worldPasswordChanged(
    before: AnyGating | null | undefined,
    after: AnyGating | null | undefined
) {
    const b = worldPasswordRevision(after);
    if (!b) return false;
    if (!hasWorldPassword(before)) return true;
    const a = worldPasswordRevision(before);
    return !!a && a !== b;
}

/** The gating settings without anything that reveals or checks a password. */
export function publicGating<T extends AnyGating>(gating: T): T {
    if (!gating || typeof gating !== "object") return gating;
    const gate = gating.password;
    if (!gate || typeof gate !== "object") return gating;
    if (Object.keys(gate).every((key) => key === "message" || key === "rev"))
        return gating;
    const safe: PasswordGate = {};
    if (typeof gate.message === "string") safe.message = gate.message;
    if (filled(gate.rev)) safe.rev = gate.rev;
    else if (filled(gate.password)) safe.rev = UNMIGRATED_REV;
    return { ...gating, password: safe };
}

/** A copy of the exhibit whose gating carries no secret. */
export function stripExhibitSecrets<T>(exhibit: T): T {
    const gating = (exhibit as any)?.gating;
    if (!gating || typeof gating !== "object" || !gating.password)
        return exhibit;
    const safe = publicGating(gating);
    return safe === gating ? exhibit : { ...(exhibit as any), gating: safe };
}

// Content maps that hold no exhibit: not worth walking.
const SKIP_KEYS = new Set(["artworks", "kitbash", "portals", "params"]);
const MAX_DEPTH = 5;

/**
 * Strip every exhibit found in an API response body (`exhibit`, `exhibits`,
 * `user.exhibit`, `{ success, value: exhibit }`, ...). Objects without a
 * secret are returned as they are, so an unchanged body is not copied.
 */
export function stripExhibitSecretsDeep<T>(value: T, depth = 0): T {
    if (value == null || typeof value !== "object" || depth > MAX_DEPTH)
        return value;
    if (Array.isArray(value)) {
        let changed = false;
        const next = value.map((item) => {
            const stripped = stripExhibitSecretsDeep(item, depth + 1);
            if (stripped !== item) changed = true;
            return stripped;
        });
        return (changed ? next : value) as any;
    }
    // Only plain objects: dates, buffers and Firestore values pass through.
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    let result: any = value;
    for (const key of Object.keys(value)) {
        if (SKIP_KEYS.has(key)) continue;
        const item = (value as any)[key];
        const stripped =
            key === "gating"
                ? publicGating(item)
                : stripExhibitSecretsDeep(item, depth + 1);
        if (stripped !== item) {
            if (result === value) result = { ...(value as any) };
            result[key] = stripped;
        }
    }
    return result;
}

/**
 * Make every `res.json(body)` of an API route strip world passwords first.
 * For routes that hand out exhibit documents read straight from Firestore.
 */
export function stripSecretsFromJson<R extends { json: (body: any) => any }>(
    res: R
): R {
    const json = res.json.bind(res);
    res.json = (body: any) => json(stripExhibitSecretsDeep(body));
    return res;
}
