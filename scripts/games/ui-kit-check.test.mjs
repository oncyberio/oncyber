import assert from "node:assert/strict";
import { test } from "node:test";
import { menuScreens, uiKitReport } from "./ui-kit-check.mjs";

const el = (tag, props = {}, children = []) => ({
    tag,
    id: "",
    classes: [],
    role: "",
    hidden: false,
    href: false,
    type: "",
    ...props,
    children,
});
const button = (classes = []) => el("button", { classes });

test("a block with two or more controls is a menu screen", () => {
    const body = el("body", {}, [
        el("canvas"),
        el("div", { id: "title" }, [el("nav", {}, [button(), button()])]),
        el("div", { id: "hud" }, [button()]),
    ]);
    assert.deepEqual(menuScreens(body), [
        { name: "#title", controls: 2, kit: false },
    ]);
});

test("kit classes anywhere in the screen count", () => {
    const body = el("body", {}, [
        el("div", { id: "setup" }, [
            el("div", { classes: ["oui-panel"] }, [
                button(["oui-button"]),
                button(["oui-button"]),
            ]),
        ]),
        el("div", { id: "pause" }, [button(["pill"]), button(["pill"])]),
    ]);
    const { screens, warnings } = uiKitReport([body]);
    assert.deepEqual(
        screens.map((s) => [s.name, s.kit]),
        [
            ["#setup", true],
            ["#pause", false],
        ]
    );
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].code, "UI_KIT_UNUSED");
    assert.match(warnings[0].message, /1 of 2 .*#pause/);
});

test("a class that only starts like the kit's does not count", () => {
    const body = el("body", {}, [
        el("div", { id: "menu", classes: ["ouija"] }, [button(), button()]),
    ]);
    assert.equal(menuScreens(body)[0].kit, false);
});

test("aria-hidden blocks, canvases and hidden inputs are not menus", () => {
    const body = el("body", {}, [
        el("div", { classes: ["touch-pad"], hidden: true }, [
            button(),
            button(),
            button(),
        ]),
        el("form", {}, [el("input", { type: "hidden" }), button()]),
    ]);
    assert.deepEqual(menuScreens(body), []);
    assert.deepEqual(uiKitReport([body]).warnings, []);
});

test("a single wrapper is stepped through to the screens inside", () => {
    const body = el("body", {}, [
        el("div", { id: "app" }, [
            el("section", { id: "lobby" }, [
                button(["oui-button"]),
                el("a", { href: true }),
            ]),
            el("section", { id: "settings" }, [
                el("div", { role: "switch" }),
                el("select"),
            ]),
        ]),
    ]);
    assert.deepEqual(
        menuScreens(body).map((s) => [s.name, s.kit]),
        [
            ["#lobby", true],
            ["#settings", false],
        ]
    );
});

test("a lone screen is not mistaken for a wrapper", () => {
    const body = el("body", {}, [
        el("div", { id: "menu" }, [button(), button()]),
    ]);
    assert.deepEqual(
        menuScreens(body).map((s) => s.name),
        ["#menu"]
    );
});

test("every frame is reported, and no screens means no warning", () => {
    const game = el("body", {}, [el("canvas")]);
    const ui = el("body", {}, [
        el("div", { classes: ["tray"] }, [button(), button()]),
    ]);
    assert.deepEqual(uiKitReport([game]).warnings, []);
    assert.match(uiKitReport([game, ui]).warnings[0].message, /\.tray/);
});
