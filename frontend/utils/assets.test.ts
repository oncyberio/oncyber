import { selectUserId } from "./assets";
it("lets guest Studio render without a connected wallet", () => {
    expect(selectUserId(null)).toBe("");
    expect(selectUserId(undefined)).toBe("");
    expect(selectUserId("")).toBe("");
});
it("preserves ordinary wallet IDs and existing curated-wallet aliases", () => {
    expect(selectUserId("0xAbCd")).toBe("0xAbCd");
    expect(selectUserId("0xF3860788D1597CECF938424BAABE976FAC87DC26")).toBe(
        "0xC896866E927e6F8a416Ba209976115E79fA0a66F"
    );
});
