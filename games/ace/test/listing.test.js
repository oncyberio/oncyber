// The listing in game.json must describe the game the code actually is:
// the party block (the one declaration of sizes and formats, which the
// listing's party sizes are read from) offers exactly what the game's format
// rules do, and the player counts span them.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { partyFormats } from "../../runtime/src/party.ts";
import { readTrip, tripPlayers } from "../../runtime/src/contract.ts";
import { partySizesOf } from "../../../scripts/games/listing.mjs";

const manifest = JSON.parse(
    readFileSync(new URL("../game.json", import.meta.url), "utf8")
);
const { listing, party } = manifest;

test("listed party sizes are the sizes with a party format", () => {
    const withFormat = [];
    for (let size = 2; size <= 8; size++)
        if (partyFormats(size).some((format) => format.id !== party.solo))
            withFormat.push(size);
    assert.deepEqual(partySizesOf(manifest), withFormat);
    assert.equal(listing.players.min, 1); // the solo match
    assert.equal(listing.players.max, Math.max(...withFormat));
    // Declared once: not in the listing.
    assert.equal(listing.partySizes, undefined);
    assert.equal(listing.devices, undefined);
});

test("a late arrival's trip has no members yet: the roster names them", () => {
    const id = "trip_0123456789abcdef";
    // What the page sends for a join link (gamePartyJoin.ts), before the
    // party's room has answered.
    const late = readTrip({ id, size: 1, members: [], late: true });
    assert.equal(late.id, id);
    assert.deepEqual(late.members, []);
    assert.deepEqual(tripPlayers(late, { name: "Me" }), [
        { id: "self", name: "Me" },
    ]);
    // Once the room's roster arrives, it is the party, the late arrival last.
    const joined = readTrip({
        id,
        size: 1,
        members: [],
        late: true,
        self: "c",
        roster: {
            self: "m3",
            host: "m1",
            members: [
                { id: "m1", name: "Ada", seat: "player", order: 0 },
                { id: "m2", name: "Bo", seat: "player", order: 1 },
                { id: "m3", name: "Me", seat: "player", order: 2 },
            ],
        },
    });
    assert.deepEqual(
        tripPlayers(joined, { name: "Me" }).map((p) => p.id),
        ["m3", "m1", "m2"]
    );
});
