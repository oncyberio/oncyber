import { arenaBaseUrl } from "./constants";

describe("arena server address", () => {
    test("defaults to the arena VM", () => {
        expect(arenaBaseUrl(undefined)).toBe("arena.oncyber.io");
        expect(arenaBaseUrl("  ")).toBe("arena.oncyber.io");
    });
    test("accepts a bare host or an origin", () => {
        expect(arenaBaseUrl("oncyber-arena.fly.dev")).toBe(
            "oncyber-arena.fly.dev"
        );
        expect(arenaBaseUrl("https://oncyber-arena.fly.dev/")).toBe(
            "oncyber-arena.fly.dev"
        );
        expect(arenaBaseUrl("http://localhost:2567")).toBe("localhost:2567");
    });
});
