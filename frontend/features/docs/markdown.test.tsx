/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Markdown, { headingsOf, parseBlocks } from "./markdown";

jest.mock("next/link", () => ({
    __esModule: true,
    default: ({ href, children }) => <a href={href}>{children}</a>,
}));

test("parses headings, lists, tables and fenced code", () => {
    const blocks = parseBlocks(
        [
            "# Title",
            "",
            "Some `code` and **bold**.",
            "",
            "- one",
            "  continued",
            "- two",
            "",
            "| A | B |",
            "| --- | --- |",
            "| 1 | 2 |",
            "",
            "```sh",
            "# not a heading",
            "```",
        ].join("\n")
    );
    expect(blocks.map((block) => block.type)).toEqual([
        "heading",
        "paragraph",
        "list",
        "table",
        "code",
    ]);
    expect(blocks[2]).toEqual({
        type: "list",
        ordered: false,
        items: ["one continued", "two"],
    });
    expect(blocks[4]).toEqual({
        type: "code",
        lang: "sh",
        code: "# not a heading",
    });
});

test("lists second-level headings for the page outline", () => {
    expect(headingsOf("# A\n\n## Run `it` locally\n\n### Deep")).toEqual([
        { id: "run-it-locally", text: "Run `it` locally" },
    ]);
});

test("renders only safe links and never raw HTML", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    act(() =>
        root.render(
            <Markdown
                source={
                    "[ok](/docs) [out](https://example.com) [bad](javascript:alert(1)) <b>x</b>"
                }
            />
        )
    );
    const links = Array.from(container.querySelectorAll("a"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
        "/docs",
        "https://example.com",
    ]);
    expect(container.querySelector("b")).toBeNull();
    act(() => root.unmount());
});

test("renders a details block as a closed dropdown", () => {
    const source = [
        "Intro.",
        "",
        ":::details Technical **details**",
        "- one",
        "",
        "```sh",
        ":::",
        "```",
        ":::",
        "",
        "After.",
    ].join("\n");
    const blocks = parseBlocks(source);
    expect(blocks.map((block) => block.type)).toEqual([
        "paragraph",
        "details",
        "paragraph",
    ]);
    expect(blocks[1]).toMatchObject({
        summary: "Technical **details**",
        blocks: [{ type: "list" }, { type: "code", code: ":::" }],
    });
    expect(headingsOf(":::details More\n## Hidden\n:::")).toEqual([]);

    const container = document.createElement("div");
    const root = createRoot(container);
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    act(() => root.render(<Markdown source={source} />));
    const details = container.querySelector("details");
    expect(details?.open).toBe(false);
    expect(details?.querySelector("summary strong")?.textContent).toBe(
        "details"
    );
    expect(details?.querySelector("li")?.textContent).toBe("one");
    act(() => root.unmount());
});
