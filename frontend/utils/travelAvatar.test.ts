/** @jest-environment jsdom */
import { rememberTravelAvatar, readTravelAvatar } from "./travelAvatar";
beforeEach(() => sessionStorage.clear());
test("the loaded owned avatar survives a stale profile and same-origin destination reload", () => {
    const user = { walletId: "0xABC", settings: { vrm: "rollerpepe" } };
    rememberTravelAvatar(user, {
        id: "https://models.example/owned.vrm",
        name: "DickButt",
        url: "https://models.example/owned.vrm",
        scale: 1.2,
    });
    expect(readTravelAvatar({ ...user, walletId: "0xabc" })).toMatchObject({
        name: "DickButt",
        scale: 1.2,
    });
    expect(readTravelAvatar({ walletId: "0xother" })).toBeNull();
    expect(readTravelAvatar(null)).toBeNull();
});
test("anonymous travel works and a native picker change replaces the previous choice", () => {
    rememberTravelAvatar(null, { id: "square", url: "/square.vrm" });
    rememberTravelAvatar(null, { id: "owned", url: "/owned.vrm" });
    expect(readTravelAvatar(null)?.id).toBe("owned");
});
test("invalid storage and executable URLs never become avatar loads", () => {
    sessionStorage.setItem("oncyber:travel-avatar", "broken");
    expect(readTravelAvatar(null)).toBeNull();
    rememberTravelAvatar(null, { id: "bad", url: "javascript:alert(1)" });
    expect(readTravelAvatar(null)).toBeNull();
});
