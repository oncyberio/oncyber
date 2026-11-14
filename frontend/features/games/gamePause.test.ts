import {
    fetchGameRelease,
    gamePause,
    parseDisabledGames,
    resolveGamePause,
} from "./gamePause";

describe("the games kill switch", () => {
    it("reads game ids and game@release entries, and drops the rest", () => {
        expect(
            parseDisabledGames(
                " ace, garden@0800022feca2d8ba  Padel\n../x a@b@c @r"
            )
        ).toEqual([
            { game: "ace", release: null },
            { game: "garden", release: "0800022feca2d8ba" },
            { game: "padel", release: null },
        ]);
        expect(parseDisabledGames(undefined)).toEqual([]);
    });

    it("tells the page what is paused for one game", () => {
        const env = { GAMES_DISABLED: "ace,garden@aaa,garden@bbb" };
        expect(gamePause("ace", env)).toEqual({ paused: true, releases: [] });
        expect(gamePause("garden", env)).toEqual({
            paused: false,
            releases: ["aaa", "bbb"],
        });
        expect(gamePause("padel", env)).toEqual({
            paused: false,
            releases: [],
        });
        expect(gamePause("ace", {})).toEqual({ paused: false, releases: [] });
    });

    it("pauses a game without reading its release", async () => {
        const load = jest.fn();
        expect(
            await resolveGamePause({ paused: true, releases: [] }, load)
        ).toBe("paused");
        expect(await resolveGamePause(null, load)).toBe("play");
        expect(
            await resolveGamePause({ paused: false, releases: [] }, load)
        ).toBe("play");
        expect(load).not.toHaveBeenCalled();
    });

    it("pauses only the listed release, and plays when it can't tell", async () => {
        const pause = { paused: false, releases: ["aaa"] };
        expect(await resolveGamePause(pause, async () => "aaa")).toBe("paused");
        expect(await resolveGamePause(pause, async () => "ccc")).toBe("play");
        expect(await resolveGamePause(pause, async () => null)).toBe("play");
        expect(
            await resolveGamePause(pause, async () => {
                throw new Error("offline");
            })
        ).toBe("play");
    });

    it("reads the release id from release.json", async () => {
        const ok = (body: unknown) =>
            (async () => ({ ok: true, json: async () => body })) as any;
        expect(await fetchGameRelease("ace", ok({ release: "0800ab" }))).toBe(
            "0800ab"
        );
        expect(await fetchGameRelease("ace", ok({ release: 4 }))).toBeNull();
        expect(
            await fetchGameRelease("ace", (async () => ({ ok: false })) as any)
        ).toBeNull();
    });
});
