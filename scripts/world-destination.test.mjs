import { test } from "node:test";
import assert from "node:assert/strict";
import {
    destinationCommand,
    readHeight,
    standingHeight,
} from "./world-destination.mjs";

test("how tall avatars stand: the setting, else the eye height, else their own", () => {
    assert.deepEqual(standingHeight({ avatarSize: 0.8571, user_height: 2.3 }), {
        height: 4,
        from: "its avatar height setting",
    });
    // The Starry Night dome before it was given a height.
    assert.equal(standingHeight({ user_height: 2.3 }).height, 2.47);
    assert.equal(standingHeight({}).height, null);
    assert.equal(standingHeight(undefined).height, null);
});

test("a height is a number avatars can stand at, or unset", () => {
    assert.deepEqual(readHeight(undefined), { read: true });
    assert.deepEqual(readHeight("unset"), { height: null });
    assert.deepEqual(readHeight("4"), { height: 4 });
    for (const bad of ["0.5", "9", "tall", ""])
        assert.match(readHeight(bad).error, /from 1 to 4.5/);
});

test("reads, sets and unsets a destination's avatar height by its slug", async () => {
    const calls = [];
    const params = { user_height: 2.3 };
    const rpc = async (method, input) => {
        calls.push([method, input]);
        if (method === "getDestinationBySlug")
            return input.slug === "dome" ? { _id: "d1", params } : null;
        if (method === "setAvatarHeight")
            return { success: true, height: input.height };
        throw new Error(method);
    };
    const said = [];
    const io = { log: (line) => said.push(line) };

    await destinationCommand(["avatar-height", "dome"], rpc, io);
    assert.match(
        said.pop(),
        /dome: avatars stand 2.47 units tall, from its eye height \(2.3\)/
    );
    assert.equal(calls.length, 1);

    await destinationCommand(["avatar-height", "dome", "4"], rpc, io);
    assert.deepEqual(calls.pop(), ["setAvatarHeight", { id: "d1", height: 4 }]);
    assert.match(said.pop(), /Every space built on this destination/);
    assert.match(said.pop(), /stand 4 units tall now \(they stood 2.47\)/);

    await destinationCommand(["avatar-height", "dome", "unset"], rpc, io);
    assert.deepEqual(calls.pop(), [
        "setAvatarHeight",
        { id: "d1", height: null },
    ]);

    await assert.rejects(
        destinationCommand(["avatar-height", "nowhere", "4"], rpc, io),
        /No destination is called "nowhere"/
    );
    // A bad height is refused before anything is asked of the server.
    const before = calls.length;
    await assert.rejects(
        destinationCommand(["avatar-height", "dome", "12"], rpc, io),
        /from 1 to 4.5/
    );
    assert.equal(calls.length, before);
    await assert.rejects(
        destinationCommand(["rename", "dome"], rpc, io),
        /Usage/
    );
});
