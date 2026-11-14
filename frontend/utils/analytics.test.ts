import { analyticsSuperProperties } from "./analytics";

describe("analyticsSuperProperties", () => {
    it("marks events as coming from the new frontend, with build and env", () => {
        expect(
            analyticsSuperProperties({
                NEXT_PUBLIC_BUILD_SHA: "4c6d643",
                NEXT_PUBLIC_DEPLOY_ENV: "production",
            })
        ).toEqual({
            frontend: "oncyber-v2",
            build: "4c6d643",
            deploy_env: "production",
        });
    });

    it("says unknown when the build doesn't set them (local dev)", () => {
        expect(analyticsSuperProperties({})).toEqual({
            frontend: "oncyber-v2",
            build: "unknown",
            deploy_env: "unknown",
        });
    });
});
