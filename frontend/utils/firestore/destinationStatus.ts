/**
 * The destination review lifecycle: which status a destination may move to,
 * and who may move it. Pure (no I/O); the Firestore write helpers in
 * `./destinations` ask it before every write that carries a `status`, so a
 * route cannot write a status the lifecycle does not give its caller.
 *
 *   tested ──submit──▶ submitted ──review──▶ verified ──mint──▶ active
 *      ▲                  │   │                 │
 *      └──────cancel──────┘   └─review─▶ rejected (owner may resubmit)
 *                                               verified ──▶ failed
 *
 * Actors:
 * - "owner": the signed-in owner, through create, the generic update,
 *   submitReview and cancelSubmit. May submit for review and step back to a
 *   draft while the destination is not minted; may never verify, reject or
 *   publish. `failed` is the marker the mint dialog writes when the drop was
 *   created on chain but could not be saved, so it only follows `verified`.
 * - "mint": the owner finishing a mint (finalizeCreateDrop, finalizeMint,
 *   finalizeDestination). Publishes, and only what review has verified.
 * - "review": staff. Nothing in this API runs as review; the row is here so
 *   the table is the whole lifecycle and a future review route has a name to
 *   pass.
 */
export const DESTINATION_STATUSES = [
    "tested",
    "submitted",
    "rejected",
    "verified",
    "failed",
    "active",
] as const;

export type DestinationLifecycleStatus = (typeof DESTINATION_STATUSES)[number];

export type DestinationStatusActor = "owner" | "mint" | "review";

/** The "from" of a destination that does not exist yet. */
export const NEW_DESTINATION = null;

type Moves = Record<string, readonly DestinationLifecycleStatus[]>;

const NEW = "(new)";

const OWNER_MOVES: Moves = {
    [NEW]: ["tested"],
    // Submit for review / cancel the review.
    tested: ["submitted"],
    submitted: ["tested"],
    // Resubmit after a rejection, or go back to a draft.
    rejected: ["submitted", "tested"],
    // Withdraw or resubmit before minting; mark a mint that was not saved.
    verified: ["submitted", "tested", "failed"],
    // Minted, or waiting for the team: the owner cannot move it any more.
    failed: [],
    active: [],
};

const MINT_MOVES: Moves = {
    verified: ["active"],
    // The drop exists on chain; a later finalize may still publish it.
    failed: ["active"],
};

function isStatus(value: unknown): value is DestinationLifecycleStatus {
    return (
        typeof value === "string" &&
        (DESTINATION_STATUSES as readonly string[]).includes(value)
    );
}

/**
 * May `actor` move a destination from `from` to `to`? `from` is the stored
 * status, or NEW_DESTINATION when it is being created; a stored destination
 * that has no status is treated like a new one (it may only become a draft).
 * Writing the status a destination already has is not a move and is always
 * allowed.
 */
export function canMoveDestinationStatus(
    from: unknown,
    to: unknown,
    actor: DestinationStatusActor
): boolean {
    if (from != null && from === to) return true;
    if (!isStatus(to)) return false;
    if (actor === "review") return true;

    const moves = actor === "mint" ? MINT_MOVES : OWNER_MOVES;
    const key = from == null ? NEW : String(from);
    const allowed = Object.prototype.hasOwnProperty.call(moves, key)
        ? moves[key]
        : [];

    return allowed.includes(to);
}

const quoted = (status: unknown) =>
    typeof status === "string" ? `"${status}"` : "no status";

/** Throws when the move is not legal for `actor`. */
export function assertDestinationStatusMove(
    from: unknown,
    to: unknown,
    actor: DestinationStatusActor
) {
    if (canMoveDestinationStatus(from, to, actor)) return;

    throw new Error(
        from === NEW_DESTINATION
            ? `A new destination starts as "tested", not ${quoted(to)}.`
            : `Destination status cannot change from ${quoted(
                  from
              )} to ${quoted(to)}.`
    );
}
