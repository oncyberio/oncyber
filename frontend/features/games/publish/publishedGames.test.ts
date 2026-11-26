/** @jest-environment node */
import committed from "../../../public/game-builds/lantern-tag/release.json";
import {
    PUBLISH_KEEP_RELEASES,
    PUBLISH_MAX_BYTES,
    PUBLISH_MAX_GAMES,
    PUBLISH_MAX_RELEASES_PER_DAY,
    PUBLISH_MAX_UPLOADS_PER_DAY,
    PublishRefused,
    mayPublish,
    planBegin,
    planLink,
    planPublish,
    planUnpublish,
    publishBeginSchema,
    publishIdProblem,
    publishedGameLive,
    publishedGameSummary,
    publisherAt,
    publishingGate,
    readPublishedGame,
    recordSlug,
    registeredGameEntry,
    registeredGameFrame,
    releaseFilesProblem,
    releaseIdOf,
    releaseManifestText,
    releasePathProblem,
    servedRelease,
    type PublishedEntry,
    type PublishedGame,
    type PublishedRelease,
} from "./publishedGames";

const NOW = new Date("2026-11-17T10:00:00.000Z");
const HASH = "a".repeat(64);
const CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const entry: PublishedEntry = {
    title: "My Game",
    tagline: "a small game",
    description: "A small game about walking around a quiet courtyard.",
    players: { min: 1, max: 4 },
    partySizes: [2, 3, 4],
    devices: ["desktop"],
    tags: ["arcade"],
    crowdLabel: "in the yard",
};
const stored = (release: string, more = {}): PublishedRelease => ({
    release,
    backend: "local",
    publishedAt: NOW.toISOString(),
    files: 1,
    bytes: 10,
    check: "self-reported",
    ...more,
});
const record = (more: Partial<PublishedGame> = {}): PublishedGame => ({
    id: "my-game",
    owner: "user-a",
    status: "unlisted",
    entry,
    current: "1".repeat(16),
    releases: [stored("1".repeat(16))],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...more,
});
const publisher = (more = {}) => ({ ...publisherAt(null, NOW), ...more });
const refused = (run: () => unknown) => {
    try {
        run();
    } catch (error) {
        return error instanceof PublishRefused
            ? error.message
            : `threw ${error}`;
    }
    return null;
};

describe("who may publish", () => {
    const on = { GAMES_PREVIEW: "1", NODE_ENV: "production" };
    test.each([
        [{ ...on }, "off"],
        [{ ...on, GAMES_PUBLISHING: "" }, "off"],
        [{ ...on, GAMES_PUBLISHING: "off" }, "off"],
        [{ ...on, GAMES_PUBLISHING: " , " }, "off"],
        [{ ...on, GAMES_PUBLISHING: "open" }, "open"],
        [{ ...on, GAMES_PUBLISHING: "OPEN" }, "open"],
        [{ ...on, GAMES_PUBLISHING: "user-a, user-b" }, "accounts"],
        // The development server, with nothing set.
        [{ NODE_ENV: "development" }, "open"],
        [{ NODE_ENV: "development", GAMES_PUBLISHING: "user-a" }, "accounts"],
        // Where game pages are hidden, so is publishing.
        [{ NODE_ENV: "production", GAMES_PUBLISHING: "open" }, "off"],
    ])("%j is %s", (env, mode) => {
        expect(publishingGate(env).mode).toBe(mode);
    });

    test("a list names accounts, and nobody else", () => {
        const env = { ...on, GAMES_PUBLISHING: "user-a,user-b" };
        expect(mayPublish("user-a", env)).toBe(true);
        expect(mayPublish("user-b", env)).toBe(true);
        expect(mayPublish("user-c", env)).toBe(false);
        expect(mayPublish("", env)).toBe(false);
        expect(mayPublish(undefined, env)).toBe(false);
        expect(mayPublish("open", { ...on, GAMES_PUBLISHING: "open" })).toBe(
            true
        );
        expect(mayPublish("user-a", on)).toBe(false);
    });
});

