/** @jest-environment node */
import { Readable, Writable } from "stream";
import handler, {
    forgetPinnedPolicies,
} from "../../pages/api/games/releases/[...path]";
import { gatewayGet } from "./pinnedGateway";
import { gameContentSecurityPolicy } from "./networkPolicy";

// A release the committed pointer stores on IPFS, served by the site's
// releases route in front of the gateway (docs/games/releases.md).
const CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const OTHER = "bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";
const GATEWAY = `https://gateway.example/ipfs/${CID}/`;
const CURRENT = "0800022feca2d8ba";
const EARLIER = "1111111111111111";
const HTTP = "2222222222222222";
const ELSEWHERE = "3333333333333333";
const DIRECT = "4444444444444444";
const SANDBOX = "sandbox allow-scripts allow-pointer-lock";

jest.mock("./releases.json", () => {
    const cid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
    const other = "bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";
    const pinata = (release: string, address: string, base: string) => ({
        release,
        base,
        backend: "pinata",
        address,
        served: "site",
    });
    return {
        version: 1,
        games: {
            ace: {
                current: "0800022feca2d8ba",
                releases: [
                    pinata(
                        "0800022feca2d8ba",
                        cid,
                        `https://gateway.example/ipfs/${cid}/`
                    ),
                    pinata(
                        "1111111111111111",
                        other,
                        `https://gateway.example/ipfs/${other}/`
                    ),
                    // Not servable: plain http, and a base that is not
                    // the folder of the entry's own CID.
                    pinata(
                        "2222222222222222",
                        cid,
                        `http://gateway.example/ipfs/${cid}/`
                    ),
                    pinata(
                        "3333333333333333",
                        cid,
                        `https://gateway.example/ipfs/${other}/`
                    ),
                    // Another https host: loaded directly, never through
                    // this route.
                    {
                        release: "4444444444444444",
                        base: "https://releases.example/ace/",
                        backend: "elsewhere",
                        address: "x",
                    },
                ],
            },
        },
    };
});
jest.mock("./pinnedGateway");

const get = gatewayGet as jest.MockedFunction<typeof gatewayGet>;
/** What the fake gateway holds, by URL: bytes, or an answer. */
let gateway: Record<
    string,
    string | { status: number; headers?: Record<string, string>; body?: string }
>;
const env = { ...process.env };

beforeEach(() => {
    // Production: no local folder.
    delete process.env.GAMES_RELEASES_DIR;
    (process.env as any).NODE_ENV = "production";
    forgetPinnedPolicies();
    gateway = {
        [`${GATEWAY}index.html`]: "<!doctype html>game",
        [`${GATEWAY}assets/a.js`]: "export default 1",
        [`${GATEWAY}network.json`]: JSON.stringify({
            version: 1,
            hosts: ["cyber.mypinata.cloud"],
            inlineScripts: [],
        }),
    };
    get.mockReset();
    get.mockImplementation(async (url) => {
        const held = gateway[url.href];
        const answer =
            held === undefined
                ? { status: 404, body: "gateway says: no such file" }
                : typeof held === "string"
                ? { status: 200, body: held }
                : held;
        return {
            status: answer.status,
            // What a gateway says about a file is not passed on.
            headers: {
                "content-type": "text/plain",
                "set-cookie": ["gateway=1"],
                "x-ipfs-path": "/ipfs/secret",
                ...answer.headers,
            },
            body: Readable.from([Buffer.from(answer.body ?? "")]),
        };
    });
});
afterAll(() => {
    process.env = env;
});

async function request(path: string[], method = "GET") {
    const headers: Record<string, unknown> = {};
    let body = "";
    let status = 0;
    const res: any = new Writable({
        write(chunk, _encoding, done) {
            body += chunk.toString("utf8");
            done();
        },
    });
    res.setHeader = (name: string, value: unknown) =>
        void (headers[name.toLowerCase()] = value);
    res.status = (code: number) => ((status = code), res);
    await handler({ method, query: { path } } as any, res);
    return { status, headers, body };
}
const asked = () => get.mock.calls.map(([url]) => url.href);

test("a pinned release is fetched from its gateway and sent with the release headers", async () => {
    const { status, headers, body } = await request([
        "ace",
        CURRENT,
        "index.html",
    ]);
    expect(status).toBe(200);
    expect(body).toBe("<!doctype html>game");
    expect(headers).toEqual({
        // The route's own type for the extension, not the gateway's.
        "content-type": "text/html; charset=utf-8",
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
        // The game's policy, from the release's own network.json.
        "content-security-policy": `${gameContentSecurityPolicy([
            "cyber.mypinata.cloud",
        ])}; ${SANDBOX}`,
    });
    expect(asked()).toEqual([`${GATEWAY}network.json`, `${GATEWAY}index.html`]);
});

test("content types come from the route's table", async () => {
    gateway[`${GATEWAY}assets/a.js`] = {
        status: 200,
        headers: { "content-type": "text/html", "content-length": "16" },
        body: "export default 1",
    };
    gateway[`${GATEWAY}model.glb`] = "glb";
    gateway[`${GATEWAY}licenses/NOTICE`] = "text";
    const js = await request(["ace", CURRENT, "assets", "a.js"]);
    expect(js.headers["content-type"]).toBe("text/javascript");
    expect(js.headers["content-length"]).toBe("16");
    expect(js.body).toBe("export default 1");
    expect(
        (await request(["ace", CURRENT, "model.glb"])).headers["content-type"]
    ).toBe("model/gltf-binary");
    expect(
        (await request(["ace", CURRENT, "licenses", "NOTICE"])).headers[
            "content-type"
        ]
    ).toBe("application/octet-stream");
});

