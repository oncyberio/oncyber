/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Ownership } from "./index";
import { useArtworkInfo } from "../../ArtworkContext";
import { mergeArtworkMetadata } from "@utils/artworks/mergeArtworkMetadata";
import { Popover } from "../Popover";

jest.mock("../../ArtworkContext", () => ({ useArtworkInfo: jest.fn() }));
let mockExternalProfile = false;
jest.mock("@components/hooks/useProfile", () => ({
    useProfile: (user) => {
        const profile = require("react").useState(user)[0];
        return mockExternalProfile ? { ...profile, id: undefined } : profile;
    },
}));
jest.mock("./Owners", () => ({ Owners: () => <span>Owners</span> }));
jest.mock("../Popover", () => ({
    Popover: jest.fn(({ children }) => (
        <div data-testid="creator-popover">{children}</div>
    )),
}));
jest.mock("@components/context/I18nContext", () => ({
    useCyberTranslation: () => ({
        t: ([key]) =>
            ({ COLLECTED_BY: "Collected by", ART_BY: "Created by" }[key] ||
            key),
    }),
}));
const context = useArtworkInfo as jest.Mock;
let node: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const saved: any = {
    blockchain: "ethereum",
    owner: { address: "0x" + "a".repeat(40), user: { username: "Collector" } },
    creator: { address: "0x" + "b".repeat(40), user: { username: "Artist" } },
};
beforeEach(() => {
    jest.clearAllMocks();
    mockExternalProfile = false;
    (global as any).IS_REACT_ACT_ENVIRONMENT = true;
    node = document.createElement("div");
    document.body.appendChild(node);
    root = createRoot(node);
});
afterEach(() => {
    act(() => root.unmount());
    node.remove();
});
function render(asset) {
    context.mockReturnValue({ asset, artwork: saved });
    act(() => root.render(<Ownership />));
}
function pillLabels() {
    return [...node.querySelectorAll(".li-label")].map((x) => x.textContent);
}

test("collector and creator pills survive a metadata-only refresh", async () => {
    render(saved);
    expect(pillLabels()).toEqual(["Collected by", "Created by"]);
    const response = await Promise.resolve({
        blockchain: "ethereum" as const,
        owner: {} as any,
        creator: {} as any,
        name: "Updated artwork",
    });
    render(mergeArtworkMetadata(saved, response));
    expect(pillLabels()).toEqual(["Collected by", "Created by"]);
    expect(node.textContent).toContain("Collector");
    expect(node.textContent).toContain("Artist");
});
test("only the full zero address hides a collector; a legitimate zero-prefixed address still renders", () => {
    render({
        ...saved,
        owner: { ...saved.owner, address: "0x0000" + "a".repeat(36) },
    });
    expect(pillLabels()).toContain("Collected by");
    render(
        mergeArtworkMetadata(saved, {
            blockchain: "ethereum",
            owner: { address: "0x" + "0".repeat(40), user: {} },
        })
    );
    expect(pillLabels()).toEqual(["Created by"]);
});

test("an explicit collector change never retains the previous collector profile", () => {
    render(saved);
    const nextOwner = { address: "0x" + "c".repeat(40), user: {} };
    render(
        mergeArtworkMetadata(saved, {
            blockchain: "ethereum",
            owner: nextOwner,
        })
    );
    expect(pillLabels()).toEqual(["Collected by", "Created by"]);
    expect(node.textContent).not.toContain("Collector");
    expect(node.textContent).toContain("@0xcccccc");
    expect(node.textContent).toContain("Artist");
});

test("the artist credit has no collection or curator popover", () => {
    const artwork = {
        ...saved,
        curatorNotes: "Curator notes should not appear over the artist credit",
        collection: {
            name: "Japanese GenArt Collection",
            image_url: "https://images.example/collection.png",
        },
    };
    context.mockReturnValue({ asset: artwork, artwork });
    act(() => root.render(<Ownership />));
    const artist = [...node.querySelectorAll(".li-card")].find((card) =>
        card.textContent.includes("Artist")
    );
    act(() => {
        artist.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
        artist.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    });
    expect(Popover).not.toHaveBeenCalled();
    expect(node.querySelector('[data-testid="creator-popover"]')).toBeNull();
    expect(node.querySelector(".collection")).toBeNull();
    expect(node.textContent).not.toContain(artwork.curatorNotes);
    expect(pillLabels()).toEqual(["Collected by", "Created by"]);
    expect(artist.querySelector("a").getAttribute("href")).toBe(
        `/@${saved.creator.address}`
    );
});

test.each([
    undefined,
    "https://opensea.io/accounts",
    "https://opensea.io/accounts/",
])(
    "creator and collector clicks use current OpenSea routes for saved base %s",
    (account_base_url) => {
        mockExternalProfile = true;
        render({ ...saved, account_base_url });
        expect(
            [...node.querySelectorAll(".li-link")].map((link) =>
                link.getAttribute("href")
            )
        ).toEqual([
            `https://opensea.io/${saved.owner.address}`,
            `https://opensea.io/${saved.creator.address}`,
        ]);
    }
);
