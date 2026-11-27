import {
    looksSameSite,
    previewWorldOrigin,
    siteOrigin,
    trialPreview,
} from "./siteOrigin";
import { readWorldFrame } from "@features/worlds/worldFrame";

const preview = {
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "games-dev",
    VERCEL_BRANCH_URL: "oncyber-git-games-dev-oncyber.vercel.app",
    VERCEL_URL: "oncyber-abc123-oncyber.vercel.app",
};

describe("a preview of the trial branch", () => {
    test("has a site and a world host: the branch's address and the deployment's own", () => {
        expect(trialPreview(preview)).toBe(true);
        const frame = readWorldFrame(
            previewWorldOrigin(preview),
            siteOrigin(preview)
        );
        expect(frame).toEqual({
            site: "https://oncyber-git-games-dev-oncyber.vercel.app",
            world: "https://oncyber-abc123-oncyber.vercel.app",
        });
    });

    test("with one address only, worlds are not framed", () => {
        expect(
            previewWorldOrigin({ ...preview, VERCEL_BRANCH_URL: undefined })
        ).toBe("");
        expect(
            previewWorldOrigin({
                ...preview,
                VERCEL_BRANCH_URL: preview.VERCEL_URL,
            })
        ).toBe("");
    });
});

describe("everywhere else", () => {
    test.each([
        ["production", { ...preview, VERCEL_ENV: "production" }],
        ["another branch", { ...preview, VERCEL_GIT_COMMIT_REF: "main" }],
        ["a local build", {}],
    ])("%s goes by its own settings", (_name, env) => {
        expect(trialPreview(env)).toBe(false);
        expect(previewWorldOrigin(env)).toBe("");
    });
});

describe("whether a world host looks like the same site", () => {
    test("another name under the same domain is the same site", () => {
        expect(
            looksSameSite(
                "https://www.oncyber.com",
                "https://worlds.oncyber.com"
            )
        ).toBe(true);
        expect(
            looksSameSite("https://oncyber.com", "https://a.b.oncyber.com")
        ).toBe(true);
    });
    test("a domain of its own is not, and nor are two names on a shared host", () => {
        expect(
            looksSameSite(
                "https://www.oncyber.com",
                "https://oncyber-worlds.com"
            )
        ).toBe(false);
        expect(
            looksSameSite(
                "https://oncyber-git-games-dev-oncyber.vercel.app",
                "https://oncyber-abc123-oncyber.vercel.app"
            )
        ).toBe(false);
        // the local pair: one machine, two names a browser keeps apart
        expect(
            looksSameSite("http://localhost:13000", "http://127.0.0.1:13000")
        ).toBe(false);
        expect(looksSameSite("not a url", "https://www.oncyber.com")).toBe(
            false
        );
    });
});
