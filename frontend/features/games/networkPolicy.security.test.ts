import fs from "fs";
import path from "path";
import {
    gameContentSecurityPolicy,
    gameNetworkHeaders,
    hostDeclared,
    readInlineScripts,
    readNetwork,
} from "./networkPolicy";

const directive = (policy: string, name: string) =>
    policy
        .split("; ")
        .find((part) => part.startsWith(`${name} `))
        ?.split(" ")
        .slice(1) ?? [];

const games = path.join(__dirname, "../../public/games");
const sources = path.join(__dirname, "../../../games");
const hash = "sha256-n0yitukgHPWhP2R0+VSC57iD+ieTtiIPDO1lA5N7OdE=";

describe("game network boundary", () => {
    it("a game that declares nothing reaches only its own files", () => {
        const policy = gameContentSecurityPolicy([]);
        expect(directive(policy, "default-src")).toEqual(["'none'"]);
        expect(directive(policy, "connect-src")).toEqual([
            "'self'",
            "data:",
            "blob:",
        ]);
        expect(directive(policy, "img-src")).toEqual([
            "'self'",
            "data:",
            "blob:",
        ]);
        expect(directive(policy, "media-src")).toEqual([
            "'self'",
            "data:",
            "blob:",
        ]);
        expect(directive(policy, "frame-src")).toEqual(["'self'"]);
        expect(directive(policy, "base-uri")).toEqual(["'none'"]);
        expect(directive(policy, "form-action")).toEqual(["'none'"]);
        expect(policy).not.toMatch(/https?:|wss?:|\*/);
    });

    it("declared hosts serve data, images and media over TLS, never code", () => {
        const policy = gameContentSecurityPolicy([
            "cdn.example.com",
            "*.media.example.com",
        ]);
        expect(directive(policy, "connect-src")).toEqual(
            expect.arrayContaining([
                "https://cdn.example.com",
                "wss://cdn.example.com",
                "https://*.media.example.com",
            ])
        );
        expect(directive(policy, "img-src")).toContain(
            "https://cdn.example.com"
        );
        expect(directive(policy, "media-src")).toContain(
            "https://cdn.example.com"
        );
        for (const name of ["script-src", "worker-src", "frame-src"])
            expect(directive(policy, name).join(" ")).not.toContain(
                "example.com"
            );
        expect(policy).not.toContain("http://");
        expect(policy).not.toContain("ws://");
    });

    it("never allows eval, inline handlers or unlisted inline script", () => {
        const policy = gameContentSecurityPolicy(["cdn.example.com"], {
            inlineScripts: [hash],
        });
        expect(directive(policy, "script-src")).toEqual([
            "'self'",
            "'wasm-unsafe-eval'",
            `'${hash}'`,
        ]);
        expect(policy).not.toContain("'unsafe-eval'");
        expect(directive(policy, "script-src")).not.toContain(
            "'unsafe-inline'"
        );
        expect(policy).not.toContain("'unsafe-hashes'");
    });

    it.each([
        "*",
        "*.com",
        "com",
        "localhost",
        "https://cdn.example.com",
        "cdn.example.com/path",
        "cdn.example.com:0",
        "cdn.example.com:99999",
        "CDN.example.com",
        "user@cdn.example.com",
        "cdn.*.example.com",
        "127.0.0.1",
        "10.0.0.1:8080",
        "[::1]",
        "cdn.example.com; script-src *",
        "cdn.example.com 'unsafe-eval'",
        "cdn.example.com,evil.example",
        "-cdn.example.com",
        "",
        42,
        null,
        ["cdn.example.com"],
    ])("refuses the declaration %p", (entry) => {
        const { hosts, errors } = readNetwork([entry]);
        expect(hosts).toEqual([]);
        expect(errors).toHaveLength(1);
    });

    it("reads a valid declaration, without duplicates", () => {
        expect(
            readNetwork([
                "cdn.example.com",
                "*.media.example.com",
                "rt.example.com:8443",
                "cdn.example.com",
            ])
        ).toEqual({
            hosts: [
                "cdn.example.com",
                "*.media.example.com",
                "rt.example.com:8443",
            ],
            errors: [],
        });
        expect(readNetwork(undefined)).toEqual({ hosts: [], errors: [] });
        expect(readNetwork("cdn.example.com").errors).toHaveLength(1);
        expect(
            readNetwork(
                Array.from({ length: 17 }, (_, i) => `h${i}.example.com`)
            ).errors
        ).toHaveLength(1);
    });

    it("matches hosts the way the policy does", () => {
        const hosts = ["cdn.example.com", "*.media.example.com"];
        expect(hostDeclared(hosts, "cdn.example.com")).toBe(true);
        expect(hostDeclared(hosts, "CDN.Example.com.")).toBe(true);
        expect(hostDeclared(hosts, "a.media.example.com")).toBe(true);
        expect(hostDeclared(hosts, "a.b.media.example.com")).toBe(true);
        for (const other of [
            "media.example.com",
            "evilmedia.example.com",
            "cdn.example.com.evil.test",
            "notcdn.example.com",
            "cdn.example.com:8443",
            "example.com",
        ])
            expect(hostDeclared(hosts, other)).toBe(false);
    });

    it("keeps only real script hashes from a published declaration", () => {
        expect(
            readInlineScripts([
                hash,
                "'unsafe-inline'",
                "sha256-short=",
                `${hash}' 'unsafe-eval`,
                "https://evil.example",
                7,
            ])
        ).toEqual([hash]);
        expect(readInlineScripts("'unsafe-inline'")).toEqual([]);
    });
});

