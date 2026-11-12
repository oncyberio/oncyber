const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
    buildIndex,
    artworkInputs,
    sourceHash,
    defaultRegistry,
    normalizeArtist,
} = require("./core");
const {
    indexGallery,
    shouldIndexChange,
    firestoreCache,
} = require("./indexer");
const { createOpenSea } = require("./opensea");
const wallet = "0x" + "a".repeat(40),
    contract = "0x" + "b".repeat(40);
const art = (creator, extra = {}) => ({
    data: {
        blockchain: "ethereum",
        asset_contract: { address: contract },
        token_id: "0",
        creator,
        ...extra,
    },
});
const gallery = (creator = { username: "xcopyart", address: wallet }) => ({
    artworks: { first: art(creator) },
});
const response = (body, status = 200, headers = {}) => ({
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(headers),
    json: async () => body,
    body: { cancel: async () => {} },
});
function fakeDB(initial) {
    let value = structuredClone(initial);
    const writes = [];
    const ref = {
        id: "gallery",
        get: async () => ({
            exists: !!value,
            data: () => structuredClone(value),
        }),
    };
    return {
        ref,
        writes,
        value: () => value,
        replace: (next) => {
            value = next;
        },
        db: {
            runTransaction: async (fn) =>
                fn({
                    get: () => ref.get(),
                    update: (_, patch) => {
                        writes.push(patch);
                        value = { ...value, ...structuredClone(patch) };
                    },
                }),
        },
    };
}
test("indexes all requested aliases without relying on gallery curator or NFT owner", () => {
    for (const artist of defaultRegistry.artists) {
        for (const alias of artist.aliases) {
            const { index } = buildIndex(gallery({ username: alias }));
            for (const name of [artist.name, ...artist.aliases])
                assert.ok(index.names.includes(name), name);
        }
    }
    assert.deepEqual(
        buildIndex({
            info: { curator: "Beeple" },
            owner: wallet,
            artworks: {
                x: art(null, {
                    owner: { username: "Beeple" },
                    collection: { name: "Beeple", owner: wallet },
                }),
            },
        }).index.names,
        []
    );
    assert.equal(buildIndex(gallery()).index.terms.includes("xcopy"), true);
    assert.equal(
        buildIndex(gallery({ username: "Jack Butcher" })).index.terms.includes(
            "butcher"
        ),
        true
    );
    assert.equal(normalizeArtist("@OSF_REKT"), "osfrekt");
});
test("uses only explicit artist traits and reviewed attribution; contracts are not automatically artists", () => {
    const g = gallery(null);
    g.artworks.first.data.traits = [
        { trait_type: "Artist", value: "killer_acid" },
        { trait_type: "Owner", value: "Beeple" },
    ];
    const { index } = buildIndex(g);
    assert.ok(index.names.includes("Killer Acid"));
    assert.ok(!index.names.includes("Beeple"));
    const registry = {
        artists: defaultRegistry.artists,
        attributions: [{ chain: "ethereum", contract, artistIds: ["beeple"] }],
    };
    assert.deepEqual(
        buildIndex(gallery(null), new Map(), registry).index.names,
        []
    );
    registry.attributions[0].evidence = "Reviewed token attribution";
    registry.attributions[0].tokenId = "0";
    assert.ok(
        buildIndex(gallery(null), new Map(), registry).index.names.includes(
            "Beeple"
        )
    );
    const other = gallery(null);
    other.artworks.first.data.token_id = "1";
    assert.deepEqual(buildIndex(other, new Map(), registry).index.names, []);
});
test("preserves token zero/large IDs and rejects unsafe numeric IDs", () => {
    assert.equal(artworkInputs(gallery())[0].nft.tokenId, "0");
    const g = gallery();
    g.artworks.first.data.token_id = "12345678901234567890123456789";
    assert.equal(
        artworkInputs(g)[0].nft.tokenId,
        g.artworks.first.data.token_id
    );
    g.artworks.first.data.token_id = Number.MAX_SAFE_INTEGER + 1;
    assert.equal(artworkInputs(g)[0].nft, null);
});
test("ignores hidden art and private galleries; source hash ignores layout/media/index changes", () => {
    const g = gallery();
    const original = sourceHash(g);
    g.artworks.first.position = { x: 10 };
    g.artworks.first.data.image_url = "different";
    g.artistSearch = { names: ["irrelevant"] };
    assert.equal(sourceHash(g), original);
    assert.equal(shouldIndexChange(gallery(), g), false);
    g.artworks.first.visible = false;
    assert.deepEqual(buildIndex(g).index.names, []);
    assert.equal(shouldIndexChange(gallery(), g), true);
    for (const flags of [
        { visibility: "private" },
        { info: { private: true } },
        { isPublic: false },
        { published: false },
        { deleted: true },
    ])
        assert.deepEqual(
            buildIndex({ ...gallery(), ...flags }).index.names,
            []
        );
    assert.equal(shouldIndexChange(g, undefined), false);
    assert.notEqual(
        sourceHash(gallery(), { artists: [], attributions: [] }),
        original
    );
});
test("dry-run performs no writes; apply is idempotent and own writes do not retrigger", async () => {
    const state = fakeDB(gallery());
    const provider = { resolve: async () => ({ creators: [] }) };
    const preview = await indexGallery({ ...state, provider });
    assert.equal(preview.status, "preview");
    assert.equal(state.writes.length, 0);
    const result = await indexGallery({ ...state, provider, apply: true });
    assert.equal(result.status, "indexed");
    assert.equal(shouldIndexChange(gallery(), state.value()), false);
    const count = state.writes.length;
    assert.equal(
        (await indexGallery({ ...state, provider, apply: true })).status,
        "unchanged"
    );
    assert.equal(state.writes.length, count);
});
test("removal clears stale artist matches even when subsequent enrichment fails", async () => {
    const state = fakeDB({
        ...gallery({ username: "Beeple" }),
        artistSearch: { ...buildIndex(gallery()).index, enriched: true },
    });
    await assert.rejects(
        indexGallery({
            ...state,
            apply: true,
            provider: {
                resolve: async () => {
                    throw new Error("rate limited");
                },
            },
        }),
        /rate limited/
    );
    assert.ok(state.value().artistSearch.names.includes("Beeple"));
    assert.ok(!state.value().artistSearch.names.includes("XCOPY"));
    assert.equal(state.value().artistSearch.enriched, false);
    const result = await indexGallery({
        ...state,
        apply: true,
        provider: { resolve: async () => ({ creators: [] }) },
    });
    assert.equal(result.status, "indexed");
    assert.equal(result.index.enriched, true);
});
test("transaction guard prevents stale enrichment overwriting a concurrent artwork edit", async () => {
    const state = fakeDB(gallery());
    const provider = {
        resolve: async () => {
            state.replace(gallery({ username: "Beeple" }));
            return { creators: [] };
        },
    };
    assert.equal(
        (await indexGallery({ ...state, apply: true, provider })).status,
        "changed-during-indexing"
    );
    assert.equal(state.value().artistSearch, undefined);
});
test("private gallery changes clear index without provider calls", async () => {
    const state = fakeDB({
        ...gallery(),
        visibility: "private",
        artistSearch: buildIndex(gallery()).index,
    });
    const result = await indexGallery({
        ...state,
        apply: true,
        provider: {
            resolve: () => assert.fail("private gallery leaked to provider"),
        },
    });
    assert.deepEqual(result.index.names, []);
    assert.deepEqual(result.index.terms, []);
});
test("OpenSea retries 429, resolves creator profiles, caches attribution only and reuses NFT lookups", async () => {
    let calls = 0;
    const saved = [],
        waits = [];
    const provider = createOpenSea({
        apiKey: "test",
        intervalMs: 0,
        wait: async (ms) => waits.push(ms),
        cache: {
            get: async () => null,
            set: async (_, entry) => saved.push(entry),
        },
        fetchImpl: async (url) => {
            calls++;
            if (calls === 1) return response({}, 429, { "retry-after": "2" });
            if (url.includes("/nfts/"))
                return response({
                    nft: {
                        creator: wallet,
                        owners: [{ address: contract }],
                        collection: "collection",
                    },
                });
            return response({
                address: wallet,
                username: "XCOPY",
                social_media_accounts: [
                    { platform: "twitter", username: "xcopyart" },
                ],
            });
        },
    });
    const input = artworkInputs(gallery(null))[0];
    const result = await provider.resolve(input);
    assert.equal(calls, 3);
    assert.ok(waits.includes(2000));
    assert.ok(
        result.creators.some((creator) => creator.names.includes("xcopyart"))
    );
    await provider.resolve(input);
    assert.equal(calls, 3);
    assert.ok(!JSON.stringify(saved).includes("owners"));
});
test("malformed/provider failures are not cached; mismatched account is never attributed", async () => {
    let saved = 0;
    const cache = { get: async () => null, set: async () => saved++ };
    const malformed = createOpenSea({
        apiKey: "test",
        cache,
        intervalMs: 0,
        fetchImpl: async () => response({ bad: true }),
    });
    await assert.rejects(
        malformed.resolve(artworkInputs(gallery())[0]),
        /invalid attribution/
    );
    assert.equal(saved, 0);
    const unauthorized = createOpenSea({
        apiKey: "test",
        cache,
        intervalMs: 0,
        fetchImpl: async () => response({}, 401),
    });
    await assert.rejects(
        unauthorized.resolve(artworkInputs(gallery())[0]),
        /401/
    );
    assert.equal(saved, 0);
    const mismatch = createOpenSea({
        apiKey: "test",
        intervalMs: 0,
        fetchImpl: async (url) =>
            response(
                url.includes("/nfts/")
                    ? { nft: { creator: wallet } }
                    : { address: contract, username: "Wrong Artist" }
            ),
    });
    const result = await mismatch.resolve(artworkInputs(gallery(null))[0]);
    assert.ok(
        !result.creators.some((creator) =>
            creator.names.includes("Wrong Artist")
        )
    );
});
test("dry-run cache never writes to Firestore, but apply cache does", async () => {
    let writes = 0;
    const db = {
        collection: () => ({
            doc: () => ({
                get: async () => ({ exists: false }),
                set: async () => writes++,
            }),
        }),
    };
    const dry = firestoreCache(db, false);
    await dry.set("key", { value: null });
    assert.equal(writes, 0);
    assert.deepEqual(await dry.get("key"), { value: null });
    await firestoreCache(db, true).set("key", {});
    assert.equal(writes, 1);
});
test("uploader identity is not artist attribution, while known gallery makers remain searchable separately", () => {
    const claire = defaultRegistry.artists.find(
        (artist) => artist.id === "claire-silver"
    );
    const g = gallery({
        username: "ClaireSilver",
        address: claire.wallets[0].address,
    });
    g.owner = claire.wallets[0].address;
    g.artworks.first.data.blockchain = "no-chain";
    g.artworks.first.data.source = { blockchain: "none", api: "oncyber" };
    const { index, unresolved } = buildIndex(g);
    assert.deepEqual(index.names, []);
    assert.deepEqual(index.addresses, []);
    assert.ok(index.curatorNames.includes("Claire Silver"));
    assert.ok(index.terms.includes("clairesilver"));
    assert.equal(unresolved.length, 1);
    assert.deepEqual(artworkInputs(g)[0].creators, []);
    g.artworks.empty = { data: { placeholderId: "empty" } };
    assert.equal(buildIndex(g).index.artworkCount, 1);
});
test("conflicting creator wallets are flagged for review instead of indexing both artists", () => {
    const resolved = new Map([
        [
            "first",
            {
                creators: [
                    {
                        names: ["Beeple"],
                        address: contract,
                        source: "opensea-creator",
                    },
                ],
            },
        ],
    ]);
    const result = buildIndex(gallery(), resolved);
    assert.deepEqual(result.index.names, []);
    assert.equal(result.unresolved[0].reason, "creator-conflict-needs-review");
});

