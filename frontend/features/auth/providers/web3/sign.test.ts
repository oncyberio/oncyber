jest.mock("@utils/auth/gnosis", () => ({ onGnosisSignEvent: jest.fn() }));

import { utils } from "ethers";
import { signEthereum } from "./sign";

test("injected wallets sign the nonce with personal_sign", async () => {
    const request = jest.fn().mockResolvedValue("0xsigned");
    const connection: any = {
        type: "ethereum",
        provider: "metamask",
        walletId: "0xabc",
        eth: { request },
    };

    await expect(
        signEthereum("0xabc", "nonce: 12", connection)
    ).resolves.toEqual({
        type: "ethereum",
        sig: "0xsigned",
    });
    expect(request).toHaveBeenCalledWith({
        method: "personal_sign",
        params: [utils.hexlify(utils.toUtf8Bytes("nonce: 12")), "0xabc"],
    });
});