describe("game file headers", () => {
    const rules = gameNetworkHeaders(games, fs);
    const policyFor = (source: string) =>
        rules.filter((rule) => rule.source === source).pop()?.headers[0];

    it("covers every game's files but not the /games/<id> pages", () => {
        // `:path+` needs a segment after the id, so the Next.js page at
        // /games/ace keeps the site's own headers.
        for (const rule of rules) expect(rule.source).toMatch(/\/:path\+$/);
        expect(rules[0].source).toBe("/games/:id/:path+");
        expect(rules[0].headers[0].value).toBe(gameContentSecurityPolicy([]));
    });

    it.each(["ace", "garden", "padel"])(
        "%s is served with exactly what its game.json declares",
        (id) => {
            const manifest = JSON.parse(
                fs.readFileSync(path.join(sources, id, "game.json"), "utf8")
            );
            const declared = readNetwork(manifest.network);
            expect(Array.isArray(manifest.network)).toBe(true);
            expect(declared.errors).toEqual([]);
            const published = JSON.parse(
                fs.readFileSync(path.join(games, id, "network.json"), "utf8")
            );
            expect(published.hosts).toEqual(declared.hosts);
            const header = policyFor(`/games/${id}/:path+`);
            expect(header.key).toBe("Content-Security-Policy");
            expect(header.value).toBe(
                gameContentSecurityPolicy(declared.hosts, {
                    inlineScripts: published.inlineScripts,
                })
            );
        }
    );

    it("a tampered or missing declaration narrows to the game's own files", () => {
        const fake = (content: string | null) => ({
            existsSync: () => true,
            readdirSync: () => [{ name: "demo", isDirectory: () => true }],
            readFileSync: () => {
                if (content === null) throw new Error("ENOENT");
                return content;
            },
        });
        const strict = gameContentSecurityPolicy([]);
        for (const content of [
            null,
            "not json",
            "null",
            '{"hosts":"*"}',
            '{"hosts":["cdn.example.com","*"]}',
            '{"hosts":["cdn.example.com; script-src *"]}',
        ]) {
            const [, rule] = gameNetworkHeaders("/games", fake(content));
            expect(rule.source).toBe("/games/demo/:path+");
            expect(rule.headers[0].value).toBe(strict);
        }
    });

    it("skips folders that are not game ids", () => {
        const rules = gameNetworkHeaders("/games", {
            existsSync: () => true,
            readdirSync: () => [
                { name: "../etc", isDirectory: () => true },
                { name: "Ace:path*", isDirectory: () => true },
                { name: "readme.md", isDirectory: () => false },
            ],
            readFileSync: () => '{"hosts":[]}',
        });
        expect(rules).toHaveLength(1);
    });
});