test("stored-only preview does not discard an already enriched current index", async () => {
    const state = fakeDB(gallery());
    await indexGallery({
        ...state,
        apply: true,
        provider: { resolve: async () => ({ creators: [] }) },
    });
    const count = state.writes.length;
    assert.equal(
        (await indexGallery({ ...state, apply: true, storedOnly: true }))
            .status,
        "unchanged"
    );
    assert.equal(state.writes.length, count);
});
test("provider deadline fails before an uncached request so trigger retry can resume", async () => {
    const provider = createOpenSea({
        apiKey: "test",
        deadline: 1000,
        now: () => 999,
        fetchImpl: () => assert.fail("request should not start"),
    });
    await assert.rejects(
        provider.resolve(artworkInputs(gallery())[0]),
        /time budget/
    );
});

test("OpenSea media projection excludes unsafe URLs and rejects a different NFT", async () => {
    const contract = "0x" + "1".repeat(40),
        path = `chain/ethereum/contract/${contract}/nfts/0`;
    const provider = createOpenSea({
        apiKey: "test",
        intervalMs: 0,
        fetchImpl: async () =>
            new Response(
                JSON.stringify({
                    nft: {
                        contract,
                        identifier: "0",
                        image_url: "https://example.com/art.png",
                        animation_url: "javascript:bad",
                        owners: [{ address: contract }],
                    },
                }),
                { status: 200 }
            ),
    });
    const value = await provider.get(path);
    assert.deepEqual(value.media, { image_url: "https://example.com/art.png" });
    assert.equal(value.owners, undefined);
    const wrong = createOpenSea({
        apiKey: "test",
        intervalMs: 0,
        fetchImpl: async () =>
            new Response(
                JSON.stringify({ nft: { contract, identifier: "1" } }),
                { status: 200 }
            ),
    });
    await assert.rejects(wrong.get(path), /different NFT identity/);
});

