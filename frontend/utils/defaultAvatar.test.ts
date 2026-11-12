import { defaultAvatarId } from "./defaultAvatar";

describe("defaultAvatarId", () => {
    it("gives signed-out visitors Summer", () => {
        expect(defaultAvatarId(null)).toBe("sunshine");
        expect(defaultAvatarId(undefined)).toBe("sunshine");
        expect(defaultAvatarId({})).toBe("sunshine");
    });

    it("treats the anonymous studio draft as signed out", () => {
        expect(defaultAvatarId({ walletId: "anon" })).toBe("sunshine");
    });

    it("gives signed-in users their pfp avatar", () => {
        expect(defaultAvatarId({ walletId: "0xabc" })).toBe("square");
        expect(
            defaultAvatarId({
                walletId: "0xabc",
                avatarContractAddress: "0xnotanaddress",
            })
        ).toBe("square");
        expect(
            defaultAvatarId({
                walletId: "0xabc",
                avatarContractAddress: "0xnft",
            })
        ).toBe("check");
    });
});
