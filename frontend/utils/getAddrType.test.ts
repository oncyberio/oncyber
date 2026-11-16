jest.mock("./counterpartyAddress", () => ({
    isCounterpartyAddress: (addr: string) => addr.endsWith("@counterparty"),
    isValidBTCAddress: () => false,
}));

import { getAddrType } from "./getAddrType";

describe("getAddrType", () => {
    it("reads chain addresses", () => {
        expect(getAddrType("0x76db02500f7631d57bc2dcdca9d4cf782b99e119")).toBe(
            "ethereum"
        );
        expect(getAddrType("tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb")).toBe(
            "tezos"
        );
        expect(getAddrType("someone@counterparty")).toBe("counterparty");
    });

    it.each([
        "artist@niftygateway",
        // 36 characters: once read as a Tezos address by length alone.
        "abcdefghijklmnopqrstuvw@niftygateway",
        "name@example",
    ])("names no wallet for account ids with @: %s", (id) => {
        expect(getAddrType(id)).toBeNull();
    });
});
