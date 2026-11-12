/**
 * Where the studio's undo history stands once a command has been undone or
 * redone.
 *
 * `stack[0..index]` are the commands that are applied; anything above
 * `index` can be redone. `ExhibitEditorService` leaves the position alone
 * while a command's undo or redo runs and asks these functions for the new
 * history only when it succeeded. A command that fails therefore stays where
 * it was: the next undo tries the same step again instead of skipping it.
 *
 * Undoing or redoing can take seconds (an artwork is loaded again), and the
 * visitor can keep editing meanwhile. Each new command is pushed onto the
 * history as it is at that moment, so both functions take the history as it
 * is now, not as it was when the command started.
 *
 * Both are pure: they return a new history and never change the one given.
 */
export interface UndoHistory<C> {
    stack: C[];
    index: number;
}

/** The history once `cmd` has been undone. */
export function historyAfterUndo<C>(
    history: UndoHistory<C>,
    cmd: C
): UndoHistory<C> {
    const { stack, index } = history;
    const at = stack.indexOf(cmd);

    // Not among the applied commands any more: nothing of ours to move.
    if (at < 0 || at > index) return history;

    // The usual case. The command stays as the next redo.
    if (at === index) return { stack, index: index - 1 };

    // Commands were added on top of it while it was being undone. A new
    // command drops whatever could be redone, and this one now could.
    return {
        stack: stack.filter((it) => it !== cmd),
        index: index - 1,
    };
}

/**
 * The history once `cmd` has been applied again. `at` is where it stood, as
 * the next redo, when the redo started.
 */
export function historyAfterRedo<C>(
    history: UndoHistory<C>,
    cmd: C,
    at: number
): UndoHistory<C> {
    const { stack, index } = history;

    // The usual case. The position moves up onto the command.
    if (stack[at] === cmd) return { stack, index: Math.max(index, at) };

    // Commands were added while it was being redone, and the first of them
    // took its place. It is applied all the same, and it started first, so
    // it goes back in underneath them where undo can still reach it.
    return {
        stack: [...stack.slice(0, at), cmd, ...stack.slice(at)],
        index: index + 1,
    };
}
