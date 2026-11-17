import {
    committedFrame,
    frameBase,
    pinnedGatewayBase,
    pinnedRelease,
    pointedRelease,
    releaseBase,
    resolveGameFrame,
} from "./gameRelease";
import { localReleasesDir } from "./gameReleaseServer";
import committed from "./releases.json";

const A = "0800022feca2d8ba";
const B = "2eeece2736f516c3";
const pointers = (current: string, bases: Record<string, unknown>) => ({
    version: 1,
    games: {
        ace: {
            current,
            releases: Object.entries(bases).map(([release, base]) => ({
                release,
                base,
            })),
        },
    },
});

describe("releaseBase", () => {
    it("accepts this app's releases route only for that game and release", () => {
        const local = `/api/games/releases/ace/${A}/`;
        expect(releaseBase("ace", A, local)).toBe(local);
        expect(releaseBase("garden", A, local)).toBeNull();
        expect(releaseBase("ace", B, local)).toBeNull();
        expect(releaseBase("ace", A, "/games/ace/")).toBeNull();
        expect(releaseBase("ace", A, `//evil.example/${A}/`)).toBeNull();
    });

    it("accepts https bases that end in a slash and nothing else", () => {
        const ipfs = "https://gateway.example/ipfs/bafybeigdyrzt/";
        expect(releaseBase("ace", A, ipfs)).toBe(ipfs);
        for (const bad of [
            "https://gateway.example/ipfs/bafybeigdyrzt",
            "http://gateway.example/ipfs/bafybeigdyrzt/",
            "https://user:pass@gateway.example/x/",
            "https://gateway.example/x/?a=1",
            "https://gateway.example/x/#a",
            "javascript:alert(1)//",
            "data:text/html,hi/",
            "",
            null,
            7,
        ])
            expect(releaseBase("ace", A, bad)).toBeNull();
    });

    it("accepts http on loopback only in development", () => {
        const base = "http://127.0.0.1:4010/ace/";
        expect(releaseBase("ace", A, base)).toBeNull();
        expect(releaseBase("ace", A, base, true)).toBe(base);
        expect(releaseBase("ace", A, "http://10.0.0.2/ace/", true)).toBeNull();
    });
});

describe("resolveGameFrame", () => {
    const hosted = pointers(A, {
        [B]: "https://gateway.example/ipfs/two/",
        [A]: "https://gateway.example/ipfs/one/",
    });

    it("loads the release the pointer names as current", () => {
        expect(resolveGameFrame("ace", [hosted])).toEqual({
            src: "https://gateway.example/ipfs/one/index.html",
            release: A,
            source: "hosted",
        });
    });

    it("follows a rollback: only `current` changes", () => {
        const rolledBack = {
            ...hosted,
            games: { ace: { ...hosted.games.ace, current: B } },
        };
        expect(resolveGameFrame("ace", [rolledBack]).src).toBe(
            "https://gateway.example/ipfs/two/index.html"
        );
    });

    it("falls back to the committed build", () => {
        const fallback = committedFrame("ace");
        expect(fallback.src).toBe("/games/ace/index.html");
        expect(resolveGameFrame("ace", [])).toEqual(fallback);
        expect(resolveGameFrame("garden", [hosted])).toEqual(
            committedFrame("garden")
        );
        // Unusable pointers never break the page.
        for (const bad of [
            null,
            "x",
            { version: 2, games: hosted.games },
            pointers("not-a-release", {}),
            pointers(A, { [B]: "https://gateway.example/two/" }),
            pointers(A, { [A]: "http://gateway.example/one/" }),
            { version: 1, games: { ace: { current: A } } },
        ])
            expect(resolveGameFrame("ace", [bad])).toEqual(fallback);
        expect(resolveGameFrame("__proto__", [hosted])).toEqual(
            committedFrame("__proto__")
        );
    });

    it("takes the first pointer file that names a usable release", () => {
        const local = pointers(B, { [B]: `/api/games/releases/ace/${B}/` });
        expect(resolveGameFrame("ace", [null, local, hosted]).release).toBe(B);
        expect(resolveGameFrame("ace", [pointers(A, {}), hosted]).release).toBe(
            A
        );
    });

    it("shows the draft only in development", () => {
        expect(
            resolveGameFrame("ace", [hosted], {
                development: true,
                draft: true,
            })
        ).toEqual({ ...committedFrame("ace"), source: "draft" });
        expect(resolveGameFrame("ace", [hosted], { draft: true }).source).toBe(
            "hosted"
        );
    });

    it("reads the committed pointer file", () => {
        expect(committed.version).toBe(1);
        // A game with stored releases and no `current` loads its committed
        // build; one a person pointed must name a release the page accepts.
        for (const [id, entry] of Object.entries<any>(committed.games))
            if (entry.current !== null)
                expect(pointedRelease(committed, id)).not.toBeNull();
    });

    it("keeps the committed build for a game whose releases are only stored", () => {
        const stored = pointers(A, { [A]: `/api/games/releases/ace/${A}/` });
        (stored.games.ace as any).current = null;
        expect(resolveGameFrame("ace", [stored])).toEqual(
            committedFrame("ace")
        );
    });

    it("names the folder the frame's files load from", () => {
        expect(frameBase("ace")).toBe("/games/ace/");
        expect(frameBase("ace", committedFrame("ace"))).toBe("/games/ace/");
        const base = "https://gateway.example/ipfs/bafybeigdyrzt/";
        expect(
            frameBase(
                "ace",
                resolveGameFrame("ace", [pointers(A, { [A]: base })])
            )
        ).toBe(base);
    });
});

