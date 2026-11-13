import { branchName, createGitHub } from "./github";

function fakeFetch(routes: Record<string, (body: any) => [number, any]>) {
    const calls: { method: string; path: string; body: any; auth: string }[] =
        [];
    const impl = jest.fn(async (url: string, init: any) => {
        const path = url.replace("https://api.github.com", "");
        const method = init.method;
        const body = init.body ? JSON.parse(init.body) : undefined;
        calls.push({ method, path, body, auth: init.headers.Authorization });
        const route = routes[`${method} ${path}`];
        const [status, data] = route
            ? route(body)
            : [404, { message: "Not Found" }];
        return {
            ok: status < 400,
            status,
            json: async () => data,
            headers: {
                get: (name: string) =>
                    name === "x-oauth-scopes" ? "public_repo" : null,
            },
        } as any;
    });
    return { impl, calls };
}

describe("contributor GitHub client", () => {
    it("reads the token's login and scopes", async () => {
        const { impl, calls } = fakeFetch({
            "GET /user": () => [200, { login: "ada" }],
        });
        const me = await createGitHub("tok", { fetchImpl: impl }).me();
        expect(me).toEqual({ login: "ada", scopes: ["public_repo"] });
        expect(calls[0].auth).toBe("Bearer tok");
    });

    it("decodes files and returns null for missing ones", async () => {
        const { impl } = fakeFetch({
            "GET /repos/oncyberio/oncyber/contents/frontend/a.ts?ref=abc":
                () => [
                    200,
                    {
                        encoding: "base64",
                        content: btoa("héllo".replace("é", "e")),
                    },
                ],
        });
        const gh = createGitHub("tok", { fetchImpl: impl });
        expect(await gh.readFile("frontend/a.ts", "abc")).toBe("hello");
        expect(await gh.readFile("nope.ts", "abc")).toBeNull();
    });

    it("opens the pull request from the contributor's fork", async () => {
        let commitsTried = 0;
        const { impl, calls } = fakeFetch({
            "POST /repos/oncyberio/oncyber/forks": () => [
                202,
                {
                    owner: { login: "ada" },
                    name: "oncyber",
                    default_branch: "main",
                },
            ],
            "GET /repos/ada/oncyber/commits?per_page=1": () =>
                ++commitsTried < 2 ? [409, { message: "empty" }] : [200, []],
            "POST /repos/ada/oncyber/merge-upstream": () => [200, {}],
            "GET /repos/ada/oncyber/git/commits/base": () => [
                200,
                { tree: { sha: "t0" } },
            ],
            "POST /repos/ada/oncyber/git/trees": () => [201, { sha: "t1" }],
            "POST /repos/ada/oncyber/git/commits": () => [201, { sha: "c1" }],
            "POST /repos/ada/oncyber/git/refs": () => [201, {}],
            "POST /repos/oncyberio/oncyber/pulls": () => [
                201,
                {
                    html_url: "https://github.com/oncyberio/oncyber/pull/9",
                    number: 9,
                },
            ],
        });
        const gh = createGitHub("tok", {
            fetchImpl: impl,
            wait: async () => {},
        });
        const pull = await gh.openPullRequest({
            baseSha: "base",
            files: { "frontend/a.ts": "new" },
            title: "Rename button",
            body: "body",
            branch: "contrib/rename",
        });
        expect(pull).toEqual({
            url: "https://github.com/oncyberio/oncyber/pull/9",
            number: 9,
        });
        const find = (key: string) =>
            calls.find((c) => `${c.method} ${c.path}` === key);
        expect(find("POST /repos/ada/oncyber/git/trees").body).toEqual({
            base_tree: "t0",
            tree: [
                {
                    path: "frontend/a.ts",
                    mode: "100644",
                    type: "blob",
                    content: "new",
                },
            ],
        });
        expect(
            find("POST /repos/ada/oncyber/git/commits").body.parents
        ).toEqual(["base"]);
        expect(find("POST /repos/ada/oncyber/git/refs").body).toEqual({
            ref: "refs/heads/contrib/rename",
            sha: "c1",
        });
        expect(find("POST /repos/oncyberio/oncyber/pulls").body).toMatchObject({
            head: "ada:contrib/rename",
            base: "main",
        });
        // Nothing is ever written to oncyber itself except the pull request.
        const upstreamWrites = calls.filter(
            (c) => c.method === "POST" && c.path.startsWith("/repos/oncyberio/")
        );
        expect(upstreamWrites.map((c) => c.path)).toEqual([
            "/repos/oncyberio/oncyber/forks",
            "/repos/oncyberio/oncyber/pulls",
        ]);
    });

    it("names branches from the title", () => {
        expect(
            branchName(
                "Make the title BIGGER!",
                new Date("2026-11-13T23:40:00Z")
            )
        ).toBe("contrib/make-the-title-bigger-202611132340");
    });
});
