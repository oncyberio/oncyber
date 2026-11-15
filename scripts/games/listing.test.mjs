import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
    CATALOG_PATH,
    GENERATED_THUMBNAIL,
    buildCatalog,
    catalogEntry,
    catalogStale,
    checkListing,
    listingStage,
    partySizesOf,
    readManifests,
    renderCatalog,
} from "./listing.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
// Devices and party sizes are declared once, outside the listing: the
// top-level `devices` (docs/games/devices.md) and the `party` block
// (docs/games/party.md). This game has formats for parties of 2 and 4.
const good = () => ({
    name: "Test Game",
    devices: ["phone", "desktop"],
    party: {
        sizes: [1, 4],
        formats: [
            { id: "singles", label: "1 v 1", sizes: [2] },
            { id: "doubles", label: "2 v 2", sizes: [4] },
            { id: "solo", label: "Solo", sizes: [1, 2, 3, 4] },
        ],
        solo: "solo",
    },
    listing: {
        tagline: "a game for the tests",
        description: "Hit the ball over the net until somebody misses it.",
        players: { min: 1, max: 4 },
        tags: ["sports", "co-op"],
    },
});
/** The same game with no format for a party: only the solo option. */
const noParties = (manifest) => {
    manifest.party.formats = manifest.party.formats.filter(
        (format) => format.id === "solo"
    );
    return manifest;
};
const codes = (manifest, options) =>
    checkListing(manifest, options).findings.map((f) => f.code);

test("a complete listing passes and is normalised", () => {
    const { findings, listing } = checkListing(good());
    assert.deepEqual(findings, []);
    assert.deepEqual(listing.devices, ["desktop", "phone"]);
    assert.deepEqual(listing.partySizes, [2, 4]);
    assert.equal(listing.thumbnail, GENERATED_THUMBNAIL);
});

test("a missing listing or description fails", () => {
    assert.deepEqual(codes({ name: "x" }), ["LISTING_MISSING"]);
    for (const description of [
        undefined,
        "",
        "   ",
        "Too short.",
        "x".repeat(201),
        "See <b>this</b> game, it is a very good one.",
    ]) {
        const manifest = good();
        manifest.listing.description = description;
        assert.deepEqual(
            codes(manifest),
            ["LISTING_DESCRIPTION"],
            String(description)
        );
    }
});

test("a thumbnail must exist: the game's own file or the check's screenshot", () => {
    // None declared and the check took none.
    assert.deepEqual(codes(good(), { build: new Set(["index.html"]) }), [
        "LISTING_THUMBNAIL",
    ]);
    assert.deepEqual(
        codes(good(), { build: new Set(["index.html", GENERATED_THUMBNAIL]) }),
        []
    );
    const own = good();
    own.listing.thumbnail = "public/preview.jpg";
    assert.equal(checkListing(own).listing.thumbnail, "preview.jpg");
    assert.deepEqual(codes(own, { build: new Set(["index.html"]) }), [
        "LISTING_THUMBNAIL",
    ]);
    assert.deepEqual(
        codes(own, {
            build: new Set(["preview.jpg"]),
            sizes: new Map([["preview.jpg", 600 * 1024]]),
        }),
        ["LISTING_THUMBNAIL"]
    );
    assert.deepEqual(
        codes(own, {
            build: new Set(["preview.jpg"]),
            sizes: new Map([["preview.jpg", 90_000]]),
        }),
        []
    );
    for (const thumbnail of [
        "../other/preview.jpg",
        "/preview.jpg",
        "preview.gif",
        GENERATED_THUMBNAIL,
        3,
    ]) {
        own.listing.thumbnail = thumbnail;
        assert.deepEqual(codes(own), ["LISTING_THUMBNAIL"], String(thumbnail));
    }
});

test("player counts must agree with the party sizes", () => {
    const tooFew = good();
    tooFew.listing.players = { min: 1, max: 2 }; // but offers a party of 4
    assert.deepEqual(codes(tooFew), ["LISTING_PLAYERS"]);
    assert.match(checkListing(tooFew).findings[0].message, /party of 4/);

    const tooMany = good();
    tooMany.listing.players = { min: 3, max: 4 }; // a party of 2 can't play
    assert.deepEqual(codes(tooMany), ["LISTING_PLAYERS"]);

    const nowhere = noParties(good()); // up to 4 players, but no way to meet
    assert.deepEqual(codes(nowhere), ["LISTING_PLAYERS"]);
    nowhere.page = { room: "oncyber-test-game-v1" };
    assert.deepEqual(codes(nowhere), []);

    const solo = good();
    solo.listing.players = { min: 1, max: 1 };
    assert.deepEqual(codes(solo), ["LISTING_PLAYERS"]); // still offers parties
    noParties(solo);
    assert.deepEqual(codes(solo), []);

    for (const players of [
        undefined,
        { min: 0, max: 2 },
        { min: 3, max: 2 },
        { min: 1 },
        { min: 1, max: 1.5 },
    ]) {
        const manifest = good();
        manifest.listing.players = players;
        assert.deepEqual(
            codes(manifest),
            ["LISTING_PLAYERS"],
            JSON.stringify(players)
        );
    }
    // The party block is the one declaration: the listing can't restate it.
    for (const partySizes of [[2, 4], [9], "2"]) {
        const manifest = good();
        manifest.listing.partySizes = partySizes;
        assert.deepEqual(
            codes(manifest),
            ["LISTING_PARTY_SIZES"],
            JSON.stringify(partySizes)
        );
    }
});

