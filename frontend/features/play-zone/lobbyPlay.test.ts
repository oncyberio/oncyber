import {
    encodeBodies,
    readPlayRecipe,
} from "../../../multiplayer/protocol/play-zone";
import { LobbyPlay, aiLine, aiRequest } from "./lobbyPlay";

const pit = (count: number, extra = {}) =>
    readPlayRecipe({
        title: "Pit",
        things: [{ kind: "ball", count, size: 0.2 }],
        ...extra,
    });
const place = { origin: { x: 30, z: 0 }, radius: 70 };

describe("aiRequest", () => {
    it("reads what follows /ai and leaves ordinary chat alone", () => {
        expect(aiRequest("/ai a ball pit")).toBe("a ball pit");
        expect(aiRequest("  /AI   moon gravity  ")).toBe("moon gravity");
        expect(aiRequest("/ai")).toBe("");
        expect(aiRequest("hello /ai")).toBeNull();
        expect(aiRequest("/aim higher")).toBeNull();
        expect(aiRequest("hi")).toBeNull();
    });
});

describe("aiLine", () => {
    it("says what the model is doing and how the change arrived", () => {
        expect(aiLine({ state: "thinking", text: "more balls" })).toBe(
            "Thinking about “more balls”…"
        );
        expect(
            aiLine({
                state: "done",
                say: "Added 50.",
                seconds: 2.1,
                change: "live",
            })
        ).toBe("Added 50. (2.1 s, in place)");
        expect(
            aiLine({
                state: "done",
                say: "Bigger.",
                seconds: 3,
                change: "reset",
            })
        ).toBe("Bigger. (3 s, after a rewind)");
        expect(aiLine({ state: "failed", say: "No model." })).toBe(
            "Could not do that: No model."
        );
    });
});

describe("LobbyPlay", () => {
    it("ignores everything on a server without a zone", () => {
        const play = new LobbyPlay();
        play.welcome(false);
        play.control("play-game", { recipe: pit(3), change: "start" });
        expect(play.place).toBeNull();
        expect(play.recipe).toBeNull();
        play.welcome({ origin: { x: "far" }, radius: 1 });
        expect(play.place).toBeNull();
    });

    it("starts a round, hears about its things and eases them into place", () => {
        const play = new LobbyPlay();
        play.welcome(place);
        play.control("play-game", { recipe: pit(2), change: "start" });
        expect([
            play.recipe.title,
            play.revision,
            play.poses.known.length,
        ]).toEqual(["Pit", 1, 2]);
        const poses = Float32Array.from([
            1, 2, 3, 0, 0, 0, 1, 4, 5, 6, 0, 0, 0, 1,
        ]);
        play.frame(encodeBodies(1, [0], poses)[0]);
        expect(Array.from(play.poses.known)).toEqual([1, 0]);
        play.update(1 / 60);
        expect(Array.from(play.poses.shown.subarray(0, 3))).toEqual([1, 2, 3]);
        // A frame that is not things changes nothing.
        play.frame(Uint8Array.from([2, 0, 0, 0, 0, 0]));
        expect(Array.from(play.poses.known)).toEqual([2, 0]);
    });

    it("keeps things where they are drawn when the game changes in place", () => {
        const play = new LobbyPlay();
        play.welcome(place);
        play.control("play-game", { recipe: pit(1), change: "start" });
        play.frame(
            encodeBodies(1, [0], Float32Array.from([1, 2, 3, 0, 0, 0, 1]))[0]
        );
        play.update(1 / 60);
        play.control("play-game", {
            recipe: pit(3, { gravity: 2 }),
            change: "live",
        });
        expect(play.revision).toBe(2);
        expect(Array.from(play.poses.shown.subarray(0, 3))).toEqual([1, 2, 3]);
        expect(Array.from(play.poses.known)).toEqual([2, 0, 0]);
        // A new round starts from nothing.
        play.control("play-game", { recipe: pit(3), change: "start" });
        expect(Array.from(play.poses.known)).toEqual([0, 0, 0]);
    });

    it("follows a rewind, the score, swings, a new move and the end of the round", () => {
        const play = new LobbyPlay();
        const lines: string[] = [];
        play.onLine = (text) => lines.push(text);
        play.welcome(place);
        play.control("play-game", { recipe: pit(1), change: "start" });
        play.control("play-rewind", { seconds: 2.5 });
        expect(play.rewinding).toBe(true);
        play.control("play-game", { recipe: pit(1), change: "reset" });
        expect(play.rewinding).toBe(false);
        play.control("play-state", {
            score: [2, 1],
            secondsLeft: 12,
            done: false,
        });
        expect([play.score, play.secondsLeft]).toEqual([[2, 1], 12]);
        play.control("play-act", { id: 7 });
        expect(play.swings.has(7)).toBe(true);
        play.control("play-action", {
            action: {
                name: "smash",
                moments: [{ at: 0.5, rightHand: "target" }],
            },
        });
        expect(play.action.name).toBe("smash");
        play.control("play-action", { action: { junk: true } });
        expect(play.action.name).toBe("smash");
        play.control("play-ai", { state: "failed", say: "No model." });
        expect(lines).toEqual(["Could not do that: No model."]);
        play.control("play-state", {
            score: [2, 1],
            secondsLeft: 0,
            done: true,
        });
        expect(play.recipe).toBeNull();
    });
});