describe("a release stored on IPFS", () => {
    const CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
    const OLD = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
    const gateway = (cid: string) => `https://gateway.example/ipfs/${cid}/`;
    const pinata = (release: string, address: unknown, base: unknown) => ({
        release,
        base,
        backend: "pinata",
        address,
        served: "site",
    });
    const file = (current: string | null, releases: unknown[]) => ({
        version: 1,
        games: { ace: { current, releases } },
    });
    const pinned = file(A, [
        pinata(A, CID, gateway(CID)),
        pinata(B, OLD, gateway(OLD)),
    ]);

    it("loads through this app's releases route, never from the gateway", () => {
        const frame = resolveGameFrame("ace", [pinned]);
        expect(frame).toEqual({
            src: `/api/games/releases/ace/${A}/index.html`,
            release: A,
            source: "hosted",
        });
        // What derives from the frame follows it: the credits and licence
        // texts are read from the route, and the lobby's prepare frame
        // accepts the address (releaseBase, as gamePrepare.ts asks).
        const base = frameBase("ace", frame);
        expect(base).toBe(`/api/games/releases/ace/${A}/`);
        expect(releaseBase("ace", A, base)).toBe(base);
        // A rollback is the same route with the other id.
        const back = file(B, pinned.games.ace.releases);
        expect(resolveGameFrame("ace", [back]).src).toBe(
            `/api/games/releases/ace/${B}/index.html`
        );
        // In production as in development.
        expect(
            resolveGameFrame("ace", [null, pinned], { development: true }).src
        ).toBe(`/api/games/releases/ace/${A}/index.html`);
    });

    it("names the gateway folder of any listed release, for the route", () => {
        expect(pinnedRelease(pinned, "ace", A)).toEqual({
            release: A,
            base: gateway(CID),
        });
        expect(pinnedRelease(pinned, "ace", B)).toEqual({
            release: B,
            base: gateway(OLD),
        });
        // Listed but not pointed at: still a stored release.
        expect(
            pinnedRelease(file(null, pinned.games.ace.releases), "ace", A)?.base
        ).toBe(gateway(CID));
        expect(pinnedRelease(pinned, "ace", "9".repeat(16))).toBeNull();
        expect(pinnedRelease(pinned, "garden", A)).toBeNull();
        expect(pinnedRelease(pinned, "__proto__", A)).toBeNull();
        expect(pinnedRelease(pinned, "ace", "../x")).toBeNull();
        expect(pinnedRelease(null, "ace", A)).toBeNull();
        expect(
            pinnedRelease({ version: 2, games: pinned.games }, "ace", A)
        ).toBeNull();
        // Nothing is switched: the committed file lists no release.
        expect(pinnedRelease(committed, "ace", A)).toBeNull();
    });

    it("refuses an entry whose gateway address is not its CID's https folder", () => {
        for (const [address, base] of [
            [CID, `http://gateway.example/ipfs/${CID}/`],
            [CID, `https://gateway.example/ipfs/${CID}`],
            [CID, gateway(OLD)],
            [CID, `https://user:pass@gateway.example/ipfs/${CID}/`],
            [CID, `${gateway(CID)}?x=1`],
            [CID, `${gateway(CID)}#x`],
            [CID, `https://gateway.example/x/../ipfs/${CID}/`],
            [CID, `/api/games/releases/ace/${A}/`],
            [CID, `https://gateway.example/${"a/".repeat(260)}ipfs/${CID}/`],
            ["cid1", "https://gateway.example/ipfs/cid1/"],
            ["..", "https://gateway.example/ipfs/../"],
            [undefined, gateway(CID)],
            [CID, undefined],
        ]) {
            const entry = pinata(A, address, base);
            expect(pinnedGatewayBase(entry)).toBeNull();
            expect(pinnedRelease(file(A, [entry]), "ace", A)).toBeNull();
            // The page does not fall back to loading the gateway itself.
            expect(resolveGameFrame("ace", [file(A, [entry])])).toEqual(
                committedFrame("ace")
            );
        }
        // Only the pinata backend is served this way.
        expect(
            pinnedGatewayBase({ ...pinata(A, CID, gateway(CID)), backend: "x" })
        ).toBeNull();
        expect(pinnedGatewayBase(null)).toBeNull();
    });
});

describe("localReleasesDir", () => {
    it("is on in development and off elsewhere unless a folder is named", () => {
        expect(
            localReleasesDir({ NODE_ENV: "development" }, "/repo/frontend")
        ).toBe("/repo/.games-releases");
        expect(
            localReleasesDir({ NODE_ENV: "production" }, "/repo/frontend")
        ).toBeNull();
        expect(
            localReleasesDir(
                { NODE_ENV: "production", GAMES_RELEASES_DIR: "/srv/releases" },
                "/repo/frontend"
            )
        ).toBe("/srv/releases");
        expect(
            localReleasesDir({ GAMES_RELEASES_DIR: "tmp/r" }, "/repo/frontend")
        ).toBe("/repo/tmp/r");
    });
});
