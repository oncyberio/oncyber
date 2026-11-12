/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ExperienceControlIcon, {
    experienceControlIconAsset,
    experienceControlIcons,
} from "./ExperienceControlIcon";
import LobbyDockIcon from "@features/lobby/LobbyDockIcon";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

test("all control artwork is a decorative 22px currentColor mask with a fixed local asset", () => {
    act(() =>
        root.render(
            <>
                {experienceControlIcons.map((name) => (
                    <ExperienceControlIcon key={name} name={name} />
                ))}
            </>
        )
    );
    const icons = [
        ...container.querySelectorAll<HTMLElement>(".experience-control-icon"),
    ];
    expect(icons).toHaveLength(10);
    icons.forEach((icon, index) => {
        expect(icon.style.maskImage).toContain(
            experienceControlIconAsset(experienceControlIcons[index])
        );
        expect(icon.style.width).toBe("22px");
        expect(icon.style.height).toBe("22px");
        expect(icon.getAttribute("aria-hidden")).toBe("true");
        expect(window.getComputedStyle(icon).backgroundColor).toBe(
            "currentColor"
        );
    });
    expect(container.querySelector("img, svg, button")).toBeNull();
});

test("established runtime action names resolve to the same canonical artwork", () => {
    const pairs = {
        user: "avatar",
        smile: "emotes",
        users: "people",
        grid: "explore",
        dashboard: "more",
        lock: "permissions",
        "refresh-cw": "reload",
    };
    for (const [alias, name] of Object.entries(pairs))
        expect(experienceControlIconAsset(alias)).toBe(
            experienceControlIconAsset(name)
        );
    expect(experienceControlIconAsset("dashboard")).toBe(
        "/icons/generated-v2/more.png"
    );
    expect(experienceControlIconAsset("info")).toBe(
        "/icons/generated-v2/info.png"
    );
    expect(experienceControlIconAsset("mic-off")).toBe(
        "/lobby/icons/generated-v3/mic-off.png"
    );
});

test("lobby icon wrapper uses the same artwork and preserves its state class hooks", () => {
    act(() => root.render(<LobbyDockIcon name="people" />));
    const icon = container.querySelector<HTMLElement>(
        ".lobby-dock-icon.experience-control-icon"
    );
    expect(icon.style.maskImage).toContain(experienceControlIconAsset("users"));
    expect(icon.style.width).toBe("22px");
});

test("unrecognized names cannot supply arbitrary mask URLs or object prototype properties", () => {
    for (const name of [
        "send",
        "x",
        "__proto__",
        "constructor",
        "https://example.com/icon.png",
    ]) {
        expect(experienceControlIconAsset(name)).toBeUndefined();
        act(() => root.render(<ExperienceControlIcon name={name} />));
        expect(container.childElementCount).toBe(0);
    }
});
