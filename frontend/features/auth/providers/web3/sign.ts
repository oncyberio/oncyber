import type { EthereumConnection, SolanaWallet } from "@dapp/connect";
import { onGnosisSignEvent } from "@utils/auth/gnosis";
import { delay } from "@utils/js";

export type Signature =
    | {
          type: "ethereum";
          sig: string;
      }
    | {
          type: "solana";
          sig: number[];
      }
    | {
          type: "tezos";
          publicKey: string;
          sig: string;
      };

function toHex(s) {
    var hex = "";
    for (var i = 0; i < s.length; i++) {
        hex += "" + s.charCodeAt(i).toString(16);
    }
    return `0x${hex}`;
}

export async function signEthereum(
    walletId: string,
    nonce: string,
    connection: EthereumConnection
): Promise<Signature> {
    //
    let sig = null;

    if (connection.provider === "wallet_connect") {
        //
        sig = await connection.eth.signMessage({
            message: nonce,
            account: connection.walletId,
        });
    } else {
        //
        const { utils } = await import("ethers");

        sig = await connection.eth.request({
            method: "personal_sign",
            params: [utils.hexlify(utils.toUtf8Bytes(nonce)), walletId],
        });
    }

    if (sig == "0x") {
        await onGnosisSignEvent(walletId, nonce);
    }

    return {
        type: "ethereum",
        sig,
    };
}

export async function signSolana(
    walletId: string,
    nonce: string,
    wallet: SolanaWallet
): Promise<Signature> {
    const msg = new TextEncoder().encode(nonce);

    const signedMessage = await wallet.signMessage(msg, "utf8");

    const buffer = Array.from(signedMessage.values());

    console.log(signedMessage);

    return {
        type: "solana",
        sig: buffer,
    };
}

/** Same packing as the server's tezosLoginPayload (utils/auth/loginNonce). */
export function tezosLoginPayload(nonce: string) {
    const bytes = new TextEncoder().encode(`Tezos Signed Message: ${nonce}`);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `0501${bytes.length.toString(16).padStart(8, "0")}${hex}`;
}
