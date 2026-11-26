import {
    SCRIPT_EVENT_LIFE_MS,
    pickup,
    readScriptEvent,
    scriptEvent,
} from "./livePickup";

const NOW = 1_795_700_000_000;

describe("the notice a save puts on a space's feed", () => {
    test("says when and how, and nothing of the script", () => {
        const event = scriptEvent(NOW - 5, "rewind", NOW);
        expect(event).toEqual({
            type: "WORLD_SCRIPT",
            isServerEvent: true,
            savedAt: NOW - 5,
            landing: "rewind",
            timestamp: NOW + SCRIPT_EVENT_LIFE_MS,
        });
        expect(readScriptEvent(event, NOW + 1000)).toEqual({
            savedAt: NOW - 5,
            landing: "rewind",
        });
    });

    test("is not read once it is old, or when it is something else", () => {
        const event = scriptEvent(NOW, "add", NOW);
        expect(readScriptEvent(event, NOW + SCRIPT_EVENT_LIFE_MS + 1)).toBe(
            null
        );
        expect(readScriptEvent({ ...event, type: "EDITOR_ACTION" }, NOW)).toBe(
            null
        );
        // A visitor can write to the feed: only the server's notices count,
        // and one that names no save is not one.
        expect(readScriptEvent({ ...event, isServerEvent: false }, NOW)).toBe(
            null
        );
        expect(readScriptEvent({ ...event, savedAt: "soon" }, NOW)).toBe(null);
        expect(readScriptEvent(null, NOW)).toBe(null);
    });

    test("lands as an addition unless it says rewind", () => {
        const event = { ...scriptEvent(NOW, "add", NOW), landing: "reload" };
        expect(readScriptEvent(event, NOW)?.landing).toBe("add");
    });
});

describe("what a world does about a save", () => {
    test("the script already running changes nothing", () => {
        // The editor's own world already runs what they just saved.
        expect(pickup("a();", { source: "a();" }, "rewind")).toEqual({
            do: "nothing",
        });
    });

    test("a change is added, keeping the game, unless the saver asked for a rewind", () => {
        expect(pickup("a();", { source: "b();" }, "add")).toEqual({
            do: "run",
            mode: "keep",
        });
        expect(pickup("a();", { source: "b();" }, "rewind")).toEqual({
            do: "run",
            mode: "fresh",
        });
    });

    test("a first script starts; a cleared one stops; a new style redraws", () => {
        expect(pickup("", { source: "b();" }, "add")).toEqual({
            do: "run",
            mode: "fresh",
        });
        expect(pickup("a();", { source: "" }, "add")).toEqual({ do: "stop" });
        expect(
            pickup("a();", { source: "a();", restyled: true }, "add")
        ).toEqual({ do: "restyle" });
        expect(pickup("", { source: "" }, "rewind")).toEqual({ do: "nothing" });
    });
});
