import assert from "node:assert/strict";
import test from "node:test";
import {
    assignSeats,
    isHost,
    matchAuthority,
    readRoster,
    rosterEvents,
} from "../src/roster.ts";

const member = (id, order, extra = {}) => ({
    id,
    session: `s-${id}`,
    name: id.toUpperCase(),
    pfp: "",
    avatarUrl: "",
    seat: "player",
    state: "here",
    order,
    ...extra,
});
const roster = (self, host, members, online = true) =>
    readRoster({ self, host, online, members });
const types = (events) =>
    events.map((e) => (e.member ? `${e.type}:${e.member.id}` : e.type));

test("a roster from the page is cleaned: duplicates, junk and unknown host drop out", () => {
    const r = readRoster({
        self: "b",
        host: "zz",
        members: [
            member("b", 2),
            member("a", 1),
            member("a", 3),
            { id: 7 },
            null,
            { id: "c", seat: "spectator", state: "away", name: " " },
        ],
    });
    assert.deepEqual(
        r.members.map((m) => m.id),
        ["a", "b", "c"]
    );
    assert.equal(r.host, "");
    assert.equal(r.self, "b");
    assert.equal(r.members[2].name, "Player");
    assert.equal(r.members[2].seat, "spectator");
    assert.equal(readRoster("nope").members.length, 0);
});

test("the first roster lists who was already here; later arrivals are late", () => {
    const first = roster("b", "a", [member("a", 1), member("b", 2)]);
    const arrived = rosterEvents(null, first);
    assert.deepEqual(types(arrived), ["arrived:a", "arrived:b", "host:a"]);
    assert.ok(arrived.every((e) => e.type !== "arrived" || e.late === false));
    const second = roster("b", "a", [
        member("a", 1),
        member("b", 2),
        member("c", 3),
    ]);
    const late = rosterEvents(first, second);
    assert.deepEqual(types(late), ["arrived:c"]);
    assert.equal(late[0].late, true);
});

test("dropping, returning and leaving are separate events", () => {
    const here = roster("a", "a", [member("a", 1), member("b", 2)]);
    const away = roster("a", "a", [
        member("a", 1),
        member("b", 2, { state: "away", session: "" }),
    ]);
    assert.deepEqual(types(rosterEvents(here, away)), ["dropped:b"]);
    const back = roster("a", "a", [
        member("a", 1),
        member("b", 2, { session: "s-new" }),
    ]);
    assert.deepEqual(types(rosterEvents(away, back)), ["returned:b"]);
    assert.deepEqual(
        types(rosterEvents(away, roster("a", "a", [member("a", 1)]))),
        ["left:b"]
    );
    assert.deepEqual(rosterEvents(here, here), []);
});

test("the host role moves when the host drops, and says when it lands on this client", () => {
    const before = roster("b", "a", [member("a", 1), member("b", 2)]);
    const after = roster("b", "b", [
        member("a", 1, { state: "away" }),
        member("b", 2),
    ]);
    const events = rosterEvents(before, after);
    assert.deepEqual(types(events), ["dropped:a", "host:b"]);
    assert.equal(events[1].self, true);
    assert.equal(isHost(after), true);
    // The old host returns and does not take the role back.
    const returned = roster("b", "b", [member("a", 1), member("b", 2)]);
    assert.deepEqual(types(rosterEvents(after, returned)), ["returned:a"]);
});

test("this client's own connection going down and coming back is reported", () => {
    const up = roster("a", "a", [member("a", 1)]);
    const down = roster("a", "a", [member("a", 1)], false);
    assert.deepEqual(types(rosterEvents(up, down)), ["offline"]);
    assert.deepEqual(types(rosterEvents(down, up)), ["online"]);
});

test("seats: the first arrivals play, extras watch, an away member keeps the seat", () => {
    const r = roster("c", "a", [
        member("a", 1, { state: "away" }),
        member("b", 2),
        member("c", 3),
        member("d", 4, { seat: "spectator" }),
    ]);
    const { players, spectators } = assignSeats(r, 2);
    assert.deepEqual(
        players.map((m) => m.id),
        ["a", "b"]
    );
    assert.deepEqual(
        spectators.map((m) => m.id),
        ["c", "d"]
    );
    // A spectator promoted by the server is a seat event.
    const promoted = roster("c", "a", [
        member("b", 2),
        member("c", 3),
        member("d", 4),
    ]);
    assert.ok(types(rosterEvents(r, promoted)).includes("seat:d"));
});

test("a match has one authority: the host if playing, else the earliest player still here", () => {
    const r = roster("b", "a", [
        member("a", 1),
        member("b", 2),
        member("c", 3),
    ]);
    assert.equal(matchAuthority(r, ["a", "b"]), "a");
    assert.equal(matchAuthority(r, ["b", "c"]), "b");
    const dropped = roster("b", "b", [
        member("a", 1, { state: "away" }),
        member("b", 2),
        member("c", 3),
    ]);
    assert.equal(matchAuthority(dropped, ["a", "b"]), "b");
    const hostAway = roster("c", "a", [
        member("a", 1, { state: "away" }),
        member("b", 2, { state: "away" }),
        member("c", 3),
    ]);
    assert.equal(matchAuthority(hostAway, ["a", "b"]), "");
});
