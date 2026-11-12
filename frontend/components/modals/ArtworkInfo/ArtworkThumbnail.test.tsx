/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { ArtworkThumbnail } from "./ArtworkThumbnail";

let node: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
    (global as any).IS_REACT_ACT_ENVIRONMENT = true;
    node = document.createElement("div");
    document.body.appendChild(node);
    root = createRoot(node);
});
afterEach(() => {
    act(() => root.unmount());
    node.remove();
});
function render(sources: string[]) {
    act(() =>
        root.render(
            <ArtworkThumbnail
                sources={sources}
                alt="Japanese GenArt Collection"
                className="li-img"
            />
        )
    );
}
const source = () => node.querySelector("img")?.getAttribute("src");
const fail = () => act(() => Simulate.error(node.querySelector("img")));

test("failed remote images fall back once, without a broken icon even if the local placeholder fails", () => {
    render(["https://cdn.example/logo.png", "https://ipfs.io/ipfs/logo"]);
    fail();
    expect(source()).toBe("https://ipfs.io/ipfs/logo");
    fail();
    expect(source()).toBe("/images/opensea-black.png");
    fail();
    expect(node.querySelector("img")).toBeNull();
    expect(node.querySelector(".li-img").getAttribute("aria-label")).toBe(
        "Japanese GenArt Collection"
    );
    expect(node.textContent).toBe("J");
});
test("rerenders do not retry failed sources; changing artwork resets the chain", () => {
    render(["https://cdn.example/old.png", "https://cdn.example/old.png"]);
    fail();
    expect(source()).toBe("/images/opensea-black.png");
    render(["https://cdn.example/old.png", "https://cdn.example/old.png"]);
    expect(source()).toBe("/images/opensea-black.png");
    render(["https://cdn.example/new.png"]);
    expect(source()).toBe("https://cdn.example/new.png");
});
test("missing image URLs use the local placeholder without requesting an empty URL", () => {
    render([null, undefined, ""]);
    expect(source()).toBe("/images/opensea-black.png");
});
