import { spaceShareImage } from "./spaceShareImage";

const space = (info: Record<string, string>) => ({ id: "abc", info } as any);

describe("spaceShareImage", () => {
    it("uses the space's hero image", () => {
        expect(
            spaceShareImage(
                space({ heroImg: "https://cyber.mypinata.cloud/ipfs/hero" })
            )
        ).toBe("https://cyber.mypinata.cloud/ipfs/hero");
    });

    it("skips images on the old Cloudinary accounts", () => {
        expect(
            spaceShareImage(
                space({
                    heroImg:
                        "https://res.cloudinary.com/oncyber-io/image/upload/v1/hero.jpg",
                    cHeroImg: "https://cyber.mypinata.cloud/ipfs/compressed",
                })
            )
        ).toBe("https://cyber.mypinata.cloud/ipfs/compressed");
    });

    it("falls back to the room's image, then the site's share card", () => {
        expect(
            spaceShareImage(space({}), {
                image: "https://example.org/room.png",
            })
        ).toBe("https://example.org/room.png");
        expect(
            spaceShareImage(
                space({ heroImg: "https://res.cloudinary.com/ugc-oo-oo/x.png" })
            )
        ).toBe("https://www.oncyber.com/brand/share-card.png");
    });
});
