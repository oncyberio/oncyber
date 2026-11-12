/**
 * One operation's hold on a frame, placeholder or artwork in the studio.
 *
 * `lockTarget(target, true)` in `WorldEditContext` answers false when another
 * operation already holds the target, and `lockTarget(target, false)` unlocks
 * it whoever asks. An operation that was turned away must therefore not
 * unlock on its way out: the lock belongs to the one that is still running.
 * A lease remembers whether this operation took the lock, and `release`
 * gives back only that lock, once.
 *
 *     let lease: TargetLease;
 *     try {
 *         lease = leaseTarget(lockTarget, targetMesh);
 *         if (!lease.acquired) return; // one operation per frame at a time
 *         ...
 *     } finally {
 *         lease?.release();
 *     }
 */
export interface TargetLease {
    /** False when another operation holds the target: do not start. */
    acquired: boolean;
    /** Unlocks the target if this lease locked it. Safe to call twice. */
    release: () => void;
}

export function leaseTarget<T>(
    lockTarget: (target: T, isLocked: boolean) => boolean,
    target: T
): TargetLease {
    let held = lockTarget(target, true);

    return {
        acquired: held,
        release() {
            if (!held) return;

            held = false;

            lockTarget(target, false);
        },
    };
}
