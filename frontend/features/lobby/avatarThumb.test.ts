import { avatarThumb, AVATAR_THUMB_SIZE } from "./avatarThumb";

const gateway = "https://cyber.mypinata.cloud/ipfs/QmAvatar";

test("a picture on the gateway is asked for at card size, as WebP", () => {
    const url = new URL(avatarThumb(`${gateway}?filename=summer.png`));
    expect(url.origin + url.pathname).toBe(gateway);
    expect(Object.fromEntries(url.searchParams)).toEqual({
        filename: "summer.png",
        "img-width": String(AVATAR_THUMB_SIZE),
        "img-height": String(AVATAR_THUMB_SIZE),
        "img-fit": "scale-down",
        "img-format": "webp",
    });
});

test("an animated picture is made smaller but keeps its format", () => {
    const url = new URL(avatarThumb(`${gateway}?filename=dance.gif`));
    expect(url.searchParams.get("img-width")).toBe(String(AVATAR_THUMB_SIZE));
    expect(url.searchParams.has("img-format")).toBe(false);
});

test("a picture from a host that cannot resize is used as it is", () => {
    expect(avatarThumb("https://example.com/me.png")).toBe(
        "https://example.com/me.png"
    );
    expect(avatarThumb("/summer.png")).toBe("/summer.png");
    expect(avatarThumb("")).toBeUndefined();
    expect(avatarThumb(undefined)).toBeUndefined();
});
