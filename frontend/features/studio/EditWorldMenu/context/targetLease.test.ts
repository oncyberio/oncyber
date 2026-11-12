import { leaseTarget } from "./targetLease";

/** The lock as WorldEditContext keeps it: one holder per target. */
function locks() {
    const locked = new Set<string>();
    const calls: string[] = [];
    const lockTarget = (target: string, isLocked: boolean) => {
        if (target == null) return true;
        if (isLocked && locked.has(target)) return false;
        calls.push(`${isLocked ? "lock" : "unlock"} ${target}`);
        if (isLocked) locked.add(target);
        else locked.delete(target);
        return true;
    };
    return { locked, calls, lockTarget };
}

it("locks a free frame and gives it back", () => {
    const { locked, calls, lockTarget } = locks();
    const lease = leaseTarget(lockTarget, "frame");
    expect(lease.acquired).toBe(true);
    expect(locked.has("frame")).toBe(true);
    lease.release();
    expect(locked.has("frame")).toBe(false);
    expect(calls).toEqual(["lock frame", "unlock frame"]);
});

it("turns a second add away and leaves the first add's lock in place", () => {
    const { locked, calls, lockTarget } = locks();
    const first = leaseTarget(lockTarget, "frame");
    const second = leaseTarget(lockTarget, "frame");
    expect(second.acquired).toBe(false);

    // The second add leaves through its `finally`.
    second.release();
    expect(locked.has("frame")).toBe(true);
    expect(calls).toEqual(["lock frame"]);

    first.release();
    expect(locked.has("frame")).toBe(false);
});

it("gives its lock back once, however often it is released", () => {
    const { locked, calls, lockTarget } = locks();
    const first = leaseTarget(lockTarget, "frame");
    // An add unlocks as soon as the artwork is in the scene...
    first.release();
    const next = leaseTarget(lockTarget, "frame");
    expect(next.acquired).toBe(true);
    // ...and again from its `finally`, after the upload. By then the frame
    // belongs to the next add.
    first.release();
    expect(locked.has("frame")).toBe(true);
    expect(calls).toEqual(["lock frame", "unlock frame", "lock frame"]);
});

it("keeps frames apart", () => {
    const { locked, lockTarget } = locks();
    const one = leaseTarget(lockTarget, "one");
    const two = leaseTarget(lockTarget, "two");
    expect([one.acquired, two.acquired]).toEqual([true, true]);
    one.release();
    expect([...locked]).toEqual(["two"]);
});

it("starts an add that has no frame to lock", () => {
    const { calls, lockTarget } = locks();
    const lease = leaseTarget(lockTarget, null);
    expect(lease.acquired).toBe(true);
    lease.release();
    expect(calls).toEqual([]);
});
