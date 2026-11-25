/** @jest-environment jsdom */
import { worldPath, worldSrc } from "./worldAddress";
import { readWorldFrame } from "./worldFrame";

const frame = readWorldFrame(
    "https://worlds.example",
    "https://www.oncyber.com"
);

test("the world is loaded at the page's own address on the world host", () => {
    expect(worldSrc("/coco__bear?renderer=webgl&x=1#spot", frame)).toBe(
        "https://worlds.example/coco__bear?renderer=webgl&x=1#spot"
    );
});

test("what is in the address for the page alone stays with the page", () => {
    // an emailed sign-in link comes back to the space it was asked from
    expect(
        worldPath(
            "/coco__bear?apiKey=k&oobCode=one-time&mode=signIn&renderer=webgl"
        )
    ).toBe("/coco__bear?mode=signIn&renderer=webgl");
    for (const name of [
        "token",
        "access_token",
        "inviteId",
        "invite",
        "code",
        "sessionToken",
        "sig",
    ])
        expect(worldPath(`/spaces/abc?${name}=secret&fps=30`)).toBe(
            "/spaces/abc?fps=30"
        );
    // a sign-in answering in the fragment
    expect(worldPath("/abc#access_token=secret&state=1")).toBe("/abc");
});
