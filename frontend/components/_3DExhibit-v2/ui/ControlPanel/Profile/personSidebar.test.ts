import { visitorInWorld, visitorProfile } from "./personSidebar";

const wallet = "0x1234567890abcdef1234567890abcdef12345678";

test("the sidebar opens on the username when there is one", () => {
    expect(
        visitorProfile({
            userId: "u1",
            userData: { walletId: wallet, username: "rayan", avatar: "a.png" },
        })
    ).toEqual({ id: "rayan", name: "@rayan", avatar: "a.png" });
});

test("a visitor without a username opens on their wallet", () => {
    expect(
        visitorProfile({
            userId: "u1",
            userData: { walletId: wallet, username: wallet },
        })
    ).toEqual({ id: wallet, name: "0x1234…5678", avatar: undefined });
});

test("nobody selected opens nothing", () => {
    expect(visitorProfile({})).toBeNull();
    expect(visitorProfile(undefined)).toBeNull();
});

test("teleport needs the person to be in this world, and not be you", () => {
    const present = [
        { userId: "u1", sessionId: "s1" },
        { userId: "u2", sessionId: "s2" },
    ];
    expect(visitorInWorld({ userId: "u2" }, present, "u1")).toEqual(present[1]);
    expect(visitorInWorld({ userId: "u1" }, present, "u1")).toBeNull();
    expect(visitorInWorld({ userId: "u3" }, present, "u1")).toBeNull();
    expect(visitorInWorld({}, present, "u1")).toBeNull();
});
