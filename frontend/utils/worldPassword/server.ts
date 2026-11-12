/**
 * World passwords on the server: hashing, checking, migrating documents that
 * still hold a plain value, and the writes that set or copy a password.
 *
 * Storage:
 * - `exhibits/{id}.gating.password` = `{ message, rev }`: public, readable by
 *   any client (Firestore listeners included). `rev` is random.
 * - `exhibitSecrets/{id}` = `{ password: { hash, rev }, updatedAt }`: read and
 *   written only here, with the Admin SDK. Firestore security rules must not
 *   allow clients to read this collection.
 *
 * Server only.
 */
import { createHash, randomBytes, scrypt, timingSafeEqual } from "crypto";
import { firestore } from "firebase-admin";
import { db } from "@utils/firebaseAdmin";
import { getExhibitAccessByCustomLink } from "@utils/firestore/exhibitAccess";
import { provesWorldAccess, WORLD_ACCESS_RENEWAL_GRACE_S } from "./proof";
import { reserveWorldPasswordAttempt } from "./attempts";
import { hasWorldPassword, publicGating, UNMIGRATED_REV } from "./publicGating";

export const SECRETS_COLLECTION = "exhibitSecrets";

export const secretRef = (exhibitId: string) =>
    db.collection(SECRETS_COLLECTION).doc(exhibitId);

export interface WorldPasswordSecret {
    password: { hash: string; rev: string };
    updatedAt: number;
}

const filled = (value: unknown): value is string =>
    typeof value === "string" && value.length > 0;

const b64url = (value: Buffer) =>
    value
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

export const newPasswordRevision = () => b64url(randomBytes(12));

// scrypt, OWASP's minimum (N=2^14, r=8, p=1): ~16 MB and a few tens of ms
// per check. The parameters are stored with the hash, so they can be raised
// later without invalidating stored passwords.
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };
const MAX_N = 1 << 17;

function scryptAsync(
    plain: string,
    salt: Buffer,
    keylen: number,
    options: { N: number; r: number; p: number }
): Promise<Buffer> {
    return new Promise((resolve, reject) =>
        scrypt(
            plain,
            salt,
            keylen,
            { ...options, maxmem: 256 * options.N * options.r },
            (err, key) => (err ? reject(err) : resolve(key))
        )
    );
}

/** `scrypt$N$r$p$salt$hash` (salt and hash in base64). */
export async function hashWorldPassword(plain: string): Promise<string> {
    const salt = randomBytes(16);
    const { N, r, p, keylen } = SCRYPT;
    const key = await scryptAsync(plain, salt, keylen, { N, r, p });
    return [
        "scrypt",
        N,
        r,
        p,
        salt.toString("base64"),
        key.toString("base64"),
    ].join("$");
}

export async function verifyWorldPassword(
    plain: unknown,
    stored: unknown
): Promise<boolean> {
    if (!filled(plain) || !filled(stored)) return false;
    const [scheme, n, r, p, salt, hash] = stored.split("$");
    const N = Number(n);
    const R = Number(r);
    const P = Number(p);
    if (
        scheme !== "scrypt" ||
        !salt ||
        !hash ||
        !Number.isInteger(N) ||
        N < 2 ||
        N > MAX_N ||
        (N & (N - 1)) !== 0 ||
        !Number.isInteger(R) ||
        R < 1 ||
        R > 16 ||
        !Number.isInteger(P) ||
        P < 1 ||
        P > 4
    )
        return false;
    const expected = Buffer.from(hash, "base64");
    if (!expected.length) return false;
    try {
        const actual = await scryptAsync(
            plain,
            Buffer.from(salt, "base64"),
            expected.length,
            { N, r: R, p: P }
        );
        return timingSafeEqual(actual, expected);
    } catch {
        return false;
    }
}

/** Constant-time comparison of two plain strings (old documents only). */
function samePlain(a: string, b: string) {
    const digest = (value: string) =>
        createHash("sha256").update(value).digest();
    return timingSafeEqual(digest(a), digest(b));
}

async function newSecret(plain: string) {
    const rev = newPasswordRevision();
    const secret: WorldPasswordSecret = {
        password: { hash: await hashWorldPassword(plain), rev },
        updatedAt: Date.now(),
    };
    return { rev, secret };
}

/**
 * Hash the plain password an old document still holds, in one transaction
 * with the document update. Returns the revision now in force (null when
 * the world has no password).
 */
export async function migrateLegacyWorldPassword(
    exhibitId: string
): Promise<string | null> {
    return db.runTransaction(async (transaction) => {
        const ref = db.collection("exhibits").doc(exhibitId);
        const [doc] = await transaction.getAll(ref, {
            fieldMask: ["gating"],
        });
        const gating = doc?.exists ? doc.data()?.gating : null;
        const gate = gating?.password;
        if (!hasWorldPassword(gating)) return null;
        if (!filled(gate.password)) return gate.rev;
        const { rev, secret } = await newSecret(gate.password);
        const now = Date.now();
        transaction.set(secretRef(exhibitId), secret);
        transaction.update(
            ref,
            new firestore.FieldPath("gating", "password"),
            {
                message: typeof gate.message === "string" ? gate.message : "",
                rev,
            },
            new firestore.FieldPath("lastUpdatedAt"),
            now
        );
        return rev;
    });
}

