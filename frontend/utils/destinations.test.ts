import { getStatus } from "./destinations";

it.each([
    ["active", "Published"],
    ["verified", "Ready for minting"],
    ["submitted", "Under review"],
    ["tested", "Testing"],
    ["failed", "Failed"],
    ["rejected", "Rejected"],
])("names a %s destination %s", (status, label) => {
    expect(getStatus(status)).toBe(label);
});

it.each([["uploaded"], ["somethingNew"], ["constructor"], [""], [undefined]])(
    "names a destination with the unknown status %p Uploaded, not Rejected",
    (status) => {
        expect(getStatus(status)).toBe("Uploaded");
    }
);

it("keeps a published community drop at Ready for minting until it is minted", () => {
    const community = " NFT Community distribution ";
    expect(getStatus("active", community)).toBe("Ready for minting");
    expect(getStatus("active", community, false)).toBe("Ready for minting");
    expect(getStatus("active", community, true)).toBe("Published");
    expect(getStatus("active", "self_claim_tokens")).toBe("Published");
    expect(getStatus("tested", community)).toBe("Testing");
});
