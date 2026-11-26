// The page's half of the contract and the game's must be the same contract.
// This file loads both and compares what each one says and does: the
// version, the prefix, the limits, and the answer of both readers to every
// case in contract.fixtures.json (the page's own Jest test runs the same
// cases: frontend/features/games/contract/gameContract.test.ts).
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
    ARRIVAL_VIEW_LIMITS,
    CONTRACT_VERSION,
    GAME_MESSAGE_PREFIX,
    NAME_MAX,
    gameMessageKind,
    readArrivalView,
    readTrip,
} from "../src/contract.ts";
import {
    MATCH_BURST,
    MATCH_MAX_BYTES,
    MATCH_RATE,
    MATCH_SEND_RATE,
} from "../src/match.ts";
import { ROSTER_MAX } from "../src/roster.ts";

const repo = new URL("../../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, repo), "utf8");
const fixtures = JSON.parse(read("games/runtime/test/contract.fixtures.json"));
const page = await import(
    new URL("frontend/features/games/contract/gameContract.ts", repo).href
);
/** `export const NAME = 12` (or `const NAME = 12`) in a file this test cannot import. */
function constant(path, name) {
    const found = read(path).match(
        new RegExp(`(?:^|\\n)(?:export )?const ${name} = ([0-9_]+);`)
    );
    assert.ok(found, `${path} no longer states ${name}`);
    return Number(found[1].replaceAll("_", ""));
}

test("both halves state the same version, prefix and name length", () => {
    assert.equal(page.CONTRACT_VERSION, CONTRACT_VERSION);
    assert.equal(page.GAME_MESSAGE_PREFIX, GAME_MESSAGE_PREFIX);
    assert.equal(page.GAME_NAME_MAX, NAME_MAX);
    // The page still runs the contract before this one, and no older.
    assert.ok(page.CONTRACT_OLDEST <= CONTRACT_VERSION);
    assert.equal(page.contractSupport(CONTRACT_VERSION), "current");
});

test("both halves read a message's kind the same way", () => {
    for (const { type, game, kind, legacy } of fixtures.messageTypes) {
        assert.equal(gameMessageKind(type, game), kind, String(type));
        const read = page.readGameMessage(type, game);
        assert.equal(read?.kind ?? null, kind, String(type));
        if (read) assert.equal(read.dialect === "legacy", legacy, type);
    }
});

test("both halves accept and refuse the same arrival views", () => {
    for (const { name, view, expect } of fixtures.arrivalViews) {
        assert.deepEqual(readArrivalView(view), expect, `runtime: ${name}`);
        assert.deepEqual(page.gameArrivalView(view), expect, `page: ${name}`);
    }
    // A view the page sends is one the game keeps, at each stated bound.
    const view = fixtures.arrivalViews[0].view;
    const [fovMin, fovMax] = ARRIVAL_VIEW_LIMITS.fov;
    const [heightMin, heightMax] = ARRIVAL_VIEW_LIMITS.avatarHeight;
    for (const change of [
        { fov: fovMin },
        { fov: fovMax },
        { fov: fovMin + 0.01 },
        { fov: fovMax - 0.01 },
        { avatarHeight: heightMin },
        { avatarHeight: heightMax },
        { avatarHeight: heightMax + 0.01 },
        { avatarRotation: ARRIVAL_VIEW_LIMITS.rotation },
        { avatarRotation: ARRIVAL_VIEW_LIMITS.rotation * 2 },
        { cameraOffset: { x: ARRIVAL_VIEW_LIMITS.offset, y: 0, z: 0 } },
        { cameraOffset: { x: ARRIVAL_VIEW_LIMITS.offset + 1, y: 0, z: 0 } },
    ])
        assert.deepEqual(
            page.gameArrivalView({ ...view, ...change }),
            readArrivalView({ ...view, ...change }),
            JSON.stringify(change)
        );
});

test("both halves cut a name at the same length", () => {
    for (const { name, expect } of fixtures.names) {
        assert.equal(page.gameName(name), expect);
        // The runtime's reader, through a trip's member.
        const member = readTrip({ id: "t", members: [{ id: "a", name }] })
            .members[0];
        assert.equal(member.name, expect || "Player");
    }
    // What the page puts in a trip is what the game reads back.
    const long = "x".repeat(NAME_MAX + 9);
    const trip = page.gameTrip(
        { id: "t", size: 2, members: [] },
        "room",
        "s1",
        [{ id: "s2", name: long, pfp: "", vrm: "" }]
    );
    assert.equal(trip.arrived[0].name, readTrip(trip).arrived[0].name);
});

test("the match channel has one set of limits: runtime, page, check and server", () => {
    const limits = {
        MATCH_RATE,
        MATCH_BURST,
        MATCH_MAX_BYTES,
    };
    const places = [
        "frontend/features/games/room/gameMatch.ts",
        "scripts/games/party-check.mjs",
        // Not in a packed copy of the SDK, and not ours to edit: read only.
        "multiplayer/src/rooms/cyber/match/limits.ts",
    ].filter((path) => existsSync(new URL(path, repo)));
    assert.ok(places.length >= 2);
    for (const path of places)
        for (const [name, value] of Object.entries(limits))
            assert.equal(constant(path, name), value, `${path} ${name}`);
    // The runtime sends under the limit, so a late timer never crosses it.
    assert.ok(MATCH_SEND_RATE < MATCH_RATE && MATCH_SEND_RATE >= 20);
    assert.equal(
        constant("frontend/features/games/room/gameMatch.ts", "ROSTER_MAX"),
        ROSTER_MAX
    );
});