export interface WorldPasswordCheck {
    /** Did the visitor prove the password (typed it, or holds a proof)? */
    check: () => Promise<boolean>;
    /** The world's password revision, after any migration the check did. */
    readonly rev: string | null;
    /**
     * The typed password was not checked: too many attempts for this world
     * from this address, or for this world overall (./attempts.ts).
     */
    readonly limited: boolean;
}

/**
 * The password step of the gating rules, for `checkGatingRules`. Lazy: it
 * runs only when every other rule passed, as the comparison always did.
 * `gating` is the stored (raw) gating; when absent it is read here.
 */
export function createWorldPasswordCheck({
    exhibitId,
    gating,
    password,
    proof,
    client = "unknown",
}: {
    exhibitId: string;
    gating?: any;
    password?: unknown;
    proof?: unknown;
    /** The visitor's address for the attempt limit (attemptClientKey). */
    client?: string;
}): WorldPasswordCheck {
    let limited = false;

    /** Check a typed password under the attempt limit. */
    async function limitedCheck(verify: () => Promise<boolean> | boolean) {
        let reservation;
        try {
            reservation = await reserveWorldPasswordAttempt(exhibitId, client);
        } catch (err) {
            // Fail closed: without the counter, guesses would be unlimited.
            console.error(
                "world password attempt limit unavailable",
                exhibitId
            );
            return false;
        }
        if (!reservation.allowed) {
            limited = true;
            return false;
        }
        const accepted = await verify();
        if (accepted) await reservation.release();
        return accepted;
    }

    let rev: string | null =
        gating === undefined
            ? null
            : publicGating(gating)?.password?.rev || null;

    // A proof stands in for the password here a while past its expiry, so
    // that a long visit can renew it (see WORLD_ACCESS_RENEWAL_GRACE_S).
    const proves = (world: { exhibitId: string; rev: string | null }) =>
        provesWorldAccess(proof, world, {
            graceMs: WORLD_ACCESS_RENEWAL_GRACE_S * 1000,
        });

    async function check() {
        if (gating === undefined)
            gating = (await getExhibitAccessByCustomLink(`s@${exhibitId}`))
                ?.gating;
        if (!hasWorldPassword(gating)) return true;
        const gate = gating.password;
        rev = publicGating(gating).password.rev;

        if (filled(gate.password)) {
            // An old document: compare once more, then hash it right away.
            const accepted =
                proves({ exhibitId, rev }) ||
                (filled(password) &&
                    (await limitedCheck(() =>
                        samePlain(password, gate.password)
                    )));
            try {
                rev = (await migrateLegacyWorldPassword(exhibitId)) || rev;
            } catch (err) {
                console.error("world password migration failed", exhibitId);
            }
            return accepted;
        }

        if (proves({ exhibitId, rev })) return true;
        if (!filled(password)) return false;

        const stored = (await secretRef(exhibitId).get()).data() as
            | WorldPasswordSecret
            | undefined;
        if (!stored?.password?.hash || stored.password.rev !== gate.rev) {
            // Fail closed: a password is required and cannot be checked.
            console.error("world password secret missing", exhibitId);
            return false;
        }
        return limitedCheck(() =>
            verifyWorldPassword(password, stored.password.hash)
        );
    }

    return {
        check,
        get rev() {
            return rev;
        },
        get limited() {
            return limited;
        },
    };
}

// --- writes ---------------------------------------------------------------

type Patch = { op: "add" | "replace" | "remove"; path: string[]; value?: any };

export type SecretWrite =
    | { type: "set"; secret: WorldPasswordSecret }
    | { type: "delete" }
    | null;

/**
 * Turn the studio's gating patches into ones that store no password: a new
 * plain password is hashed into the secret and replaced with a fresh `rev`;
 * a gate saved without one (a message edit, or the public shape coming back)
 * keeps the revision in force; `rev` and `hash` are never taken from a
 * client. `current` is the stored gating.
 */