describe("ids", () => {
    test.each(["my-game", "abc", "party-golf", "a".repeat(41), "3d-maze"])(
        "%s can be registered",
        (id) => {
            expect(publishIdProblem(id)).toBeNull();
        }
    );

    test.each([
        ["ab", /3 to 41/],
        ["a".repeat(42), /3 to 41/],
        ["My-Game", /3 to 41/],
        ["-game", /3 to 41/],
        ["my_game", /3 to 41/],
        ["../etc", /3 to 41/],
        ["my--game", /single dashes/],
        ["my-game-", /single dashes/],
        // Ids of the catalog: a registered game never takes one.
        ["ace", /catalog/],
        ["lantern-tag", /catalog/],
        ["garden", /catalog/],
        // Another game's party rooms are `oncyber-<id>-party-<party>`.
        ["ace-party-abc", /party rooms/],
        ["my-party-game", /party rooms/],
        ["game-party", /party rooms/],
        [undefined, /3 to 41/],
        [42, /3 to 41/],
    ])("%s is refused", (id, why) => {
        expect(publishIdProblem(id)).toMatch(why);
    });

    test("an id whose social room is another game's room is refused", () => {
        const catalog = {
            other: { id: "other", room: "oncyber-my-game-social-v1" } as any,
        };
        expect(publishIdProblem("my-game", catalog)).toMatch(/share a room/);
        expect(publishIdProblem("my-games", catalog)).toBeNull();
    });
});

describe("the release id", () => {
    test("is the id pnpm games:publish gave a committed game", () => {
        expect(committed.files.length).toBeGreaterThan(5);
        expect(releaseIdOf(committed.files)).toBe(committed.release);
        // In any order.
        expect(releaseIdOf([...committed.files].reverse())).toBe(
            committed.release
        );
        // And a different file is a different release.
        const changed = committed.files.map((file, index) =>
            index ? file : { ...file, sha256: HASH }
        );
        expect(releaseIdOf(changed)).not.toBe(committed.release);
    });

    test("the stored file list has no dates and keeps the listed order", () => {
        const files = [
            { path: "index.html", bytes: 3, sha256: HASH, extra: 1 } as any,
        ];
        expect(
            JSON.parse(
                releaseManifestText("my-game", "1".repeat(16), files).toString()
            )
        ).toEqual({
            version: 1,
            game: "my-game",
            release: "1".repeat(16),
            files: [{ path: "index.html", bytes: 3, sha256: HASH }],
        });
    });
});

describe("files", () => {
    test.each([
        "index.html",
        "assets/a-B6K0_x.js",
        "licenses/three.txt",
        "_astro/chunk.mjs",
        "a/b/c/d.e.f",
        "img/hero@2x.png",
    ])("%s is a path of a release", (path) => {
        expect(releasePathProblem(path)).toBeNull();
    });

    test.each([
        "",
        "/index.html",
        "../index.html",
        "assets/../../x.js",
        "assets//x.js",
        "assets/./x.js",
        "assets/",
        ".env",
        "assets/.hidden",
        "a\\b.js",
        "a b.js",
        "a%2Fb.js",
        "a\u0000.js",
        "name.",
        "C:/x.js",
        "a/".repeat(12) + "x.js",
        "x".repeat(201),
        // Reserved: the release's own file list, and the reports beside it.
        "oncyber-release.json",
        "check.json",
        "release.json",
        "thumbnail.jpg",
        7,
        null,
    ])("%j is not", (path) => {
        expect(releasePathProblem(path)).toEqual(expect.any(String));
    });

    const file = (path: string, bytes = 1) => ({ path, bytes, sha256: HASH });
    test("a release has an index.html, each path once, and stays in its limits", () => {
        expect(
            releaseFilesProblem([file("index.html"), file("a.js")])
        ).toBeNull();
        expect(releaseFilesProblem([])).toMatch(/needs files/);
        expect(releaseFilesProblem([file("a.js")])).toMatch(/index\.html/);
        expect(
            releaseFilesProblem([
                file("index.html"),
                file("a.js"),
                file("A.js"),
            ])
        ).toMatch(/twice/);
        expect(
            releaseFilesProblem([file("index.html"), file("a"), file("a/b.js")])
        ).toMatch(/both a file and a folder/);
        expect(
            releaseFilesProblem([file("index.html"), file("../a.js")])
        ).toMatch(/plain relative path/);
        expect(
            releaseFilesProblem([
                file("index.html", PUBLISH_MAX_BYTES / 2),
                file("a.bin", PUBLISH_MAX_BYTES / 2 + 1),
            ])
        ).toMatch(/30 MiB/);
        expect(
            releaseFilesProblem([
                file("index.html"),
                ...Array.from({ length: 400 }, (_, i) => file(`f${i}.js`)),
            ])
        ).toMatch(/400 files/);
        expect(
            releaseFilesProblem([{ ...file("index.html"), sha256: "nope" }])
        ).toMatch(/SHA-256/);
        expect(
            releaseFilesProblem([{ ...file("index.html"), bytes: -1 }])
        ).toMatch(/size/);
    });
});

