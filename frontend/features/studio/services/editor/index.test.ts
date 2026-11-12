/** @jest-environment jsdom */
import { ExhibitEditorService } from "./index";

jest.mock("@components/_3DExhibit-v2/three/constants", () => ({
    APP_STATES: {},
    EDITION_ACTIONS: {},
}));
jest.mock("../realtime", () => ({
    sendRealtimeEvent: jest.fn(),
    startRealtime: jest.fn(),
}));
jest.mock("./CommandMap", () => ({ CommandMap: {} }));
jest.mock("./ExhibitDiff/World3DPatch", () => ({
    World3DPatch: class {},
}));
jest.mock("@utils/saveToDb", () => ({
    getDestination: jest.fn(),
    getStylekitByRoom: jest.fn(),
}));

const command = (name: string) => ({
    run: jest.fn(async () => {}),
    undo: jest.fn(async () => {}),
    redo: jest.fn(async () => {}),
    getLabel: () => name,
});
type Command = ReturnType<typeof command>;

let editor: ExhibitEditorService;
let a: Command, b: Command, c: Command, d: Command;
beforeEach(() => {
    editor = new ExhibitEditorService({ world: {} } as any);
    [a, b, c, d] = ["A", "B", "C", "D"].map(command);
    [a, b, c].forEach((cmd) => editor.pushCommand(cmd));
});

/** The history as its labels and the position: "ABC@2". */
const history = () =>
    `${editor.undoStack.map((cmd) => cmd.getLabel()).join("")}@${
        editor.undoIndex
    }`;
/** A command step that stays open until the test settles it. */
function hold(step: jest.Mock) {
    let settle: { resolve: () => void; reject: (error: Error) => void };
    step.mockImplementationOnce(
        () =>
            new Promise<void>(
                (resolve, reject) => (settle = { resolve, reject })
            )
    );
    return {
        resolve: () => settle.resolve(),
        reject: () => settle.reject(new Error("failed")),
    };
}

it("moves back one command when the undo succeeds", async () => {
    await editor.undo();
    expect(c.undo).toHaveBeenCalledTimes(1);
    expect(history()).toBe("ABC@1");
});

it("keeps its place when an undo fails, so the next undo tries the same step", async () => {
    c.undo.mockRejectedValueOnce(new Error("failed"));
    await expect(editor.undo()).rejects.toThrow("failed");
    expect(history()).toBe("ABC@2");
    expect(editor.undoingCmd).toBeNull();

    await editor.undo();
    expect(c.undo).toHaveBeenCalledTimes(2);
    expect(b.undo).not.toHaveBeenCalled();
    expect(history()).toBe("ABC@1");
});

it("keeps its place when a redo fails, so the next redo tries the same step", async () => {
    await editor.undo();
    c.redo.mockRejectedValueOnce(new Error("failed"));
    await expect(editor.redo()).rejects.toThrow("failed");
    expect(history()).toBe("ABC@1");

    // The command was not applied again, so undo goes to the one before it.
    await editor.redo();
    expect(c.redo).toHaveBeenCalledTimes(2);
    expect(history()).toBe("ABC@2");
});

it("does not move while the command is still running", async () => {
    const running = hold(c.undo);
    const undone = editor.undo();
    expect(editor.getState()).toMatchObject({ undoIndex: 2, undoingCmd: c });
    // One at a time: a second undo does not start on the command below.
    await editor.undo();
    expect(b.undo).not.toHaveBeenCalled();

    running.resolve();
    await undone;
    expect(editor.getState()).toMatchObject({ undoIndex: 1, undoingCmd: null });
});

it.each<[string, "resolve" | "reject", string]>([
    ["that works drops the undone command", "resolve", "ABD@2"],
    ["that fails keeps the command it could not undo", "reject", "ABCD@3"],
])("an edit made during an undo %s", async (_name, outcome, expected) => {
    const running = hold(c.undo);
    const undone = editor.undo().catch(() => {});
    editor.pushCommand(d);
    running[outcome]();
    await undone;
    expect(history()).toBe(expected);
});

it.each<[string, "resolve" | "reject", string]>([
    ["that works keeps both commands", "resolve", "ABCD@3"],
    ["that fails drops the command that was not applied", "reject", "ABD@2"],
])("an edit made during a redo %s", async (_name, outcome, expected) => {
    await editor.undo();
    const running = hold(c.redo);
    const redone = editor.redo().catch(() => {});
    editor.pushCommand(d);
    running[outcome]();
    await redone;
    expect(history()).toBe(expected);
});

it.each<[string, "undo" | "redo"]>([
    ["an undo", "undo"],
    ["a redo", "redo"],
])("leaves a history that was cleared during %s alone", async (_name, step) => {
    if (step === "redo") await editor.undo();
    const running = hold(c[step]);
    const done = editor[step]();
    editor.clearHistory();
    editor.pushCommand(d);
    running.resolve();
    await done;
    expect(history()).toBe("D@0");
});

it("announces the new position to its listeners after the command finished", async () => {
    const seen: number[] = [];
    editor.subscribeState(() => seen.push(editor.getState().undoIndex));
    await editor.undo();
    // Once when the undo starts, once when it has moved.
    expect(seen).toEqual([2, 1]);
});
