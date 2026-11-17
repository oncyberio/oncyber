/** @jest-environment node */
import { allDocs, llmsText } from "./content";

describe("in-app docs", () => {
    it("lists the game rules for coding agents in /llms.txt", () => {
        const text = llmsText("https://example.test");
        expect(text).toContain(
            "- [What a good game does](https://example.test/docs/good-game.md):"
        );
    });

    it("sends an agent making a game to the SDK's guide first", () => {
        const text = llmsText("https://example.test");
        expect(text).toContain("https://example.test/games/llms.txt");
        expect(text.indexOf("## Building a game")).toBeLessThan(
            text.indexOf("## Docs")
        );
        const guide = allDocs().find((doc) => doc.slug === "build-a-game");
        expect(guide?.body).toContain("## Required of every game");
        expect(guide?.body).toContain("## Optional: fitting in with Oncyber");
    });

    it("serves the game rules with their checks", () => {
        const page = allDocs().find((doc) => doc.slug === "good-game");
        expect(page?.body).toContain("## The rules, in order");
        expect(page?.body).toContain("pnpm games:check");
    });
});