describe("what begin takes", () => {
    const files = [{ path: "index.html", bytes: 3, sha256: HASH }];
    const input = {
        id: "my-game",
        manifest: { name: "My Game" },
        entry: {
            ...entry,
            // What a catalog entry carries, and a registered game may not choose.
            id: "ace",
            thumbnail: "https://elsewhere.example/x.jpg",
            room: "oncyber-bloom-garden-v1",
            socialRoom: "oncyber-ace-social-v1",
            relay: true,
            somethingElse: true,
            controlsStyle: { top: 0 },
        },
        files,
        check: {
            status: "passed",
            checkedAt: NOW.toISOString(),
            release: releaseIdOf(files),
        },
    };
    const parse = (patch: object) =>
        publishBeginSchema.safeParse({ ...input, ...patch });

    test("the listing is kept; rooms, controlsStyle and anything else are dropped", () => {
        const parsed = publishBeginSchema.parse(input);
        expect(parsed.entry).toEqual(entry);
        expect(Object.keys(parsed.entry).sort()).toEqual(
            Object.keys(entry).sort()
        );
    });

    test("the listing is tidied", () => {
        const parsed = publishBeginSchema.parse({
            ...input,
            entry: {
                ...entry,
                title: "  My Game ",
                partySizes: [4, 2, 2, 8],
                devices: ["gamepad", "desktop", "desktop"],
                tags: ["arcade", "arcade", "cozy"],
                crowdLabel: undefined,
            },
        });
        expect(parsed.entry).toMatchObject({
            title: "My Game",
            // In order, once each, and none above players.max.
            partySizes: [2, 4],
            devices: ["desktop", "gamepad"],
            tags: ["arcade", "cozy"],
            crowdLabel: "",
        });
    });

    test.each([
        [{ id: "My Game" }],
        [{ id: "ab" }],
        [{ check: { ...input.check, status: "failed" } }],
        [{ check: { ...input.check, status: undefined } }],
        [{ check: { ...input.check, release: "xyz" } }],
        [{ check: { ...input.check, checkedAt: "yesterday" } }],
        [{ check: undefined }],
        [{ files: [] }],
        [{ files: [{ path: "index.html", bytes: 1.5, sha256: HASH }] }],
        [{ files: [{ path: "index.html", bytes: 1, sha256: "abc" }] }],
        [
            {
                files: [
                    {
                        path: "index.html",
                        bytes: PUBLISH_MAX_BYTES + 1,
                        sha256: HASH,
                    },
                ],
            },
        ],
        [{ files: Array.from({ length: 401 }, () => files[0]) }],
        [{ manifest: "game.json" }],
        [{ manifest: { big: "x".repeat(70000) } }],
        [{ entry: { ...entry, title: "" } }],
        [{ entry: { ...entry, title: "x".repeat(61) } }],
        [{ entry: { ...entry, title: "<img src=x>" } }],
        [{ entry: { ...entry, title: { toString: 1 } } }],
        [{ entry: { ...entry, tagline: "x".repeat(61) } }],
        [{ entry: { ...entry, description: "too short" } }],
        [{ entry: { ...entry, description: "x".repeat(201) } }],
        [
            {
                entry: {
                    ...entry,
                    description: `${entry.description} https://x.example`,
                },
            },
        ],
        [{ entry: { ...entry, players: { min: 2, max: 1 } } }],
        [{ entry: { ...entry, players: { min: 0, max: 1 } } }],
        [{ entry: { ...entry, players: { min: 1, max: 501 } } }],
        [{ entry: { ...entry, partySizes: [1] } }],
        [{ entry: { ...entry, partySizes: [9] } }],
        [{ entry: { ...entry, devices: [] } }],
        [{ entry: { ...entry, devices: ["console"] } }],
        [{ entry: { ...entry, tags: [] } }],
        [{ entry: { ...entry, tags: ["Arcade"] } }],
        [
            {
                entry: {
                    ...entry,
                    tags: ["a", "b", "c", "d", "e", "f", "g"].map(
                        (t) => `${t}${t}`
                    ),
                },
            },
        ],
        [{ entry: { ...entry, crowdLabel: "x".repeat(41) } }],
        [{ entry: undefined }],
    ])("%j is refused", (patch) => {
        expect(parse(patch).success).toBe(false);
    });
});

