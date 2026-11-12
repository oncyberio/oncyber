import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncActionStatus = "idle" | "pending" | "done" | "failed";

export interface AsyncAction<Args extends any[], Result> {
    /** `pending` while the latest run is in flight. */
    status: AsyncActionStatus;
    /** What the latest run threw. Null unless `status` is `failed`. */
    error: unknown;
    /**
     * Runs the action. Resolves to its result, or to `undefined` when it
     * threw. It never rejects, so it is safe to call from an event handler
     * without a `catch`.
     */
    run: (...args: Args) => Promise<Awaited<Result> | undefined>;
    /** Back to `idle`. A run still in flight is forgotten. */
    reset: () => void;
}

/**
 * One async action and its spinner: a busy flag that cannot stay on.
 *
 * Use it instead of a hand-kept `loading` flag. The usual bug with those is
 * an early `return`, or a `throw` outside the `try`, between
 * `setLoading(true)` and `setLoading(false)`. Here the action is a function:
 * however it ends, by returning, returning early or throwing, the status
 * leaves `pending` and lands on `done` or `failed`.
 *
 *     const save = useAsyncAction(async (value: string) => {
 *         if (!value) return; // an early return is just "done"
 *         await store.save(value);
 *     });
 *
 *     <SaveButton
 *         disabled={save.status === "pending"}
 *         onClick={() => save.run(value)}
 *     />
 *     <InlineError
 *         message={save.status === "failed" && "Couldn't save your change."}
 *         onRetry={() => save.run(value)}
 *     />
 *
 * Decide whether to start before calling `run` (signed in? something
 * picked?): a check that does not run the action never shows a spinner.
 *
 * Only the latest run counts. When `run` is called again before the first
 * call has finished, the first one's outcome is ignored, and so is anything
 * that finishes after the component unmounted. The action itself is not
 * cancelled: side effects inside it still happen.
 */
export function useAsyncAction<Args extends any[], Result>(
    action: (...args: Args) => Result
): AsyncAction<Args, Result> {
    const [state, setState] = useState<{
        status: AsyncActionStatus;
        error: unknown;
    }>({ status: "idle", error: null });

    // Always the action from the latest render, so `run` can stay stable.
    const latest = useRef(action);
    latest.current = action;

    // Bumped by every run, by reset and by unmount: a run whose number is no
    // longer the current one has been superseded.
    const current = useRef(0);

    useEffect(
        () => () => {
            current.current++;
        },
        []
    );

    const run = useCallback(
        async (...args: Args): Promise<Awaited<Result> | undefined> => {
            const id = ++current.current;

            setState({ status: "pending", error: null });

            let outcome: typeof state = { status: "done", error: null };

            try {
                return await latest.current(...args);
            } catch (error) {
                console.error(error);

                outcome = { status: "failed", error };

                return undefined;
            } finally {
                if (current.current === id) setState(outcome);
            }
        },
        []
    );

    const reset = useCallback(() => {
        current.current++;

        setState({ status: "idle", error: null });
    }, []);

    return { status: state.status, error: state.error, run, reset };
}
