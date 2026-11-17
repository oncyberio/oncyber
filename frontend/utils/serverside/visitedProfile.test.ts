import { findProfile, profileLobbyHref, publicProfile } from "./visitedProfile";

const rayan = {
    id: "0xabc",
    username: "rayan",
    avatar: "/a.png",
    email: "private@example.com",
    linkedAccounts: [{ id: "x" }],
};

it("links a profile to the lobby with its sidebar open", () => {
    expect(profileLobbyHref("@rayan")).toBe("/?lobby=1&profile=rayan");
    expect(profileLobbyHref("a b")).toBe("/?lobby=1&profile=a%20b");
});

it("keeps only the public fields of an account", () => {
    expect(publicProfile(rayan)).toEqual({
        id: "0xabc",
        username: "rayan",
        walletId: "0xabc",
        avatar: "/a.png",
    });
    expect(publicProfile(null)).toBeNull();
});

it("finds an account by username, then by wallet address", async () => {
    const byUsername = jest.fn(async (name) =>
        name === "rayan" ? rayan : null
    );
    const byWallet = jest.fn(async (id) => (id === "0xabc" ? rayan : null));
    expect((await findProfile("@rayan", byUsername, byWallet)).id).toBe(
        "0xabc"
    );
    expect((await findProfile("@0xABC", byUsername, byWallet)).id).toBe(
        "0xabc"
    );
    expect(byWallet).toHaveBeenLastCalledWith("0xabc");
    expect(await findProfile("@nobody", byUsername, byWallet)).toBeNull();
    expect(await findProfile(["x"], byUsername, byWallet)).toBeNull();
    expect(await findProfile("@", byUsername, byWallet)).toBeNull();
});

it("leaves out missing fields, so page props serialize", () => {
    const profile = publicProfile({ id: "0xabc" });
    expect(profile).toEqual({ id: "0xabc", walletId: "0xabc" });
    expect(Object.values(profile)).not.toContain(undefined);
});
