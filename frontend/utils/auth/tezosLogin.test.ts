import nacl from "tweetnacl";
import { hash } from "@stablelib/blake2b";
const { b58cencode, prefix } = require("@taquito/utils");
import { tezosLoginPayload as clientPayload } from "@features/auth/providers/web3/sign";
import { tezosLoginPayload } from "./loginNonce";
import { verifyTezos } from "../../pages/api/_v2/accounts/authenticate/utils/utils";

jest.mock("@utils/firebaseAdmin", () => ({ auth: jest.fn(), db: {} }));

const pair = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(7));
const publicKey = b58cencode(pair.publicKey, prefix.edpk);
const owner = b58cencode(hash(pair.publicKey, 20), prefix.tz1);
const sign = (nonce: string) =>
    b58cencode(nacl.sign.detached(hash(Buffer.from(tezosLoginPayload(nonce), "hex"), 32), pair.secretKey), prefix.edsig);

test("client and server pack the login message the same way", () => {
    expect(clientPayload("abc é")).toBe(tezosLoginPayload("abc é"));
});

test("a tz1 login needs a signature over this nonce by this key", async () => {
    expect(await verifyTezos(publicKey, owner, sign("n1"), "n1")).toBe(true);
    expect(await verifyTezos(publicKey, owner, sign("n1"), "n2")).toBe(false);
    expect(await verifyTezos(publicKey, owner, undefined, "n1")).toBe(false);
    const other = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(9));
    const otherOwner = b58cencode(hash(other.publicKey, 20), prefix.tz1);
    expect(await verifyTezos(publicKey, otherOwner, sign("n1"), "n1")).toBe(false);
});
