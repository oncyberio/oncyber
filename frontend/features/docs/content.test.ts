/** @jest-environment node */
import { aboutPage, allDocs, faqOf, llmsFullText, llmsText } from "./content";

const ORIGIN = "https://www.oncyber.com";

describe("faqOf", () => {
    it("reads each question with its answer as plain text", () => {
        expect(
            faqOf(
                [
                    "# Title",
                    "",
                    "Intro.",
                    "",
                    "## Is it free?",
                    "",
                    "Yes. See the [Studio](/studio) and `this`.",
                    "",
                    "## Not a question",
                    "",
                    "Skipped.",
                    "",
                    "## Empty?",
                    "",
                ].join("\n")
            )
        ).toEqual([
            {
                question: "Is it free?",
                answer: "Yes. See the Studio and this.",
                markdown: "Yes. See the [Studio](/studio) and `this`.",
            },
        ]);
    });
});

describe("the about page", () => {
    it("opens with a statement, then questions and answers", () => {
        const page = aboutPage();
        expect(page.title).toBe("About Oncyber");
        expect(page.lead).toMatch(/^Oncyber is a place on the web/);
        expect(page.faq.length).toBeGreaterThanOrEqual(8);
        expect(page.faq[0].question).toBe("What is Oncyber?");
        for (const { answer } of page.faq) {
            expect(answer.length).toBeGreaterThan(20);
            expect(answer).not.toMatch(/[[\]`]/);
        }
        // Answers keep their links for the page itself.
        expect(
            page.faq.find((entry) => /make a space/.test(entry.question))
                .markdown
        ).toContain("[Studio](/studio)");
    });

    it("is not one of the docs pages", () => {
        expect(allDocs().map((doc) => doc.slug)).not.toContain("about");
        expect(allDocs().every((doc) => doc.faq === undefined)).toBe(true);
    });
});

describe("llmsText", () => {
    it("lists the product, the docs and the featured spaces", () => {
        const text = llmsText(ORIGIN, [
            {
                title: "6529 Museum District",
                href: "/6529om",
                creator: "@6529",
                description: "The first district\nof OM.",
            },
            {
                title: "Starry [Night]",
                href: "/spaces/abc",
                creator: "rayan_oncyber",
            },
        ]);
        expect(text).toContain("## Featured spaces");
        expect(text).toContain(
            `- [6529 Museum District](${ORIGIN}/6529om) by @6529: The first district of OM.`
        );
        // Names keep their underscores; brackets cannot break the link.
        expect(text).toContain(
            `- [Starry Night](${ORIGIN}/spaces/abc) by rayan_oncyber`
        );
        expect(text).toContain(`${ORIGIN}/llms-full.txt`);
        expect(text).toContain(`[About](${ORIGIN}/about)`);
    });

    it("leaves the section out when no space could be read", () => {
        expect(llmsText(ORIGIN)).not.toContain("## Featured spaces");
    });
});

describe("llmsFullText", () => {
    it("holds every page with its address", () => {
        const text = llmsFullText(ORIGIN);
        expect(text).toContain(`Source: ${ORIGIN}/about`);
        expect(text).toContain("## Is Oncyber free?");
        for (const doc of allDocs())
            expect(text).toContain(
                `Source: ${ORIGIN}/docs${doc.slug ? `/${doc.slug}` : ""}`
            );
    });
});

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
