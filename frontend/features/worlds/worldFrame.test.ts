/** @jest-environment node */
import {
    WORLD_FRAME,
    WORLD_SANDBOX,
    readWorldFrame,
    worldFrameRole,
    worldFrameUrl,
} from "./worldFrame";
import { answerOnWorldHost } from "./worldHost";

const SITE = "https://www.oncyber.com";
const WORLD = "https://worlds.example";
const frame = readWorldFrame(WORLD, SITE);

describe("readWorldFrame", () => {
    test("off unless a world origin is set", () => {
        expect(readWorldFrame(undefined, SITE)).toBeNull();
        expect(readWorldFrame("", SITE)).toBeNull();
        // nothing is set where the tests run
        expect(WORLD_FRAME).toBeNull();
    });

    test("two different hosts make a frame", () => {
        expect(frame).toEqual({ site: SITE, world: WORLD });
        expect(
            readWorldFrame("http://127.0.0.1:13000", "http://localhost:13000")
        ).toEqual({
            site: "http://localhost:13000",
            world: "http://127.0.0.1:13000",
        });
    });

    test.each([
        ["the site's own host", SITE],
        ["the site's host on another port", "https://www.oncyber.com:8443"],
        ["a path, not an origin", "https://worlds.example/worlds"],
        ["not a web address", "worlds.example"],
        ["another scheme", "ftp://worlds.example"],
    ])("off when the world origin is %s", (_what, world) => {
        expect(readWorldFrame(world, SITE)).toBeNull();
    });
});

describe("worldFrameRole", () => {
    test("each host has its side of the frame", () => {
        expect(worldFrameRole("worlds.example", frame)).toBe("world");
        expect(worldFrameRole("www.oncyber.com", frame)).toBe("page");
        expect(worldFrameRole("WWW.ONCYBER.COM", frame)).toBe("page");
    });

    test("another host of the deployment keeps worlds in the page", () => {
        expect(worldFrameRole("preview.example", frame)).toBeNull();
        expect(worldFrameRole(undefined, frame)).toBeNull();
    });

    test("ports tell local hosts apart", () => {
        const local = readWorldFrame(
            "http://127.0.0.1:13000",
            "http://localhost:13000"
        );
        expect(worldFrameRole("127.0.0.1:13000", local)).toBe("world");
        expect(worldFrameRole("localhost:13000", local)).toBe("page");
        expect(worldFrameRole("localhost:3000", local)).toBeNull();
    });

    test("nothing has a role while worlds are not framed", () => {
        expect(worldFrameRole("www.oncyber.com", null)).toBeNull();
    });
});

test("the page frames the same address on the world host", () => {
    expect(worldFrameUrl("/spaces/abc?coords=1x2x3x0", frame)).toBe(
        "https://worlds.example/spaces/abc?coords=1x2x3x0"
    );
    expect(worldFrameUrl("starry-night", frame)).toBe(
        "https://worlds.example/starry-night"
    );
});

test("the world keeps its own origin and cannot leave its frame", () => {
    const allowed = WORLD_SANDBOX.split(" ");
    expect(allowed).toEqual(
        expect.arrayContaining(["allow-scripts", "allow-same-origin"])
    );
    for (const escape of [
        "allow-popups",
        "allow-top-navigation",
        "allow-top-navigation-by-user-activation",
        "allow-forms",
        "allow-modals",
        "allow-downloads",
    ])
        expect(allowed).not.toContain(escape);
});

describe("the world host", () => {
    test("a person who opens it directly is sent to the site", () => {
        expect(
            answerOnWorldHost(
                {
                    path: "/spaces/abc?coords=1x2x3x0",
                    dest: "document",
                    mode: "navigate",
                },
                frame
            )
        ).toEqual({ redirect: `${SITE}/spaces/abc?coords=1x2x3x0` });
    });

    test("inside a frame it is served, for the site alone to frame", () => {
        expect(
            answerOnWorldHost(
                { path: "/spaces/abc", dest: "iframe", mode: "navigate" },
                frame
            )
        ).toEqual({ serve: true, policy: `frame-ancestors ${SITE}` });
    });

    test("the world's own requests are served", () => {
        for (const request of [
            { path: "/api/exhibit?id=abc", dest: "empty", mode: "cors" },
            // an old browser says nothing about where a request is going
            { path: "/spaces/abc", dest: null, mode: null },
            // nobody browses to an API route; it is never redirected
            { path: "/api/user/me", dest: "document", mode: "navigate" },
        ])
            expect(answerOnWorldHost(request, frame)).toMatchObject({
                serve: true,
            });
    });
});
