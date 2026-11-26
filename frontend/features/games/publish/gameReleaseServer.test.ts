/** @jest-environment node */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import handler from "../../pages/api/games/releases/[...path]";
import { gameContentSecurityPolicy } from "./networkPolicy";

const RELEASE = "0800022feca2d8ba";
let root: string;
const env = { ...process.env };

beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "releases-route-"));
    const folder = join(root, "ace", RELEASE);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "index.html"), "<!doctype html>");
    writeFileSync(
        join(folder, "network.json"),
        JSON.stringify({
            version: 1,
            hosts: ["cyber.mypinata.cloud"],
            inlineScripts: [],
        })
    );
    mkdirSync(join(root, "garden", RELEASE), { recursive: true });
    writeFileSync(
        join(root, "garden", RELEASE, "index.html"),
        "<!doctype html>"
    );
    process.env.GAMES_RELEASES_DIR = root;
});
beforeEach(() => {
    process.env.GAMES_PREVIEW = "1";
});
afterAll(() => {
    process.env = env;
    rmSync(root, { recursive: true, force: true });
});

async function head(path: string[]) {
    const headers: Record<string, unknown> = {};
    let status = 0;
    const res: any = {
        setHeader: (name: string, value: unknown) =>
            void (headers[name.toLowerCase()] = value),
        status: (code: number) => ((status = code), res),
        end: () => res,
    };
    await handler({ method: "HEAD", query: { path } } as any, res);
    return { status, headers };
}

test("a local release is served with what every release host must send", async () => {
    const { status, headers } = await head(["ace", RELEASE, "index.html"]);
    expect(status).toBe(200);
    expect(headers["access-control-allow-origin"]).toBe("*");
    // The game's policy, from the release's own network.json, exactly as
    // next.config.js builds it for a committed build, and a sandbox.
    expect(headers["content-security-policy"]).toBe(
        `${gameContentSecurityPolicy([
            "cyber.mypinata.cloud",
        ])}; sandbox allow-scripts allow-pointer-lock`
    );
});

test("a release with no declaration reaches only its own files", async () => {
    const { headers } = await head(["garden", RELEASE, "index.html"]);
    expect(headers["content-security-policy"]).toBe(
        `${gameContentSecurityPolicy(
            []
        )}; sandbox allow-scripts allow-pointer-lock`
    );
});

test("where games are hidden, no release is served", async () => {
    delete process.env.GAMES_PREVIEW;
    const { status, headers } = await head(["ace", RELEASE, "index.html"]);
    expect(status).toBe(404);
    expect(headers["cache-control"]).toBe("no-store");
    expect(headers["access-control-allow-origin"]).toBeUndefined();
});

test("nothing outside a release is served", async () => {
    for (const path of [
        ["ace", RELEASE, "..", "..", "garden", RELEASE, "index.html"],
        ["ace", RELEASE],
        ["ace", "not-a-release", "index.html"],
        ["ace", RELEASE, "missing.js"],
    ])
        expect((await head(path)).status).toBe(404);
});