test("party sizes are read from the party block's formats", () => {
    assert.deepEqual(partySizesOf(good()), [2, 4]);
    assert.deepEqual(partySizesOf(noParties(good())), []);
    assert.deepEqual(partySizesOf({ name: "x" }), []);
    // A format outside the declared range offers nothing.
    const capped = good();
    capped.party.sizes = [1, 2];
    assert.deepEqual(partySizesOf(capped), [2]);
});

test("devices, tags and tagline are checked", () => {
    const manifest = good();
    manifest.devices = ["desktop", "console"];
    manifest.listing.tags = ["Sports"];
    manifest.listing.tagline = "";
    assert.deepEqual(codes(manifest).sort(), [
        "LISTING_DEVICES",
        "LISTING_TAGLINE",
        "LISTING_TAGS",
    ]);
    // Devices are the manifest's, never the listing's own list.
    const none = good();
    delete none.devices;
    assert.deepEqual(codes(none), ["LISTING_DEVICES"]);
    const twice = good();
    twice.listing.devices = ["desktop"];
    assert.deepEqual(codes(twice), ["LISTING_DEVICES"]);
});

test("a catalog entry carries the listing and the page settings", () => {
    const manifest = good();
    manifest.page = {
        room: "oncyber-test-game-v1",
        relay: true,
        crowdLabel: "on court",
        controls: { top: 14 },
    };
    assert.deepEqual(catalogEntry("test", manifest), {
        id: "test",
        title: "Test Game",
        tagline: "a game for the tests",
        description: "Hit the ball over the net until somebody misses it.",
        thumbnail: "/games/test/thumbnail.jpg",
        players: { min: 1, max: 4 },
        partySizes: [2, 4],
        devices: ["desktop", "phone"],
        tags: ["sports", "co-op"],
        room: "oncyber-test-game-v1",
        relay: true,
        crowdLabel: "on court",
        controlsStyle: { top: 14 },
    });
    // A game with no room of its own keeps its room for chat and voice.
    manifest.page = { socialRoom: "oncyber-test-social-v1" };
    assert.equal(
        catalogEntry("test", manifest).socialRoom,
        "oncyber-test-social-v1"
    );
    manifest.page.room = "oncyber-test-game-v1";
    assert.deepEqual(codes(manifest), ["LISTING_ROOM"]);
    assert.throws(
        () => catalogEntry("test", { name: "x" }),
        /games\/test\/game\.json/
    );
});

test("the catalog goes stale when a manifest changes", () => {
    const dir = mkdtempSync(join(tmpdir(), "listing-"));
    mkdirSync(join(dir, "games/test"), { recursive: true });
    mkdirSync(join(dir, dirname(CATALOG_PATH)), { recursive: true });
    const manifest = good();
    const write = () =>
        writeFileSync(
            join(dir, "games/test/game.json"),
            JSON.stringify(manifest)
        );
    write();
    assert.match(catalogStale(dir), /out of date/);
    writeFileSync(
        join(dir, CATALOG_PATH),
        renderCatalog(buildCatalog(readManifests(dir)))
    );
    assert.equal(catalogStale(dir), null);
    manifest.listing.tags.push("new");
    write();
    assert.match(catalogStale(dir), /out of date/);
    delete manifest.listing.description;
    write();
    assert.match(catalogStale(dir), /can't be generated/);
});

test("the stage takes the thumbnail once, unless the game brings its own", async () => {
    const dir = mkdtempSync(join(tmpdir(), "listing-"));
    const out = join(dir, "frontend/public/games/test");
    mkdirSync(out, { recursive: true });
    mkdirSync(join(dir, "games/test"), { recursive: true });
    mkdirSync(join(dir, dirname(CATALOG_PATH)), { recursive: true });
    writeFileSync(join(out, "index.html"), "");
    const manifest = good();
    writeFileSync(join(dir, "games/test/game.json"), JSON.stringify(manifest));
    writeFileSync(
        join(dir, CATALOG_PATH),
        renderCatalog(buildCatalog(readManifests(dir)))
    );
    let shots = 0;
    const page = {
        screenshot: async ({ path }) => (shots++, writeFileSync(path, "jpeg")),
    };
    const stage = (extra = {}) =>
        listingStage({
            root: dir,
            out,
            manifest,
            page,
            booted: true,
            ...extra,
        });

    // A game that never booted has nothing to take a thumbnail from.
    assert.deepEqual(
        (await stage({ booted: false })).findings.map((f) => f.code),
        ["LISTING_THUMBNAIL"]
    );
    const first = await stage();
    assert.deepEqual(first.findings, []);
    assert.equal(first.summary.thumbnailTaken, true);
    assert.equal((await stage()).summary.thumbnailTaken, false);
    assert.equal((await stage({ retake: true })).summary.thumbnailTaken, true);
    assert.equal(shots, 2);

    manifest.listing.thumbnail = "preview.jpg";
    writeFileSync(join(out, "preview.jpg"), "jpeg");
    writeFileSync(join(dir, "games/test/game.json"), JSON.stringify(manifest));
    const own = await stage({ retake: true });
    assert.equal(own.summary.thumbnail, "preview.jpg");
    assert.equal(shots, 2);
    // The manifest changed, so the committed catalog is now behind it.
    assert.deepEqual(
        own.findings.map((f) => f.code),
        ["LISTING_CATALOG_STALE"]
    );
});

test("this repository's games have listings and a current catalog", () => {
    const manifests = readManifests(root);
    assert.ok(Object.keys(manifests).length >= 3);
    for (const [id, manifest] of Object.entries(manifests))
        assert.deepEqual(checkListing(manifest).findings, [], id);
    assert.equal(catalogStale(root), null);
});