describe("the record's moves", () => {
    const next = stored("2".repeat(16));
    const publish = (from: PublishedGame | null, more = {}) =>
        planPublish({
            record: from,
            publisher: publisher(from ? { games: [from.id] } : {}),
            owner: "user-a",
            id: "my-game",
            entry,
            release: next,
            now: NOW,
            ...more,
        });

    test.each([
        [null, "unlisted"],
        ["unlisted", "unlisted"],
        ["unpublished", "unlisted"],
        ["listed", "listed"],
    ] as const)("publish: %s -> %s", (from, to) => {
        const result = publish(from ? record({ status: from }) : null);
        expect(result.record.status).toBe(to);
        expect(result.record.current).toBe(next.release);
        expect(result.record.owner).toBe("user-a");
        expect(result.record.releases.at(-1)).toEqual(next);
        expect(result.publisher.games).toEqual(["my-game"]);
        expect(result.publisher.releases).toBe(1);
    });

    test.each([
        ["unlisted", "unpublished"],
        ["listed", "unpublished"],
        ["unpublished", "unpublished"],
    ] as const)("unpublish: %s -> %s", (from, to) => {
        const before = record({ status: from });
        const after = planUnpublish(before, "user-a", NOW);
        expect(after.status).toBe(to);
        expect(after.owner).toBe("user-a");
        // The same object when nothing moves.
        expect(after === before).toBe(from === "unpublished");
    });

    test("link: the owner sets, changes and gives up the game's slug", () => {
        const linked = planLink(record(), "user-a", "sky-run", NOW);
        expect(linked.slug).toBe("sky-run");
        expect(linked.status).toBe("unlisted");
        // The same slug again is the same record: nothing to store.
        expect(planLink(linked, "user-a", "sky-run", NOW)).toBe(linked);
        expect(planLink(linked, "user-a", "sky-walk", NOW).slug).toBe(
            "sky-walk"
        );
        const cleared = planLink(linked, "user-a", null, NOW);
        expect("slug" in cleared).toBe(false);
        expect(planLink(record(), "user-a", null, NOW).slug).toBeUndefined();
        // A new release keeps it; a take-down keeps it too.
        expect(publish(linked).record.slug).toBe("sky-run");
        expect(planUnpublish(linked, "user-a", NOW).slug).toBe("sky-run");
        expect("slug" in publish(record()).record).toBe(false);
    });

    test.each([
        ["ab", /3 to 40 lowercase/],
        ["Sky-Run", /3 to 40 lowercase/],
        ["sky--run", /3 to 40 lowercase/],
        ["-sky", /3 to 40 lowercase/],
        ["sky-", /3 to 40 lowercase/],
        ["sky_run", /3 to 40 lowercase/],
        ["@ada", /3 to 40 lowercase/],
        ["a".repeat(41), /3 to 40 lowercase/],
        ["studio", /\/studio is taken/],
        ["games", /\/games is taken/],
        ["contact", /\/contact is taken/],
    ])("link: %s is refused", (slug, why) => {
        expect(refused(() => planLink(record(), "user-a", slug, NOW))).toMatch(
            why
        );
    });

    test("only the owner moves a record", () => {
        expect(
            refused(() => planLink(record(), "user-b", "sky-run", NOW))
        ).toMatch(/not a game of this account/);
        expect(refused(() => planLink(null, "user-a", "sky-run", NOW))).toMatch(
            /not a game of this account/
        );
        expect(refused(() => publish(record(), { owner: "user-b" }))).toMatch(
            /another account/
        );
        expect(refused(() => planUnpublish(record(), "user-b", NOW))).toMatch(
            /not a game of this account/
        );
        expect(refused(() => planUnpublish(null, "user-a", NOW))).toMatch(
            /not a game of this account/
        );
        expect(
            refused(() =>
                planBegin({
                    record: record(),
                    publisher: publisher(),
                    owner: "user-b",
                    id: "my-game",
                })
            )
        ).toMatch(/another account/);
    });

    test("an id of the catalog is refused at every step", () => {
        expect(
            refused(() =>
                planBegin({
                    record: null,
                    publisher: publisher(),
                    owner: "user-a",
                    id: "ace",
                })
            )
        ).toMatch(/catalog/);
        expect(refused(() => publish(null, { id: "ace" }))).toMatch(/catalog/);
    });

    test("an account holds ten games", () => {
        const full = publisher({
            games: Array.from(
                { length: PUBLISH_MAX_GAMES },
                (_, i) => `g-${i}x`
            ),
        });
        const begin = (from: PublishedGame | null) =>
            refused(() =>
                planBegin({
                    record: from,
                    publisher: full,
                    owner: "user-a",
                    id: "my-game",
                })
            );
        expect(begin(null)).toMatch(/at most 10 games/);
        // A game it already holds is not an eleventh.
        expect(begin(record())).toBeNull();
        expect(refused(() => publish(null, { publisher: full }))).toMatch(
            /at most 10 games/
        );
        expect(
            refused(() => publish(record(), { publisher: full }))
        ).toBeNull();
    });

    test("an account publishes twenty releases a day", () => {
        const spent = publisher({
            games: ["my-game"],
            releases: PUBLISH_MAX_RELEASES_PER_DAY,
        });
        expect(refused(() => publish(record(), { publisher: spent }))).toMatch(
            /20 releases a day/
        );
        expect(
            refused(() =>
                planBegin({
                    record: record(),
                    publisher: spent,
                    owner: "user-a",
                    id: "my-game",
                })
            )
        ).toMatch(/20 releases a day/);
        // Going back to a release already listed stores nothing new.
        const back = publish(record(), {
            publisher: spent,
            release: stored("1".repeat(16), { bytes: 999 }),
        });
        expect(back.publisher.releases).toBe(PUBLISH_MAX_RELEASES_PER_DAY);
        expect(back.record.releases).toEqual([stored("1".repeat(16))]);
        // The next day the count starts again.
        const tomorrow = new Date("2026-11-18T00:00:01.000Z");
        expect(publisherAt(spent, tomorrow)).toEqual({
            games: ["my-game"],
            day: "2026-11-18",
            releases: 0,
            uploads: 0,
        });
        expect(publisherAt(spent, NOW).releases).toBe(20);
    });

    test("uploads begun are counted too", () => {
        const begin = (uploads: number) =>
            refused(() =>
                planBegin({
                    record: null,
                    publisher: publisher({ uploads }),
                    owner: "user-a",
                    id: "my-game",
                })
            );
        expect(begin(PUBLISH_MAX_UPLOADS_PER_DAY)).toMatch(/Too many uploads/);
        expect(begin(PUBLISH_MAX_UPLOADS_PER_DAY - 1)).toBeNull();
        expect(
            planBegin({
                record: null,
                publisher: publisher({ uploads: 3 }),
                owner: "user-a",
                id: "my-game",
            }).uploads
        ).toBe(4);
    });

    test("a record lists its last twenty releases", () => {
        const many = Array.from({ length: PUBLISH_KEEP_RELEASES }, (_, i) =>
            stored(i.toString(16).padStart(16, "0"))
        );
        const result = publish(
            record({ releases: many, current: many[5].release })
        );
        expect(result.record.releases).toHaveLength(PUBLISH_KEEP_RELEASES);
        expect(result.record.releases.at(-1)).toEqual(next);
        expect(result.record.releases[0]).toEqual(many[1]);
    });

    test("a stored record that is not one reads as none", () => {
        expect(readPublishedGame(record())).toEqual(record());
        for (const bad of [
            null,
            "x",
            {},
            { ...record(), id: "../x" },
            { ...record(), owner: "" },
            { ...record(), status: "public" },
            { ...record(), releases: null },
            { ...record(), entry: null },
        ])
            expect(readPublishedGame(bad)).toBeNull();
    });
});

