import { historyAfterRedo, historyAfterUndo, UndoHistory } from "./history";

type History = UndoHistory<string>;
const history = (commands: string, index: number): History => ({
    stack: commands.split(""),
    index,
});
const text = ({ stack, index }: History) => `${stack.join("")}@${index}`;

// A history is written as its commands and the position of the last applied
// one: "ABC@2" has all three applied, "ABC@1" can redo C.
test.each<[string, History, string, string]>([
    ["the last command becomes the next redo", history("ABC", 2), "C", "ABC@1"],
    ["the only command", history("A", 0), "A", "A@-1"],
    ["a command below what can be redone", history("ABC", 1), "B", "ABC@0"],
    [
        "one command added while it ran drops it",
        history("ABCD", 3),
        "C",
        "ABD@2",
    ],
    ["several commands added while it ran", history("ABCDE", 4), "C", "ABDE@3"],
    ["the history was emptied meanwhile", history("", -1), "C", "@-1"],
    ["the command is no longer applied", history("ABC", 1), "C", "ABC@1"],
])("after an undo: %s", (_name, now, cmd, expected) => {
    expect(text(historyAfterUndo(now, cmd))).toBe(expected);
});

test.each<[string, History, string, number, string]>([
    ["the next redo is applied again", history("ABC", 1), "C", 2, "ABC@2"],
    ["the first command", history("A", -1), "A", 0, "A@0"],
    ["more to redo after it", history("ABCD", 1), "C", 2, "ABCD@2"],
    [
        "one command added while it ran goes on top",
        history("ABD", 2),
        "C",
        2,
        "ABCD@3",
    ],
    [
        "several commands added while it ran",
        history("ABDE", 3),
        "C",
        2,
        "ABCDE@4",
    ],
])("after a redo: %s", (_name, now, cmd, at, expected) => {
    expect(text(historyAfterRedo(now, cmd, at))).toBe(expected);
});

it("never changes the history it was given", () => {
    const undone = history("ABCD", 3);
    const redone = history("ABD", 2);
    historyAfterUndo(undone, "C");
    historyAfterRedo(redone, "C", 2);
    expect(text(undone)).toBe("ABCD@3");
    expect(text(redone)).toBe("ABD@2");
});

it("returns the same history when there is nothing to move", () => {
    const now = history("AB", 1);
    expect(historyAfterUndo(now, "C")).toBe(now);
});

// What the eager pointer used to give when the visitor kept editing during a
// running undo or redo. Moving the position late must end in the same place.
test.each<[string, "undo" | "redo", string]>([
    ["an edit during an undo", "undo", "ABD@2"],
    ["an edit during a redo", "redo", "ABCD@3"],
])("%s ends where it always did", (_name, direction, expected) => {
    const push = (now: History, cmd: string): History => ({
        stack: [...now.stack.slice(0, now.index + 1), cmd],
        index: now.index + 1,
    });
    if (direction === "undo") {
        const during = push(history("ABC", 2), "D");
        expect(text(historyAfterUndo(during, "C"))).toBe(expected);
    } else {
        const during = push(history("ABC", 1), "D");
        expect(text(historyAfterRedo(during, "C", 2))).toBe(expected);
    }
});