export async function secureGatingPatches(
    patches: Patch[],
    current: any
): Promise<{ patches: Patch[]; secretWrite: SecretWrite }> {
    let secretWrite: SecretWrite = null;
    // The gate as stored so far: its revision and, for an old document, the
    // plain value still to be hashed.
    let state: { rev: string | null; legacy: string | null; message: string } =
        {
            rev: filled(current?.password?.rev) ? current.password.rev : null,
            legacy: filled(current?.password?.password)
                ? current.password.password
                : null,
            message:
                typeof current?.password?.message === "string"
                    ? current.password.message
                    : "",
        };

    async function secureGate(value: any) {
        if (value == null || typeof value !== "object") return value;
        const message =
            typeof value.message === "string" ? value.message : state.message;
        if (value.password === "") {
            // The studio cleared the field: the world no longer asks for a
            // password, as an empty password never did.
            secretWrite = { type: "delete" };
            state = { rev: null, legacy: null, message };
            return { message };
        }
        const plain = filled(value.password) ? value.password : state.legacy;
        if (plain) {
            const { rev, secret } = await newSecret(plain);
            secretWrite = { type: "set", secret };
            state = { rev, legacy: null, message };
            return { message, rev };
        }
        state = { ...state, message };
        return state.rev ? { message, rev: state.rev } : { message };
    }

    const next: Patch[] = [];
    for (const patch of patches) {
        const [scope, key, field] = patch.path;
        if (scope !== "gating") {
            next.push(patch);
            continue;
        }
        const removes = patch.op === "remove" || patch.value == null;
        if (patch.path.length === 1) {
            if (removes) {
                secretWrite = { type: "delete" };
                state = { rev: null, legacy: null, message: "" };
                next.push(patch);
            } else if (patch.value?.password != null) {
                next.push({
                    ...patch,
                    value: {
                        ...patch.value,
                        password: await secureGate(patch.value.password),
                    },
                });
            } else {
                next.push(patch);
            }
            continue;
        }
        if (key !== "password") {
            next.push(patch);
            continue;
        }
        if (patch.path.length === 2) {
            if (removes) {
                secretWrite = { type: "delete" };
                state = { rev: null, legacy: null, message: "" };
                next.push(patch);
            } else {
                next.push({ ...patch, value: await secureGate(patch.value) });
            }
            continue;
        }
        // A single field of the gate.
        if (field === "message" && patch.path.length === 3) {
            if (typeof patch.value === "string")
                state = { ...state, message: patch.value };
            next.push(patch);
        } else if (
            field === "password" &&
            patch.path.length === 3 &&
            !removes &&
            filled(patch.value)
        ) {
            const secured = await secureGate({ password: patch.value });
            next.push(
                { op: "remove", path: ["gating", "password", "password"] },
                {
                    op: "add",
                    path: ["gating", "password", "rev"],
                    value: secured.rev,
                }
            );
        }
        // Anything else under the gate (rev, hash, deeper paths) is the
        // server's to write: dropped.
    }
    return { patches: next, secretWrite };
}

export function applySecretWrite(
    transaction: firestore.Transaction,
    exhibitId: string,
    secretWrite: SecretWrite
) {
    if (secretWrite?.type === "set")
        transaction.set(secretRef(exhibitId), secretWrite.secret);
    else if (secretWrite?.type === "delete")
        transaction.delete(secretRef(exhibitId));
}

/**
 * For a world copied from `sourceId` (duplicate, template): the gate to store
 * on the copy and the secret to write for it, keeping the same password.
 * Null when the source has no password.
 */
export async function copyWorldPassword(sourceId: string): Promise<{
    password: { message: string; rev: string };
    secret: WorldPasswordSecret | null;
} | null> {
    const gating = (await getExhibitAccessByCustomLink(`s@${sourceId}`))
        ?.gating;
    if (!hasWorldPassword(gating)) return null;
    const gate = gating.password;
    const message = typeof gate.message === "string" ? gate.message : "";
    if (filled(gate.password)) {
        const { rev, secret } = await newSecret(gate.password);
        return { password: { message, rev }, secret };
    }
    const stored = (await secretRef(sourceId).get()).data() as
        | WorldPasswordSecret
        | undefined;
    const rev = newPasswordRevision();
    if (!stored?.password?.hash) {
        // Nothing to copy: the copy stays closed to visitors, as its source.
        console.error("world password secret missing", sourceId);
        return { password: { message, rev }, secret: null };
    }
    return {
        password: { message, rev },
        secret: {
            password: { hash: stored.password.hash, rev },
            updatedAt: Date.now(),
        },
    };
}

/**
 * Legacy path updates (pages/api/exhibit UPDATE_EXHIBIT) may delete the
 * gating but not write a password: that goes through the studio's update,
 * which hashes it.
 */
export function writesWorldPassword(payload: unknown): boolean {
    if (!payload || typeof payload !== "object") return false;
    const write = payload as Record<string, any>;
    const isOperation = (key: string) => key.startsWith("FIRESTORE_");
    let fields: Record<string, any> | null = null;
    if (write.FIRESTORE_UPDATE_Field) fields = write.update;
    else if (!Object.keys(write).some(isOperation)) fields = write;
    if (!fields || typeof fields !== "object") return false;
    const isDelete = (value: any) => !!value?.FIRESTORE_DELETE_Field;
    return Object.keys(fields).some((key) => {
        const path = key.split(".");
        if (path[0] !== "gating") return false;
        const value = fields[key];
        if (path.length >= 2) return path[1] === "password" && !isDelete(value);
        return (
            value != null &&
            typeof value === "object" &&
            !isDelete(value) &&
            value.password != null &&
            !isDelete(value.password)
        );
    });
}

export { UNMIGRATED_REV };
