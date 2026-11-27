// The game's side of the page's avatar picker (src/avatar.ts): asking for
// the picker, hearing a choice, and reading it exactly as the page's own
// reader does (frontend/features/avatar-picker/pageAvatar.ts).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    AVATAR_KIND,
    AVATAR_PICKER_KIND,
    connectAvatar,
    readAvatarMessage,
} from "../src/avatar.ts";

const repo = new URL("../../../", import.meta.url);
const fixtures = JSON.parse(
    readFileSync(
        new URL("games/runtime/test/contract.fixtures.json", repo),
        "utf8"
    )
);
const page = await import(
    new URL("frontend/features/avatar-picker/pageAvatar.ts", repo).href
);
const origin = fixtures.avatarOrigin;

/** A game's window inside a page, or on its own. */
function frame({ embedded = true } = {}) {
    const handlers = new Set();
    const sent = [];
    const parent = {
        postMessage: (message, to) => sent.push({ message, to }),
    };
    const win = {
        location: { origin },
        addEventListener: (_, handler) => handlers.add(handler),
        removeEventListener: (_, handler) => handlers.delete(handler),
    };
    win.parent = embedded ? parent : win;
    const deliver = (data, from = {}) =>
        handlers.forEach((handler) =>
            handler({ source: parent, origin, data, ...from })
        );
    return { win, sent, deliver, handlers };
}

test("the game and the page name the two messages the same", () => {
    assert.equal(AVATAR_PICKER_KIND, page.AVATAR_PICKER_KIND);
    assert.equal(AVATAR_KIND, page.AVATAR_KIND);
});

test("both sides read an avatar message the same way", () => {
    assert.ok(fixtures.avatars.length > 10);
    for (const { name, message, expect } of fixtures.avatars) {
        assert.deepEqual(readAvatarMessage(message, origin), expect, name);
        assert.deepEqual(
            page.readAvatarMessage(message, origin),
            expect,
            `page: ${name}`
        );
    }
    // What the page builds for a choice is what the game reads back.
    const chosen = { id: "vrm-7", name: "Astro", url: "/a.vrm", scale: 2 };
    assert.deepEqual(readAvatarMessage(page.avatarMessage(chosen), origin), {
        ...chosen,
        url: `${origin}/a.vrm`,
    });
});

test("asking opens the page's picker; a choice reaches every listener", () => {
    const f = frame();
    const avatars = connectAvatar({ window: f.win });
    assert.equal(avatars.available, true);
    assert.equal(avatars.current, null);
    assert.equal(avatars.ask(), true);
    assert.deepEqual(f.sent, [
        { message: { type: "oncyber:game:avatar-picker" }, to: origin },
    ]);
    const heard = [];
    const stop = avatars.on((avatar) => heard.push(avatar.url));
    avatars.on((avatar) => heard.push(avatar.name));
    f.deliver({
        type: "oncyber:game:avatar",
        avatarUrl: "/models/a.vrm",
        avatarId: "a",
        avatarName: "Astro",
    });
    assert.deepEqual(heard, [`${origin}/models/a.vrm`, "Astro"]);
    assert.equal(avatars.current.id, "a");
    stop();
    f.deliver({ type: "oncyber:game:avatar", avatarUrl: "/models/b.vrm" });
    assert.deepEqual(heard.slice(2), ["Avatar"]);
    avatars.dispose();
    assert.equal(f.handlers.size, 0);
});

test("only the page is heard, and only a real avatar", () => {
    const f = frame();
    const avatars = connectAvatar({ window: f.win });
    const heard = [];
    avatars.on((avatar) => heard.push(avatar));
    const message = { type: "oncyber:game:avatar", avatarUrl: "/a.vrm" };
    f.deliver(message, { source: {} });
    f.deliver(message, { origin: "https://evil.test" });
    f.deliver({ ...message, type: "ace:avatar" });
    f.deliver({ ...message, type: "oncyber:game:avatar-picker" });
    f.deliver({ ...message, avatarUrl: "javascript:alert(1)" });
    f.deliver({ type: "oncyber:game:avatar" });
    assert.deepEqual(heard, []);
    assert.equal(avatars.current, null);
    // An old build's own prefix, when it says so.
    const old = connectAvatar({ window: f.win, prefix: "garden:" });
    old.on((avatar) => heard.push(avatar.url));
    f.deliver({ ...message, type: "garden:avatar" });
    assert.deepEqual(heard, [`${origin}/a.vrm`]);
});

test("standalone there is no page: nothing is asked and nothing is heard", () => {
    const f = frame({ embedded: false });
    const avatars = connectAvatar({ window: f.win });
    assert.equal(avatars.available, false);
    assert.equal(avatars.ask(), false);
    assert.deepEqual(f.sent, []);
    assert.equal(f.handlers.size, 0);
    avatars.dispose();
});
