/** @jest-environment node */
import { allDocs, faqOf, llmsFullText, llmsText } from "./content";

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
            },
        ]);
    });
});

describe("the docs", () => {
    it("include the plain-words page, written as questions and answers", () => {
        const page = allDocs().find((doc) => doc.slug === "what-is-oncyber");
        expect(page.faq.length).toBeGreaterThanOrEqual(8);
        expect(page.faq[0].question).toBe("What is Oncyber?");
        for (const { answer } of page.faq) {
            expect(answer.length).toBeGreaterThan(20);
            expect(answer).not.toMatch(/[[\]`]/);
        }
        // Other pages are not question pages.
        expect(allDocs().find((doc) => !doc.slug).faq).toBeUndefined();
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
        expect(text).toContain(`${ORIGIN}/docs/what-is-oncyber.md`);
    });

    it("leaves the section out when no space could be read", () => {
        expect(llmsText(ORIGIN)).not.toContain("## Featured spaces");
    });
});

describe("llmsFullText", () => {
    it("holds every page with its address", () => {
        const text = llmsFullText(ORIGIN);
        for (const doc of allDocs())
            expect(text).toContain(
                `Source: ${ORIGIN}/docs${doc.slug ? `/${doc.slug}` : ""}`
            );
    });
});