test("artist names and prefixes preserve complete Unicode characters", () => {
    const name = "𝘓ʯ℞Ḵ𝕄𝟶𐍄ꖾ.art";
    const { index } = buildIndex(gallery({ username: name }));
    assert.ok(index.terms.includes("lʯkm0𐍄"));
    for (const value of [...index.names, ...index.terms])
        assert.equal(Buffer.from(value).toString("utf8"), value);
    const boundary = "a".repeat(159) + "𐍄" + "extra";
    const truncated = buildIndex(gallery({ username: boundary })).index;
    assert.equal(truncated.names[0], "a".repeat(159) + "𐍄");
});
test("saved-metadata writes cannot downgrade concurrent enriched attribution", async () => {
    const original = gallery();
    const state = fakeDB(original);
    const enriched = { ...buildIndex(original).index, enriched: true, names: ["Remote Artist"] };
    const runTransaction = state.db.runTransaction;
    state.db.runTransaction = async (fn) => {
        state.replace({ ...original, artistSearch: enriched });
        return runTransaction(fn);
    };
    const result = await indexGallery({ ...state, apply: true, storedOnly: true });
    assert.equal(result.status, "changed-during-indexing");
    assert.deepEqual(state.value().artistSearch, enriched);
    assert.equal(state.writes.length, 0);
});
