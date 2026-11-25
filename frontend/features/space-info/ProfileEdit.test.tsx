/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import ProfileView, { type ProfileEdit } from "./ProfileView";

jest.mock("next/link", () => ({
    __esModule: true,
    default: ({ href, children }) => <a href={href}>{children}</a>,
}));

const wallet = "0xfd22004806a6846ea67ad883356be810f0428793";
const kept = "0x" + "aa".repeat(20) + "/1";
const hiddenId = "0x" + "aa".repeat(20) + "/2";
const profile = {
    id: wallet,
    name: "ada",
    username: "ada",
    wallet,
    avatar: "https://example.com/old.png",
    href: "/ada",
    hasNfts: true,
    hiddenNfts: [hiddenId],
    spaces: [],
    featured: [],
};
const nft = (id: string, title: string) => ({
    id,
    title,
    collection: "things",
    href: "",
    imageUrls: [
        `https://example.com/${title}-small.png`,
        `https://example.com/${title}.png`,
    ],
});

let container: HTMLDivElement;
let root: Root;
let requested: string[];
const save = jest.fn(async (_edit: ProfileEdit) => ({
    success: true,
    message: "",
}));

async function open(selfId: string | null = wallet) {
    await act(async () => {
        root.render(
            <ProfileView
                profileId="ada"
                fallbackName="ada"
                self={
                    selfId
                        ? {
                              id: selfId,
                              save,
                              checkUsername: (name) =>
                                  /\s/.test(name) ? "No spaces." : "",
                          }
                        : undefined
                }
                ownExtras={<div data-own-extras>wallet here</div>}
                renderImage={(urls) => <img src={urls[0]} alt="" />}
            />
        );
    });
    await act(async () => {});
    await act(async () => {});
}
const button = (label: RegExp, within: ParentNode = container) =>
    [...within.querySelectorAll("button")].find((b) =>
        label.test(b.textContent || "")
    );
const press = async (label: RegExp, within?: ParentNode) => {
    const found = button(label, within);
    if (!found) throw new Error(`no button ${label}: ${container.textContent}`);
    await act(async () => found.click());
    await act(async () => {});
};
const type = async (value: string) => {
    const input = container.querySelector<HTMLInputElement>(
        ".profile-field input"
    )!;
    await act(async () => {
        Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value"
        )!.set!.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
    });
};
const collected = () => press(/^Collected/);

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    requested = [];
    save.mockClear();
    save.mockResolvedValue({ success: true, message: "" });
    (globalThis as any).fetch = jest.fn(async (url: string) => {
        requested.push(url);
        const body = !url.includes("nfts=")
            ? profile
            : {
                  // What others see leaves out the hidden one.
                  nfts: url.includes("all=1")
                      ? [nft(kept, "Kept"), nft(hiddenId, "Hidden")]
                      : [nft(kept, "Kept")],
                  next: "",
              };
        return { ok: true, status: 200, json: async () => body };
    });
    container = document.body.appendChild(document.createElement("div"));
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

test("only your own profile offers Edit profile and shows your wallet", async () => {
    await open();
    expect(button(/^Edit profile$/)).toBeTruthy();
    expect(container.querySelector("[data-own-extras]")).not.toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    await open("0x" + "bb".repeat(20));
    expect(button(/^Edit profile$/)).toBeUndefined();
    expect(container.querySelector("[data-own-extras]")).toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    await open(null);
    expect(button(/^Edit profile$/)).toBeUndefined();
});

test("the name is edited in place and saved as the username", async () => {
    await open();
    await press(/^Edit profile$/);
    const input = container.querySelector<HTMLInputElement>(
        ".profile-field input"
    )!;
    expect(input.value).toBe("ada");
    // The wallet steps aside while editing.
    expect(container.querySelector("[data-own-extras]")).toBeNull();
    await type("ada lovelace");
    await press(/^Save$/);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
        "No spaces."
    );
    expect(save).not.toHaveBeenCalled();
    await type("lovelace");
    await press(/^Save$/);
    expect(save).toHaveBeenCalledWith({ username: "lovelace" });
    // Back to the profile, showing what was saved.
    expect(container.querySelector(".identity strong")?.textContent).toBe(
        "lovelace"
    );
    expect(button(/^Edit profile$/)).toBeTruthy();
});

test("editing lists hidden NFTs too; one can become the picture, another be hidden", async () => {
    await open();
    await collected();
    expect(container.textContent).toContain("Kept");
    expect(container.textContent).not.toContain("Hidden");
    await press(/^Edit profile$/);
    await collected();
    expect(
        requested.some(
            (url) => url.includes("nfts=owned") && url.includes("all=1")
        )
    ).toBe(true);
    const cards = [...container.querySelectorAll(".artworks li")];
    expect(cards.map((li) => li.querySelector("strong")?.textContent)).toEqual([
        "Kept",
        "Hidden",
    ]);
    expect(cards[1].hasAttribute("data-hidden")).toBe(true);
    // Show the hidden one, hide the other, and use the first as the picture.
    await press(/^Show$/, cards[1]);
    await press(/^Hide$/, cards[0]);
    await press(/^Use as picture$/, cards[0]);
    expect(
        container.querySelector<HTMLImageElement>(
            ".profile-portrait img, img.profile-portrait"
        )?.src ?? ""
    ).toContain("Kept");
    await press(/^Save$/);
    expect(save).toHaveBeenCalledWith({
        avatar: "https://example.com/Kept.png",
        avatarContractAddress: "0x" + "aa".repeat(20),
        avatarTokenId: "1",
        hiddenNfts: [kept],
    });
    // Out of edit mode the list is read again, as others see it.
    expect(requested[requested.length - 1]).not.toContain("all=1");
});

test("a save that fails keeps the edit open and says why; Cancel changes nothing", async () => {
    save.mockResolvedValueOnce({
        success: false,
        message: "Username already exists.",
    });
    await open();
    await press(/^Edit profile$/);
    await type("taken");
    await press(/^Save$/);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
        "Username already exists."
    );
    expect(container.querySelector(".profile-field input")).not.toBeNull();
    await press(/^Cancel$/);
    expect(container.querySelector(".identity strong")?.textContent).toBe(
        "ada"
    );
    expect(save).toHaveBeenCalledTimes(1);
});

test("saving with nothing changed just leaves edit mode", async () => {
    await open();
    await press(/^Edit profile$/);
    await press(/^Save$/);
    expect(save).not.toHaveBeenCalled();
    expect(button(/^Edit profile$/)).toBeTruthy();
});
