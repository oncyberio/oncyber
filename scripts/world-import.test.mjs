// node --test scripts/world-import.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { describeCopy, localCopy } from "../local-dev/import.mjs";
import {
    importCommand,
    spaceLines,
    spaceRef,
    spacesCommand,
} from "./world-import.mjs";

const exported = (space = {}, destination = null) => ({
    id: "Em8Sj1LhKXg3mOIeIp6K",
    space: {
        owner: "0xowner",
        editors: [],
        info: {
            headline: "Starry Night",
            customLink: "starry",
            room: "sky-house",
        },
        artworks: { a: { id: "a" } },
        kitbash: {
            k1: { id: "k1", type: "mesh" },
            k2: { id: "k2", type: "mesh" },
        },
        portals: { p: { id: "p" } },
        createdAt: "2024-03-01T10:00:00.000Z",
        ...space,
    },
    destination,
});

test("what names a space: a link, an id, or the address of either", () => {
    assert.deepEqual(spaceRef("starry"), { link: "starry" });
    assert.deepEqual(spaceRef("https://oncyber.io/starry?ref=x"), {
        link: "starry",
    });
    assert.deepEqual(spaceRef("https://oncyber.io/spaces/abc123"), {
        id: "abc123",
    });
    assert.deepEqual(spaceRef("/spaces/abc123"), { id: "abc123" });
    assert.deepEqual(spaceRef("Em8Sj1LhKXg3mOIeIp6K"), {
        id: "Em8Sj1LhKXg3mOIeIp6K",
        maybeLink: true,
    });
    assert.equal(spaceRef(""), null);
    assert.equal(spaceRef(undefined), null);
    assert.equal(spaceRef("https://oncyber.io/"), null);
});

test("the account's spaces, most visited first", () => {
    const lines = spaceLines(
        {
            currentId: "b",
            spaces: [
                {
                    id: "a",
                    visits: 1,
                    invited: true,
                    info: { headline: "Quiet" },
                },
                {
                    id: "b",
                    visits: 90,
                    invited: false,
                    info: { headline: "Busy", customLink: "busy" },
                },
            ],
        },
        "https://oncyber.io"
    );
    assert.equal(lines[0], "2 spaces on https://oncyber.io:");
    assert.match(lines[1], /^  Busy\s+\/busy\s+b  90 visits  current$/);
    assert.match(
        lines[2],
        /^  Quiet\s+\/spaces\/a\s+a  1 visit  shared with you$/
    );
    assert.deepEqual(spaceLines({ spaces: [] }, "https://oncyber.io"), [
        "No spaces on https://oncyber.io for this account.",
    ]);
});

test("spaces asks the site for the account's own, as lines or as JSON", async () => {
    const mine = { currentId: "", spaces: [{ id: "a", visits: 0, info: {} }] };
    const asked = [];
    const rpc = async (method, params) => (asked.push([method, params]), mine);
    const out = [];
    await spacesCommand([], rpc, {
        site: "https://oncyber.io",
        log: (line) => out.push(line),
    });
    assert.deepEqual(asked, [["listMine", {}]]);
    assert.match(out[1], /\(no name\)/);
    const json = [];
    await spacesCommand(["--json"], rpc, {
        site: "x",
        log: (line) => json.push(line),
    });
    assert.deepEqual(JSON.parse(json[0]), mine);
});

test("the copy is the demo account's, opens for anyone, and says what it left off", () => {
    const copy = localCopy(
        exported({ gating: { password: { message: "Ask", rev: "r" } } }),
        { now: 1700 }
    );
    assert.equal(copy.doc.owner, "demo-user-1");
    assert.deepEqual(copy.doc.editors, []);
    assert.equal(copy.doc.gating, undefined);
    assert.equal(copy.doc.lastUpdatedAt, 1700);
    assert.equal(copy.leftOff.length, 2);
    assert.match(copy.leftOff[0], /its gate \(password\)/);
    assert.match(copy.leftOff[1], /its owner and editors/);
    assert.deepEqual(copy.about, {
        name: "Starry Night",
        link: "starry",
        room: "sky-house",
        artworks: 1,
        kitbash: 2,
        portals: 1,
        scripts: 0,
        runtime: null,
    });
});

