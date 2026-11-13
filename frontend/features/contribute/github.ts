/**
 * GitHub calls made from the browser with the contributor's own token.
 * Pull requests always come from the contributor's fork of the repository.
 */
export const UPSTREAM = {
    owner: "oncyberio",
    repo: "oncyber",
    branch: "main",
} as const;

const API = "https://api.github.com";
const UP = `/repos/${UPSTREAM.owner}/${UPSTREAM.repo}`;

/** A classic token with only the scope a fork and a pull request need. */
export const NEW_TOKEN_URL =
    "https://github.com/settings/tokens/new?scopes=public_repo&description=Oncyber%20contributor%20mode";

export class GitHubError extends Error {
    constructor(message: string, public status: number) {
        super(message);
    }
}

type Fetch = typeof fetch;

const encode = (path: string) =>
    path.split("/").map(encodeURIComponent).join("/");

function fromBase64(content: string) {
    const bytes = Uint8Array.from(atob(content.replace(/\n/g, "")), (c) =>
        c.charCodeAt(0)
    );
    return new TextDecoder().decode(bytes);
}

export function createGitHub(
    token: string,
    {
        fetchImpl = (...args: Parameters<Fetch>) => fetch(...args),
        wait = (ms: number) => new Promise((done) => setTimeout(done, ms)),
    }: { fetchImpl?: Fetch; wait?: (ms: number) => Promise<unknown> } = {}
) {
    async function call<T = any>(
        path: string,
        init: { method?: string; body?: unknown } = {}
    ): Promise<{ data: T; headers: Headers }> {
        const response = await fetchImpl(API + path, {
            method: init.method || "GET",
            headers: {
                Accept: "application/vnd.github+json",
                Authorization: `Bearer ${token}`,
                "X-GitHub-Api-Version": "2022-11-28",
                ...(init.body ? { "Content-Type": "application/json" } : {}),
            },
            body: init.body ? JSON.stringify(init.body) : undefined,
        });
        const data = await response.json().catch(() => null);
        if (!response.ok)
            throw new GitHubError(
                data?.message || `GitHub answered ${response.status}`,
                response.status
            );
        return { data, headers: response.headers };
    }

    return {
        /** Checks the token. Classic tokens list their scopes. */
        async me() {
            const { data, headers } = await call("/user");
            const scopes = headers.get("x-oauth-scopes");
            return {
                login: data.login as string,
                scopes:
                    scopes === null
                        ? null
                        : scopes.split(",").map((scope) => scope.trim()),
            };
        },

        async mainSha(): Promise<string> {
            const { data } = await call(
                `${UP}/git/ref/heads/${UPSTREAM.branch}`
            );
            return data.object.sha;
        },

        /** A file of oncyber at `ref`, or null when there is none. */
        async readFile(path: string, ref: string): Promise<string | null> {
            try {
                const { data } = await call(
                    `${UP}/contents/${encode(path)}?ref=${ref}`
                );
                if (Array.isArray(data))
                    return `(directory) ${data
                        .map(
                            (entry) =>
                                entry.name + (entry.type === "dir" ? "/" : "")
                        )
                        .join("  ")}`;
                if (data.encoding !== "base64")
                    throw new GitHubError(
                        "This file is too large to read.",
                        413
                    );
                return fromBase64(data.content);
            } catch (error) {
                if (error.status === 404) return null;
                throw error;
            }
        },

        /** Lists a directory: names, with a trailing slash for folders. */
        async listDir(path: string, ref: string): Promise<string[] | null> {
            try {
                const { data } = await call(
                    `${UP}/contents/${encode(path)}?ref=${ref}`
                );
                if (!Array.isArray(data)) return null;
                return data.map(
                    (entry) => entry.name + (entry.type === "dir" ? "/" : "")
                );
            } catch (error) {
                if (error.status === 404) return null;
                throw error;
            }
        },

        /** Code search on main (GitHub allows about ten a minute). */
        async searchCode(query: string) {
            const q = encodeURIComponent(
                `${query} repo:${UPSTREAM.owner}/${UPSTREAM.repo}`
            );
            const { data } = await call(`/search/code?q=${q}&per_page=15`, {});
            return (data.items || []).map((item) => item.path as string);
        },

        /**
         * Forks oncyber (or reuses the contributor's fork), commits the files
         * on a new branch based on `baseSha`, and opens a pull request to
         * oncyber's main branch.
         */
        async openPullRequest({
            baseSha,
            files,
            title,
            body,
            branch,
            onStep = () => {},
        }: {
            baseSha: string;
            files: Record<string, string>;
            title: string;
            body: string;
            branch: string;
            onStep?: (step: string) => void;
        }) {
            onStep("Finding your fork");
            const { data: fork } = await call(`${UP}/forks`, {
                method: "POST",
                body: { default_branch_only: true },
            });
            const repo = `/repos/${fork.owner.login}/${fork.name}`;

            // A new fork takes a few seconds before it accepts writes.
            for (let attempt = 0; ; attempt++) {
                try {
                    await call(`${repo}/commits?per_page=1`);
                    break;
                } catch (error) {
                    if (attempt >= 20) throw error;
                    await wait(3000);
                }
            }
            // Bring the fork up to date so it holds the base commit. A fork
            // whose main has its own commits refuses; the base may still be
            // there, so carry on.
            await call(`${repo}/merge-upstream`, {
                method: "POST",
                body: { branch: fork.default_branch || UPSTREAM.branch },
            }).catch(() => null);

            onStep("Committing your change");
            const { data: base } = await call(`${repo}/git/commits/${baseSha}`);
            const { data: tree } = await call(`${repo}/git/trees`, {
                method: "POST",
                body: {
                    base_tree: base.tree.sha,
                    tree: Object.entries(files).map(([path, content]) => ({
                        path,
                        mode: "100644",
                        type: "blob",
                        content,
                    })),
                },
            });
            const { data: commit } = await call(`${repo}/git/commits`, {
                method: "POST",
                body: { message: title, tree: tree.sha, parents: [baseSha] },
            });
            await call(`${repo}/git/refs`, {
                method: "POST",
                body: { ref: `refs/heads/${branch}`, sha: commit.sha },
            });

            onStep("Opening the pull request");
            const { data: pull } = await call(`${UP}/pulls`, {
                method: "POST",
                body: {
                    title,
                    body,
                    head: `${fork.owner.login}:${branch}`,
                    base: UPSTREAM.branch,
                    maintainer_can_modify: true,
                },
            });
            return { url: pull.html_url as string, number: pull.number };
        },
    };
}

export type GitHub = ReturnType<typeof createGitHub>;

export function branchName(title: string, now = new Date()) {
    const slug =
        title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 40) || "change";
    const stamp = now.toISOString().replace(/\D/g, "").slice(0, 12);
    return `contrib/${slug}-${stamp}`;
}