describe("what the site serves from a record", () => {
    const one = "1".repeat(16);
    const two = "2".repeat(16);
    const pinned = stored(two, {
        backend: "pinata",
        address: CID,
        base: `https://gateway.example/ipfs/${CID}/`,
    });

    test("a published game is live; an unpublished one, or one whose current release is gone, is not", () => {
        expect(publishedGameLive(record())).toBe(true);
        expect(publishedGameLive(record({ status: "listed" }))).toBe(true);
        expect(publishedGameLive(record({ status: "unpublished" }))).toBe(
            false
        );
        expect(publishedGameLive(record({ current: two }))).toBe(false);
        expect(publishedGameLive(null)).toBe(false);
        // A record under a catalogued id is never served.
        expect(publishedGameLive(record({ id: "ace" }))).toBe(false);
    });

    test("any listed release of a live game is served, and nothing else", () => {
        const game = record({ releases: [stored(one), pinned] });
        expect(servedRelease(game, one)).toEqual({ backend: "local" });
        expect(servedRelease(game, two)).toEqual({
            backend: "pinata",
            pinned: { release: two, base: pinned.base },
        });
        expect(servedRelease(game, "3".repeat(16))).toBeNull();
        expect(servedRelease(game, "../x")).toBeNull();
        expect(
            servedRelease({ ...game, status: "unpublished" }, one)
        ).toBeNull();
        expect(servedRelease(null, one)).toBeNull();
    });

    test.each([
        [{ base: `http://gateway.example/ipfs/${CID}/` }],
        [{ base: "https://gateway.example/ipfs/other/" }],
        [{ base: `https://user:pw@gateway.example/ipfs/${CID}/` }],
        [{ base: `https://gateway.example/ipfs/${CID}/?x=1` }],
        [{ address: "not-a-cid" }],
        [{ base: "https://169.254.169.254/latest/" }],
        [{ base: undefined }],
    ])("a pinned entry with %j is not served", (patch) => {
        const game = record({
            current: two,
            releases: [{ ...pinned, ...patch } as PublishedRelease],
        });
        expect(servedRelease(game, two)).toBeNull();
    });

    test("the page's entry: the listing, and rooms the site chose", () => {
        const tampered = record({
            releases: [stored(one, { thumbnail: true })],
            entry: {
                ...entry,
                room: "oncyber-bloom-garden-v1",
                socialRoom: "oncyber-ace-social-v1",
                relay: true,
                somethingElse: true,
                controlsStyle: { top: 0 },
            } as any,
        });
        expect(registeredGameEntry(tampered)).toEqual({
            id: "my-game",
            ...entry,
            thumbnail: `/api/games/releases/my-game/${one}/thumbnail.jpg`,
            room: null,
            relay: false,
            socialRoom: "oncyber-my-game-social-v1",
            registered: true,
        });
        expect(registeredGameEntry(record()).thumbnail).toBe("");
    });

    test("the frame is the current release, from this site's route", () => {
        expect(registeredGameFrame(record())).toEqual({
            src: `/api/games/releases/my-game/${one}/index.html`,
            release: one,
            source: "hosted",
        });
    });

    test("mine's row", () => {
        expect(publishedGameSummary(record())).toEqual({
            id: "my-game",
            title: "My Game",
            status: "unlisted",
            release: one,
            publishedAt: NOW.toISOString(),
            url: "/games/my-game",
            slug: null,
        });
        // With a slug, that is the game's address.
        expect(publishedGameSummary(record({ slug: "sky-run" }))).toMatchObject(
            { url: "/sky-run", slug: "sky-run" }
        );
        expect(registeredGameEntry(record({ slug: "sky-run" })).slug).toBe(
            "sky-run"
        );
        expect(registeredGameEntry(record()).slug).toBeUndefined();
        // A record that holds something that is not a slug has none.
        expect(recordSlug(record({ slug: "Not A Slug" }))).toBeNull();
        expect(
            registeredGameEntry(record({ slug: "../x" })).slug
        ).toBeUndefined();
    });
});
