import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
    drift,
    FONTS,
    kitDir,
    loadTokens,
    renderKit,
    variables,
} from "../scripts/generate.mjs";
import { nextIndex } from "../src/index.ts";

const css = readFileSync(join(kitDir, "oncyber-ui.css"), "utf8");

test("the committed CSS and fonts match the design tokens", async () => {
    assert.deepEqual(
        await drift(),
        [],
        "run `pnpm games:ui` and commit the result"
    );
});

test("a token change changes the CSS", async () => {
    const tokens = await loadTokens();
    const changed = structuredClone(tokens);
    changed.base.color.ink = "#123456";
    assert.notEqual(renderKit(changed), renderKit(tokens));
    assert.match(renderKit(changed), /--oui-ink: #123456;/);
});

test("the button is the action spec", async () => {
    const { action, base, lobby } = await loadTokens();
    const vars = variables(await loadTokens());
    assert.equal(vars["action-height"], `${action.size.minHeight}px`);
    assert.equal(
        vars["action-padding"],
        `${action.size.paddingY}px ${action.size.paddingX}px`
    );
    assert.equal(vars["radius-control"], `${base.radius.control}px`);
    assert.equal(
        vars["focus-ring"],
        `${action.state.focusWidth}px solid ${base.color.accent}`
    );
    assert.equal(vars["touch-target"], `${lobby.control.touchSize}px`);
    const rule = css.slice(
        css.indexOf("\n.oui-button {"),
        css.indexOf("}", css.indexOf("\n.oui-button {"))
    );
    for (const part of [
        "min-height: var(--oui-action-height)",
        "padding: var(--oui-action-padding)",
        "border-radius: var(--oui-radius-control)",
        "font: var(--oui-action-font) var(--oui-font)",
    ])
        assert.ok(rule.includes(part), part);
    assert.match(
        css,
        /@media \(pointer: coarse\) \{\s*\.oui-button,[^}]*min-height: var\(--oui-touch-target\)/
    );
});

test("elements take every colour, size and time from the variables", () => {
    const elements = css.slice(css.indexOf("/* The elements."));
    assert.equal(
        elements.match(/#[0-9a-f]{3,8}\b/gi),
        null,
        "no hex colours outside :root"
    );
    assert.equal(
        elements.match(/\b\d+m?s\b/g),
        null,
        "no literal durations outside :root"
    );
    for (const name of elements.matchAll(/var\(--oui-([a-z0-9-]+)/g))
        assert.ok(css.includes(`--oui-${name[1]}:`), name[1]);
});

test("every element the kit promises is there", () => {
    for (const name of [
        "button",
        "panel",
        "list",
        "toggle",
        "segmented",
        "dialog",
        "toast",
        "score",
    ])
        assert.match(css, new RegExp(`\\n\\.oui-${name}[ ,:.\\[>]`), name);
    assert.match(css, /prefers-reduced-motion: reduce/);
    assert.match(css, /:focus-visible/);
});

test("only open fonts ship, and nothing loads from outside the kit", () => {
    const fonts = readFileSync(join(kitDir, "fonts.css"), "utf8");
    assert.doesNotMatch(css + fonts, /Aeonik-|\/fonts\/licensed|https?:/);
    for (const [file] of FONTS)
        assert.ok(fonts.includes(`url("./fonts/${file}")`), file);
    assert.doesNotMatch(css, /url\(/);
});

test("arrow keys wrap through a row of options", () => {
    assert.equal(nextIndex(3, 0, "ArrowRight"), 1);
    assert.equal(nextIndex(3, 2, "ArrowRight"), 0);
    assert.equal(nextIndex(3, 0, "ArrowLeft"), 2);
    assert.equal(nextIndex(3, 1, "Home"), 0);
    assert.equal(nextIndex(3, 1, "End"), 2);
    assert.equal(nextIndex(3, 1, "Enter"), 1);
    assert.equal(nextIndex(3, -1, "ArrowDown"), 1);
    assert.equal(nextIndex(0, 0, "ArrowDown"), -1);
});
