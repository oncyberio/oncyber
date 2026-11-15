/** @jest-environment jsdom */
import {
    cancelGamePreparation,
    gameDestinationId,
    PREPARE_TIMEOUT_MS,
    prepareGameDestination,
    resetGamePreparation,
    setGamePrepareGate,
} from "./gamePrepare";

const origin = window.location.origin;
const frames = () => [
    ...document.querySelectorAll<HTMLIFrameElement>(
        "iframe[data-game-prepare]"
    ),
];
/** A message as the browser delivers it from the sandboxed game. */
function fromGame(frame: HTMLIFrameElement, type: string) {
    window.dispatchEvent(
        new MessageEvent("message", {
            data: { type },
            origin: "null",
            source: frame.contentWindow,
        })
    );
}

beforeEach(() => {
    jest.useFakeTimers();
    resetGamePreparation();
    // The kill switch allows every game, unless a test says otherwise.
    setGamePrepareGate(() => true);
});
afterEach(() => {
    jest.useRealTimers();
    setGamePrepareGate(null);
    delete (globalThis as any).fetch;
});

test("a game the kill switch paused is not prepared", async () => {
    const asked: string[] = [];
    const answer = (pause: object, release = "rel-1") => {
        (globalThis as any).fetch = jest.fn(async (url: string) => {
            asked.push(url);
            return {
                ok: true,
                json: async () =>
                    url.endsWith("release.json") ? { release } : pause,
            };
        });
        setGamePrepareGate(null);
        resetGamePreparation();
    };
    const settle = async () => {
        for (let i = 0; i < 8; i++) await Promise.resolve();
    };

    answer({ paused: true, releases: [] });
    expect(prepareGameDestination("/games/ace")).toBe(true);
    await settle();
    expect(asked).toEqual(["/api/games/paused?game=ace"]);
    expect(frames()).toHaveLength(0);
    // Nothing is left waiting: the next choice starts afresh.
    answer({ paused: false, releases: ["rel-1"] });
    prepareGameDestination("/games/ace");
    await settle();
    expect(frames()).toHaveLength(0);

    answer({ paused: false, releases: ["another-release"] });
    prepareGameDestination("/games/ace");
    await settle();
    expect(frames()).toHaveLength(1);

    // The site can't be asked: nothing loads.
    resetGamePreparation();
    (globalThis as any).fetch = jest.fn(async () => {
        throw new Error("offline");
    });
    prepareGameDestination("/games/garden");
    await settle();
    expect(frames()).toHaveLength(0);
});

test("only shared-page games on this site are prepared", () => {
    expect(gameDestinationId("/games/ace", origin)).toBe("ace");
    expect(
        gameDestinationId(`${origin}/games/garden/?from=lobby`, origin)
    ).toBe("garden");
    // Padel has its own page; a space is not a game.
    expect(gameDestinationId("/games/padel", origin)).toBeNull();
    expect(gameDestinationId("/games/unknown", origin)).toBeNull();
    expect(gameDestinationId("/someone/space", origin)).toBeNull();
    expect(
        gameDestinationId("https://elsewhere.example/games/ace", origin)
    ).toBeNull();
    expect(prepareGameDestination("/someone/space")).toBe(false);
    expect(frames()).toHaveLength(0);
});

test("the game loads hidden, sandboxed, as a guest, and leaves after its first frame", () => {
    expect(prepareGameDestination("/games/ace")).toBe(true);
    const [frame] = frames();
    expect(frame.getAttribute("src")).toBe("/games/ace/index.html?prepare");
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.getAttribute("aria-hidden")).toBe("true");
    expect(frame.style.opacity).toBe("0");
    expect(frame.style.pointerEvents).toBe("none");
    const sent: any[] = [];
    jest.spyOn(frame.contentWindow!, "postMessage").mockImplementation(
        (message: any) => void sent.push(message)
    );
    fromGame(frame, "ace:hello");
    expect(sent).toEqual([
        {
            type: "ace:identity",
            name: "Guest",
            pfp: "",
            avatarUrl: "",
            storage: {},
        },
    ]);
    // Choosing it again while it prepares does not start a second frame.
    expect(prepareGameDestination("/games/ace")).toBe(true);
    expect(frames()).toHaveLength(1);
    fromGame(frame, "ace:first-frame");
    expect(sent.at(-1)).toEqual({ type: "ace:dispose" });
    expect(frames()).toHaveLength(0);
    // Still warm: not prepared again.
    expect(prepareGameDestination("/games/ace")).toBe(true);
    expect(frames()).toHaveLength(0);
});

test("a game on the one contract is answered in its prefix", () => {
    prepareGameDestination("/games/ace");
    const [frame] = frames();
    const sent: any[] = [];
    jest.spyOn(frame.contentWindow!, "postMessage").mockImplementation(
        (message: any) => void sent.push(message)
    );
    fromGame(frame, "oncyber:game:hello");
    expect(sent.map((m) => m.type)).toEqual(["oncyber:game:identity"]);
    fromGame(frame, "oncyber:game:progress");
    expect(frames()).toHaveLength(1);
    fromGame(frame, "oncyber:game:first-frame");
    expect(sent.at(-1)).toEqual({ type: "oncyber:game:dispose" });
    expect(frames()).toHaveLength(0);
});

test("messages from anywhere else are ignored", () => {
    prepareGameDestination("/games/ace");
    const [frame] = frames();
    window.dispatchEvent(
        new MessageEvent("message", {
            data: { type: "ace:first-frame" },
            origin,
            source: window,
        })
    );
    fromGame(frame, "garden:first-frame");
    expect(frames()).toHaveLength(1);
});

test("another choice, a cancel, a failure or a slow game removes the frame", () => {
    prepareGameDestination("/games/ace");
    prepareGameDestination("/games/garden");
    expect(frames().map((f) => f.dataset.gamePrepare)).toEqual(["garden"]);
    cancelGamePreparation();
    expect(frames()).toHaveLength(0);

    prepareGameDestination("/games/garden");
    fromGame(frames()[0], "garden:error");
    expect(frames()).toHaveLength(0);

    // Neither attempt finished, so the game prepares again.
    prepareGameDestination("/games/garden");
    expect(frames()).toHaveLength(1);
    jest.advanceTimersByTime(PREPARE_TIMEOUT_MS);
    expect(frames()).toHaveLength(0);
});

test("visitors saving data are left alone", () => {
    Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: { saveData: true },
    });
    expect(prepareGameDestination("/games/ace")).toBe(false);
    expect(frames()).toHaveLength(0);
    delete (navigator as any).connection;
});
