import { resolveProfilePhoto } from "./profilePhoto";
import { LOBBY_GUEST_PORTRAIT } from "./lobbyIdentity";

const nft = {
    avatarContractAddress: "0xd774557b647330c91bf44cfeab205095f7e6c367",
    avatarTokenId: "12788",
};
const media = (image?: string) =>
    (async () => ({ ok: true, json: async () => ({ image }) })) as any;

describe("lobby profile photo", () => {
    test("keeps a saved photo that loads", async () => {
        await expect(
            resolveProfilePhoto(
                { avatar: "https://a.example/ok.png", ...nft },
                async () => true,
                media("https://b.example/nft.png")
            )
        ).resolves.toBe("https://a.example/ok.png");
    });
    test("a dead saved photo recovers the NFT's current image", async () => {
        const fetchMedia = jest.fn(media("https://b.example/nft.png"));
        await expect(
            resolveProfilePhoto(
                { avatar: "https://a.example/dead.png", ...nft },
                async (url) => !url.includes("dead"),
                fetchMedia
            )
        ).resolves.toBe("https://b.example/nft.png");
        expect(fetchMedia.mock.calls[0][0]).toContain(
            "contract=0xd774557b647330c91bf44cfeab205095f7e6c367&token=12788"
        );
    });
    test("falls back to the guest portrait when nothing loads", async () => {
        await expect(
            resolveProfilePhoto(
                { avatar: "https://a.example/gone.png" },
                async () => false,
                media()
            )
        ).resolves.toBe(LOBBY_GUEST_PORTRAIT);
    });
});
