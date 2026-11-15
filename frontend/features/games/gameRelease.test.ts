import {
    committedFrame,
    frameBase,
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