test("objects and portals go where the real space keeps them", () => {
    // A small space keeps both in its document.
    const small = localCopy(exported());
    assert.equal(Object.keys(small.doc.kitbash).length, 2);
    assert.equal(Object.keys(small.doc.portals).length, 1);
    assert.deepEqual(small.kitbash, {});
    assert.deepEqual(small.portals, {});
    // A large one keeps them beside it, where the app reads them from.
    const large = localCopy(exported({ hasKitbash: true, storageVersion: 2 }));
    assert.equal(large.doc.kitbash, undefined);
    assert.deepEqual(large.doc.portals, {});
    assert.equal(Object.keys(large.kitbash).length, 2);
    assert.equal(Object.keys(large.portals).length, 1);
});

test("the copy does not change what it was given, and needs a space", () => {
    const given = exported({ hasKitbash: true });
    const before = JSON.stringify(given);
    localCopy(given);
    assert.equal(JSON.stringify(given), before);
    assert.throws(() => localCopy({}), /no space to copy/);
});

test("what the copy is and where it opens", () => {
    const world = { id: "d1", doc: { slug: "sky-house" } };
    const lines = describeCopy(
        localCopy(
            exported(
                {
                    worldScripts: [{ id: "s" }],
                    runtime: {
                        kind: "awe-app",
                        url: "https://awe.box/play/abc",
                    },
                },
                world
            )
        )
    );
    assert.equal(lines[0], 'Copied "Starry Night" into the local stack.');
    assert.match(lines[1], /open\s+http:\/\/localhost:13000\/starry$/);
    assert.match(
        lines[3],
        /1 artworks, 2 placed objects, 1 portals, 1 world script$/
    );
    assert.ok(
        lines.some((line) => /world\s+sky-house \(copied with it\)/.test(line))
    );
    assert.ok(
        lines.some((line) =>
            /outside content \(awe-app\) from https:\/\/awe\.box\/play\/abc/.test(
                line
            )
        )
    );
    assert.match(lines.at(-1), /Nothing done here reaches the real space/);

    const taken = describeCopy(localCopy(exported()), { linkTaken: true });
    assert.match(taken[1], /\/spaces\/Em8Sj1LhKXg3mOIeIp6K$/);
    assert.ok(
        taken.some((line) =>
            /its link \/starry is another local space's/.test(line)
        )
    );
});

test("import reads by link or id, writes the copy, and says where it is", async () => {
    const asked = [];
    const rpc = async (method, params) => (
        asked.push([method, params]), exported()
    );
    const written = [];
    const out = [];
    const local = {
        localCopy,
        describeCopy,
        writeLocalCopy: async (copy) => (
            written.push(copy), { linkTaken: false }
        ),
    };
    await importCommand(["https://oncyber.io/starry"], rpc, {
        site: "https://oncyber.io",
        log: (line) => out.push(line),
        local,
    });
    assert.deepEqual(asked, [["exportSpace", { link: "starry" }]]);
    assert.equal(written.length, 1);
    assert.equal(written[0].doc.owner, "demo-user-1");
    assert.equal(out[0], 'Read "Starry Night" from https://oncyber.io.');
    assert.equal(out[1], 'Copied "Starry Night" into the local stack.');
});

test("twenty letters and digits are tried as an id, then as a link", async () => {
    const asked = [];
    const rpc = async (method, params) => {
        asked.push(params);
        if (params.id) throw new Error("exportSpace failed: No space of yours");
        return exported();
    };
    const local = { localCopy, describeCopy, writeLocalCopy: async () => ({}) };
    await importCommand(["abcdefghij0123456789"], rpc, {
        site: "s",
        log() {},
        local,
    });
    assert.deepEqual(asked, [
        { id: "abcdefghij0123456789" },
        { link: "abcdefghij0123456789" },
    ]);
    // A plain link that is refused is refused: nothing else to try.
    await assert.rejects(
        importCommand(
            ["mine"],
            async () => {
                throw new Error("No space of yours");
            },
            { site: "s", log() {}, local }
        ),
        /No space of yours/
    );
    await assert.rejects(
        importCommand([], rpc, { site: "s", log() {}, local }),
        /Usage: world import/
    );
});
