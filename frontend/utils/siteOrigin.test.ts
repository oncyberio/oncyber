import { previewWorldOrigin, siteOrigin, trialPreview } from "./siteOrigin";
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