test("the policy is read once per release, and HEAD sends no body", async () => {
    await request(["ace", CURRENT, "index.html"]);
    const head = await request(["ace", CURRENT, "assets", "a.js"], "HEAD");
    expect(head.status).toBe(200);
    expect(head.body).toBe("");
    expect(head.headers["content-security-policy"]).toContain(
        "https://cyber.mypinata.cloud"
    );
    expect(asked().filter((url) => url.endsWith("network.json"))).toHaveLength(
        1
    );
});

test("a release with no declaration, or a malformed one, reaches only its own files", async () => {
    const own = `${gameContentSecurityPolicy([])}; ${SANDBOX}`;
    delete gateway[`${GATEWAY}network.json`];
    expect(
        (await request(["ace", CURRENT, "index.html"])).headers[
            "content-security-policy"
        ]
    ).toBe(own);
    forgetPinnedPolicies();
    gateway[`${GATEWAY}network.json`] = "<html>not json";
    expect(
        (await request(["ace", CURRENT, "index.html"])).headers[
            "content-security-policy"
        ]
    ).toBe(own);
    forgetPinnedPolicies();
    gateway[`${GATEWAY}network.json`] = JSON.stringify({
        hosts: ["https://evil.example/x", "*"],
    });
    expect(
        (await request(["ace", CURRENT, "index.html"])).headers[
            "content-security-policy"
        ]
    ).toBe(own);
});

test("any listed release is served, so a rollback needs nothing new", async () => {
    const base = `https://gateway.example/ipfs/${OTHER}/`;
    gateway[`${base}index.html`] = "earlier";
    const { status, body, headers } = await request([
        "ace",
        EARLIER,
        "index.html",
    ]);
    expect(status).toBe(200);
    expect(body).toBe("earlier");
    // Its own policy: this release carries no network.json.
    expect(headers["content-security-policy"]).toBe(
        `${gameContentSecurityPolicy([])}; ${SANDBOX}`
    );
    expect(asked()).toEqual([`${base}network.json`, `${base}index.html`]);
});

test("what the pointer does not list is not fetched", async () => {
    for (const path of [
        ["ace", "9999999999999999", "index.html"], // unknown release
        ["garden", CURRENT, "index.html"], // game not in the pointer
        ["__proto__", CURRENT, "index.html"],
        ["ace", "not-a-release", "index.html"],
        ["ace", CURRENT],
        ["ace", HTTP, "index.html"], // plain http base
        ["ace", ELSEWHERE, "index.html"], // base is not its CID's folder
        ["ace", DIRECT, "index.html"], // not a pinata release
    ])
        expect((await request(path)).status).toBe(404);
    expect(await request(["ace", CURRENT, "index.html"], "POST")).toMatchObject(
        { status: 404 }
    );
    expect(get).not.toHaveBeenCalled();
});

test("a path stays inside the release's folder", async () => {
    for (const rest of [
        ["..", OTHER, "index.html"],
        ["assets", "..", "..", "..", "x"],
        [".", "index.html"],
        ["", "index.html"],
        ["assets/../../x"],
        ["..\\x"],
        ["a\u0000.js"],
        ["x".repeat(1025)],
    ])
        expect((await request(["ace", CURRENT, ...rest])).status).toBe(404);
    expect(get).not.toHaveBeenCalled();
    // What is left is one file name: it cannot become a query, a
    // fragment, another host or an encoded step up.
    for (const name of ["a.js?x=1", "a.js#x", "%2e%2e", "@evil.example"])
        await request(["ace", CURRENT, name]);
    const files = asked().filter((url) => !url.endsWith("network.json"));
    expect(files).toEqual([
        `${GATEWAY}a.js%3Fx%3D1`,
        `${GATEWAY}a.js%23x`,
        `${GATEWAY}%252e%252e`,
        `${GATEWAY}%40evil.example`,
    ]);
});

test("a gateway failure is a 404 or a 502, with nothing of the gateway's in it", async () => {
    const missing = await request(["ace", CURRENT, "missing.js"]);
    expect(missing.status).toBe(404);
    expect(missing.body).toBe("");
    expect(missing.headers).toEqual({ "cache-control": "no-store" });

    for (const answer of [
        { status: 500, body: "gateway stack trace" },
        { status: 403, body: "plan does not serve html" },
        // A redirect is not followed, here or to another host.
        {
            status: 301,
            headers: { location: "https://elsewhere.example/index.html" },
        },
        { status: 206, body: "part" },
        // Bytes this route would pass on encoded.
        { status: 200, headers: { "content-encoding": "gzip" }, body: "x" },
    ]) {
        gateway[`${GATEWAY}index.html`] = answer;
        const failed = await request(["ace", CURRENT, "index.html"]);
        expect(failed.status).toBe(502);
        expect(failed.body).toBe("");
        expect(failed.headers).toEqual({ "cache-control": "no-store" });
    }
    expect(asked().every((url) => url.startsWith(GATEWAY))).toBe(true);

    get.mockRejectedValue(new Error("Timed out"));
    expect((await request(["ace", CURRENT, "index.html"])).status).toBe(502);
});

test("no file is sent under a policy that could not be read, and it is asked again", async () => {
    gateway[`${GATEWAY}network.json`] = { status: 503 };
    const failed = await request(["ace", CURRENT, "index.html"]);
    expect(failed.status).toBe(502);
    expect(failed.headers).toEqual({ "cache-control": "no-store" });
    expect(asked()).toEqual([`${GATEWAY}network.json`]);
    // The failure was not remembered.
    gateway[`${GATEWAY}network.json`] = JSON.stringify({ hosts: [] });
    expect((await request(["ace", CURRENT, "index.html"])).status).toBe(200);
});
