import { accountIdentity, GUEST_IDENTITY } from "./accountIdentity";

jest.mock("@features/lobby/avatarSelection", () => ({
    DEFAULT_LOBBY_AVATAR_URL: "/avatars/square.vrm",
    resolveLobbyAvatar: jest.fn(async (account?: { vrmUrl?: string }) => {
        if (account?.vrmUrl === "broken") throw new Error("unavailable");
        return { url: account?.vrmUrl ?? "/avatars/square.vrm" };
    }),
}));

describe("accountIdentity", () => {
    test("a signed-in visitor is presented as their account", async () => {
        expect(
            await accountIdentity({
                username: "ada",
                avatar: "https://cdn.example/ada.png",
                vrmUrl: "https://cdn.example/ada.vrm",
            })
        ).toEqual({
            name: "ada",
            pfp: "https://cdn.example/ada.png",
            avatarUrl: "https://cdn.example/ada.vrm",
        });
    });

    test("no account is the guest", async () => {
        expect(await accountIdentity(null)).toEqual(GUEST_IDENTITY);
        expect(await accountIdentity(undefined)).toEqual(GUEST_IDENTITY);
    });

    test("a missing name or portrait takes the guest's", async () => {
        expect(await accountIdentity({ username: "  " })).toEqual(
            GUEST_IDENTITY
        );
    });

    test("an avatar that cannot be resolved takes the default", async () => {
        expect(
            await accountIdentity({ username: "ada", vrmUrl: "broken" })
        ).toEqual({ ...GUEST_IDENTITY, name: "ada" });
    });

    test("a long name is cut to what a frame accepts", async () => {
        const identity = await accountIdentity({ username: "a".repeat(400) });
        expect(identity.name).toHaveLength(120);
    });

    test("a field that is not a public asset never crosses", async () => {
        expect(
            await accountIdentity({
                username: "ada",
                avatar: "javascript:alert(1)",
            })
        ).toEqual(GUEST_IDENTITY);
    });
});
