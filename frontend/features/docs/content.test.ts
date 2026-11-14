/** @jest-environment node */
import { allDocs, llmsText } from "./content";

describe("in-app docs", () => {
    it("lists the game rules for coding agents in /llms.txt", () => {
        const text = llmsText("https://example.test");
        expect(text).toContain(
            "- [What a good game does](https://example.test/docs/good-game.md):"
        );
    });

    it("serves the game rules with their checks", () => {
        const page = allDocs().find((doc) => doc.slug === "good-game");
        expect(page?.body).toContain("## The rules, in order");
        expect(page?.body).toContain("pnpm games:check");
    });
});
