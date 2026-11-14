// The listing in game.json must describe the game the code actually is:
// every party size it advertises has a format beyond the solo match, and no
// size it leaves out does.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { partyFormats } from "../src/party.js";
import { readParty } from "../src/host.js";

const { listing } = JSON.parse(
    readFileSync(new URL("../game.json", import.meta.url), "utf8")
);

test("listed party sizes are the sizes with a party format", () => {
    const withFormat = [];
    for (let size = 2; size <= 8; size++)
        if (partyFormats(size).some((format) => format.id !== "cpu"))
            withFormat.push(size);
    assert.deepEqual(listing.partySizes, withFormat);
    assert.equal(listing.players.min, 1); // the solo match
    assert.equal(listing.players.max, Math.max(...withFormat));
});

test("a late arrival's party has no members yet", () => {
    const id = "trip_0123456789abcdef";
    assert.deepEqual(readParty({ id, size: 1, members: [], late: true }), {
        id,
        size: 1,
        members: [],
        late: true,
    });
    // Without the flag an empty party is still nobody's party.
    assert.equal(readParty({ id, size: 1, members: [] }), null);
});
