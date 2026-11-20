/** @jest-environment jsdom */
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import ProfileView from "./ProfileView";

jest.mock("next/link", () => ({
    __esModule: true,
    default: ({ href, children }) => <a href={href}>{children}</a>,
}));

const profile = {
    id: "0xfd22004806a6846ea67ad883356be810f0428793",
    name: "6529",
    username: "6529",
    wallet: "0xfd22004806a6846ea67ad883356be810f0428793",
    avatar: "",
    href: "/6529",
    hasNfts: true,
    spaces: [
        {
            id: "a",
            title: "6529 Museum District",
            href: "/6529om",
            imageUrls: ["https://example.com/a.png"],
            visits: 140774,
        },
        {
            id: "b",
            title: "6529 Photo A",
            href: "/6529photo",
            imageUrls: ["https://example.com/b.png"],
            visits: 0,
        },
    ],
    featured: [
        {
            id: "c",
            title: "Art in Tezos",
            href: "/tezos",
            imageUrls: ["https://example.com/c.png"],
        },
    ],
};
const nfts = {
    nfts: [
        {
            id: "n1",
            title: "Aeroglyph6529",
            collection: "thememes6529",
            href: "https://example.com/n1",
            imageUrls: ["https://example.com/n1.png"],
        },
    ],
    next: "",
};

let container: HTMLDivElement;
let root: Root;
let answer: (url: string) => { ok: boolean; body?: unknown };

const flush = () => act(async () => void (await Promise.resolve()));
async function open() {
    await act(async () => {
        root.render(
            <ProfileView
                profileId="6529"
                fallbackName="@6529"
                renderImage={(urls) => <img src={urls[0]} alt="" />}
            />
        );
    });
    await flush();
    await flush();
}
const tabs = () =>
    Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'));
const selected = () =>
    tabs().find((tab) => tab.getAttribute("aria-selected") === "true")
        ?.textContent;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    answer = (url) =>
        url.includes("nfts=")
            ? { ok: true, body: nfts }
            : { ok: true, body: profile };
    (globalThis as any).fetch = jest.fn(async (url: string) => {
        const { ok, body } = answer(url);
        return { ok, status: ok ? 200 : 500, json: async () => body };
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

test("the person is named once, with their wallet beside the name", async () => {
    await open();
    expect(container.querySelector(".identity strong").textContent).toBe(
        "6529"
    );
    expect(container.querySelector(".identity-detail").textContent).toBe(
        "0xfd22…8793"
    );
    // No second name, and no plain section headings.
    const named = Array.from(container.querySelectorAll("*")).filter(
        (element) =>
            !element.children.length &&
            /^@?6529$/.test(element.textContent.trim())
    );
    expect(named).toHaveLength(1);
    expect(container.querySelectorAll("h3")).toHaveLength(0);
});

test("the sections sit behind one switch, opening on their spaces", async () => {
    await open();
    expect(tabs().map((tab) => tab.textContent)).toEqual([
        "Spaces2",
        "Featured in1",
        "Collected",
        "Created",
    ]);
    expect(selected()).toBe("Spaces2");
    const cards = Array.from(container.querySelectorAll(".space-cards li"));
    expect(
        cards.map((card) => card.querySelector("strong").textContent)
    ).toEqual(["6529 Museum District", "6529 Photo A"]);
    // Visits read like the landing's cards; none for a space nobody visited.
    expect(cards[0].querySelector(".mono").textContent).toBe("140.8K visits");
    expect(cards[1].querySelector(".mono")).toBeNull();
    // NFTs are not fetched until their section is opened.
    expect((fetch as jest.Mock).mock.calls).toHaveLength(1);
});

test("picking a section shows it, and arrow keys move along the switch", async () => {
    await open();
    await act(async () => tabs()[1].click());
    expect(selected()).toBe("Featured in1");
    expect(container.querySelector(".space-cards strong").textContent).toBe(
        "Art in Tezos"
    );
    await act(async () => {
        tabs()[1].dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
        );
    });
    await flush();
    expect(selected()).toBe("Collected");
    expect(document.activeElement).toBe(tabs()[2]);
    expect(container.querySelector(".artworks strong").textContent).toBe(
        "Aeroglyph6529"
    );
    // Only the open section's tab is in the tab order.
    expect(tabs().map((tab) => tab.tabIndex)).toEqual([-1, -1, 0, -1]);
});

test("a profile that cannot be read says so and can be tried again", async () => {
    answer = () => ({ ok: false });
    await open();
    expect(container.querySelector('[role="alert"]').textContent).toContain(
        "This profile is unavailable right now."
    );
    expect(tabs()).toHaveLength(0);
    // The name the link carried is still shown, once.
    expect(container.querySelector(".identity strong").textContent).toBe(
        "@6529"
    );
    answer = (url) =>
        url.includes("nfts=")
            ? { ok: true, body: nfts }
            : { ok: true, body: profile };
    await act(async () =>
        container.querySelector<HTMLElement>('[role="alert"] button').click()
    );
    await flush();
    await flush();
    expect(selected()).toBe("Spaces2");
});

test("someone with no spaces opens on what they do have", async () => {
    answer = (url) =>
        url.includes("nfts=")
            ? { ok: true, body: nfts }
            : { ok: true, body: { ...profile, spaces: [] } };
    await open();
    expect(selected()).toBe("Featured in1");
    // An empty section has no count beside its name.
    expect(tabs()[0].textContent).toBe("Spaces");
});
