/** @jest-environment jsdom */
import { captureWorldLinks, readWorldLink } from "./worldLinks";
import { readWorldFrame } from "./worldFrame";

// jsdom's own address stands in for the world host.
const frame = readWorldFrame(window.location.origin, "https://www.oncyber.com");

describe("readWorldLink", () => {
    const site = "https://www.oncyber.com";
    test("a web address, with the host a visitor is shown", () => {
        expect(
            readWorldLink("https://opensea.io/assets/1?ref=x", site)
        ).toEqual({
            href: "https://opensea.io/assets/1?ref=x",
            host: "opensea.io",
        });
        // a path is a page of this site
        expect(readWorldLink("/@ada", site)).toEqual({
            href: "https://www.oncyber.com/@ada",
            host: "www.oncyber.com",
        });
    });
    test.each([
        ["a script", "javascript:alert(1)"],
        ["a data address", "data:text/html,<p>hi"],
        ["an address with a login in it", "https://user:pass@opensea.io/"],
        ["nothing", ""],
        ["not text", 7],
        ["something enormous", "https://x.example/" + "a".repeat(3000)],
    ])("%s is not offered", (_, value) => {
        expect(readWorldLink(value, site)).toBeNull();
    });
});

describe("a framed world's ways out", () => {
    let asked: { kind: string; data: any }[];
    let release: () => void;
    const realOpen = window.open;
    const click = (html: string, init: MouseEventInit = {}) => {
        document.body.innerHTML = html;
        const target = document.querySelector("[data-click]") as HTMLElement;
        const event = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            button: 0,
            ...init,
        });
        target.dispatchEvent(event);
        return event;
    };
    beforeEach(() => {
        asked = [];
        release = captureWorldLinks(window, frame, (kind, data) =>
            asked.push({ kind, data })
        );
    });
    afterEach(() => {
        release();
        document.body.innerHTML = "";
    });

    test("opening a window asks the page to open the link", () => {
        expect(window.open("https://opensea.io/assets/1", "_blank")).toBeNull();
        window.open("/@ada");
        expect(asked).toEqual([
            {
                kind: "open-link",
                data: { href: "https://opensea.io/assets/1" },
            },
            // a page of the world host is that page of the site
            {
                kind: "open-link",
                data: { href: "https://www.oncyber.com/@ada" },
            },
        ]);
    });

    test("a link to a new tab asks the page, and does nothing here", () => {
        const event = click(
            '<a href="https://opensea.io/x" target="_blank"><span data-click>OpenSea</span></a>'
        );
        expect(event.defaultPrevented).toBe(true);
        expect(asked).toEqual([
            { kind: "open-link", data: { href: "https://opensea.io/x" } },
        ]);
    });

    test("a link to another page of the site asks the page to travel there", () => {
        const event = click('<a href="/@ada?tab=spaces" data-click>Ada</a>');
        expect(event.defaultPrevented).toBe(true);
        expect(asked).toEqual([
            { kind: "travel", data: { href: "/@ada?tab=spaces" } },
        ]);
        // held with the modifier that means "new tab"
        click('<a href="/@ada" data-click>Ada</a>', { metaKey: true });
        expect(asked.at(-1)).toEqual({
            kind: "open-link",
            data: { href: "https://www.oncyber.com/@ada" },
        });
    });

    test("a link to another site in the same tab is offered as a new one: a world cannot leave its frame", () => {
        click('<a href="https://elsewhere.example/" data-click>Out</a>');
        expect(asked).toEqual([
            { kind: "open-link", data: { href: "https://elsewhere.example/" } },
        ]);
    });

    test("what is not a way out is left alone", () => {
        for (const html of [
            '<a href="#section" data-click>Jump</a>',
            '<a href="mailto:hi@example.com" data-click>Mail</a>',
            "<button data-click>Press</button>",
        ])
            expect(click(html).defaultPrevented).toBe(false);
        expect(
            click('<a href="/x" data-click>x</a>', { button: 2 })
                .defaultPrevented
        ).toBe(false);
        expect(asked).toEqual([]);
    });

    test("undone, the document is as it was", () => {
        release();
        expect(window.open).toBe(realOpen);
        expect(
            click('<a href="#x" target="_blank" data-click>x</a>')
                .defaultPrevented
        ).toBe(false);
        expect(asked).toEqual([]);
        release = () => {};
    });
});
