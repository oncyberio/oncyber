import { LOBBY_GUEST_PORTRAIT, lobbyPortraitUrl } from "./lobbyIdentity";

describe("lobbyPortraitUrl", () => {
    it("uses the guest portrait when there is no picture", () => {
        expect(lobbyPortraitUrl(undefined)).toBe(LOBBY_GUEST_PORTRAIT);
        expect(lobbyPortraitUrl("")).toBe(LOBBY_GUEST_PORTRAIT);
        expect(lobbyPortraitUrl("  ")).toBe(LOBBY_GUEST_PORTRAIT);
        expect(lobbyPortraitUrl({})).toBe(LOBBY_GUEST_PORTRAIT);
    });

    it("uses the guest portrait for the dead Cloudinary accounts", () => {
        for (const account of ["oncyber-io", "oncybertesting", "ugc-oo-oo"])
            expect(
                lobbyPortraitUrl(
                    `https://res.cloudinary.com/${account}/image/upload/v1/a.png`
                )
            ).toBe(LOBBY_GUEST_PORTRAIT);
    });

    it("keeps a live picture", () => {
        const url = "https://cyber.mypinata.cloud/ipfs/Qm123?filename=me.png";
        expect(lobbyPortraitUrl(url)).toBe(url);
    });
});
