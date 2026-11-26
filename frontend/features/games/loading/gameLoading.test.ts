import {
    GAME_LOADING,
    gameFrameCurrent,
    gameLoadingTransition,
    readGameLoadingMessage,
    type GameLoadingEvent,
    type GameLoadingState,
} from "./gameLoading";

const drawn: GameLoadingState = {
    phase: "drawn",
    progress: 1,
    label: "Ready",
    firstFrameMs: 900,
    drawn: { width: 1280, height: 720 },
};
const failed: GameLoadingState = { ...GAME_LOADING, phase: "failed" };

const moves: Array<
    [string, GameLoadingState, GameLoadingEvent, Partial<GameLoadingState>]
> = [
    [
        "progress rises",
        GAME_LOADING,
        { type: "progress", value: 0.4, label: "Building" },
        { phase: "loading", progress: 0.4, label: "Building" },
    ],
    [
        "progress never falls, the label still changes",
        { ...GAME_LOADING, progress: 0.6, label: "a" },
        { type: "progress", value: 0.2, label: "b" },
        { progress: 0.6, label: "b" },
    ],
    [
        "the first frame ends loading",
        { ...GAME_LOADING, progress: 0.6 },
        { type: "first-frame", ms: 900, width: 1280, height: 720 },
        {
            phase: "drawn",
            progress: 1,
            firstFrameMs: 900,
            drawn: { width: 1280, height: 720 },
        },
    ],
    [
        "ready stands in for a game without first-frame",
        GAME_LOADING,
        { type: "ready" },
        { phase: "drawn", progress: 1, drawn: null },
    ],
    [
        "an error fails loading",
        GAME_LOADING,
        { type: "error" },
        { phase: "failed" },
    ],
    [
        "a redraw updates the size",
        drawn,
        { type: "frame", width: 900, height: 620 },
        { phase: "drawn", drawn: { width: 900, height: 620 } },
    ],
];

test.each(moves)("%s", (_name, from, event, expected) => {
    expect(gameLoadingTransition(from, event)).toMatchObject(expected);
});

const ignored: Array<[string, GameLoadingState, GameLoadingEvent]> = [
    [
        "a frame before the first frame",
        GAME_LOADING,
        { type: "frame", width: 1, height: 1 },
    ],
    [
        "the same progress again",
        { ...GAME_LOADING, progress: 0.5 },
        { type: "progress", value: 0.5, label: "" },
    ],
    [
        "progress after the first frame",
        drawn,
        { type: "progress", value: 0.1, label: "" },
    ],
    ["ready after the first frame", drawn, { type: "ready" }],
    ["an error after the first frame", drawn, { type: "error" }],
    [
        "a redraw at the same size",
        drawn,
        { type: "frame", width: 1280, height: 720 },
    ],
    [
        "a first frame after failing",
        failed,
        { type: "first-frame", ms: 1, width: 1, height: 1 },
    ],
];

test.each(ignored)("%s returns the same state", (_name, from, event) => {
    expect(gameLoadingTransition(from, event)).toBe(from);
});

test("a frame is current when it was drawn at the size on screen", () => {
    expect(gameFrameCurrent(GAME_LOADING, { width: 1280, height: 720 })).toBe(
        false
    );
    expect(gameFrameCurrent(drawn, { width: 1280, height: 721 })).toBe(true);
    expect(gameFrameCurrent(drawn, { width: 900, height: 620 })).toBe(false);
    // A game that never reports a size is taken at its word.
    expect(
        gameFrameCurrent({ ...drawn, drawn: null }, { width: 5, height: 5 })
    ).toBe(true);
});

test("reads only this game's well-formed loading messages", () => {
    expect(
        readGameLoadingMessage("ace", {
            type: "ace:progress",
            value: 7,
            label: 3,
        })
    ).toEqual({ type: "progress", value: 1, label: "" });
    expect(
        readGameLoadingMessage("ace", {
            type: "ace:first-frame",
            ms: 812.4,
            width: 1280,
            height: 720,
        })
    ).toEqual({ type: "first-frame", ms: 812, width: 1280, height: 720 });
    expect(
        readGameLoadingMessage("ace", {
            type: "ace:frame",
            width: 900,
            height: 620,
        })
    ).toEqual({ type: "frame", width: 900, height: 620 });
    expect(readGameLoadingMessage("ace", { type: "ace:ready" })).toEqual({
        type: "ready",
    });
    // A game on the one contract says the same in the one prefix.
    expect(
        readGameLoadingMessage("ace", {
            type: "oncyber:game:first-frame",
            ms: 812.4,
            width: 1280,
            height: 720,
        })
    ).toEqual({ type: "first-frame", ms: 812, width: 1280, height: 720 });
    expect(
        readGameLoadingMessage("ace", {
            type: "oncyber:game:progress",
            value: 0.5,
            label: "Warming up…",
        })
    ).toEqual({ type: "progress", value: 0.5, label: "Warming up…" });
    for (const bad of [
        null,
        { type: "garden:progress", value: 0.5 },
        { type: "ace:progress", value: "0.5" },
        { type: "ace:progress", value: Number.NaN },
        { type: "ace:first-frame", width: -1, height: 720 },
        { type: "ace:frame", width: 900 },
        { type: "ace:pose" },
    ])
        expect(readGameLoadingMessage("ace", bad)).toBeNull();
});
