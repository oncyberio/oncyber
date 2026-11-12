/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { ActivityAvatar } from "./ActivityAvatar";
import { fetchOpenSeaProfileImage } from "@utils/artworks/history/profile";
jest.mock("@utils/artworks/history/profile", () => ({
    fetchOpenSeaProfileImage: jest.fn(),
}));
const lookup = fetchOpenSeaProfileImage as jest.Mock;
const id = "0x" + "a".repeat(40);
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let visible: () => void;
beforeEach(() => {
    (global as any).IS_REACT_ACT_ENVIRONMENT = true;
    (global as any).IntersectionObserver = class {
        constructor(callback) {
            visible = () => callback([{ isIntersecting: true }]);
        }
        observe() {}
        disconnect() {}
    };
    lookup.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});
test("loads visible avatars from OpenSea and falls back without retry loops", async () => {
    lookup.mockResolvedValue("https://i2c.seadn.io/avatar.png");
    act(() =>
        root.render(<ActivityAvatar address={id} fallbackSrc="/local.png" />)
    );
    expect(lookup).not.toHaveBeenCalled();
    await act(async () => visible());
    const img = container.querySelector("img");
    expect(img.getAttribute("src")).toBe("https://i2c.seadn.io/avatar.png");
    act(() => Simulate.error(img));
    expect(img.getAttribute("src")).toBe("/local.png");
    act(() => Simulate.error(img));
    expect(img.getAttribute("src")).toBe("/images/opensea-black.png");
    act(() => Simulate.error(img));
    expect(img.getAttribute("src")).toBe("/images/opensea-black.png");
    expect(lookup).toHaveBeenCalledTimes(1);
});
test("ignores a profile response after the account changes", async () => {
    let finish: (value: string) => void;
    lookup.mockImplementation(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            })
    );
    act(() => root.render(<ActivityAvatar address={id} />));
    act(() => visible());
    act(() => root.render(<ActivityAvatar address={"0x" + "b".repeat(40)} />));
    await act(async () => finish("https://i2c.seadn.io/old.png"));
    expect(container.querySelector("img").getAttribute("src")).toBe(
        "/images/opensea-black.png"
    );
});
