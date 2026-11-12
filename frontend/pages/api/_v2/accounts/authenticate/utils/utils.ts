const ethUtil = require("ethereumjs-util");

import { auth } from "@utils/firebaseAdmin";

import { verify } from "@utils/middlewares/authMiddleware";

import { ethers } from "ethers";

var nacl = require("tweetnacl");

const { b58cencode, hex2buf, prefix, b58cdecode } = require("@taquito/utils");

import { hash } from "@stablelib/blake2b";

import { PublicKey } from "@solana/web3.js";

import { isValidGnosisSignature } from "../../../../../../utils/auth/gnosis";

import { nodeEnv } from "@env";

import { openNonce, tezosLoginPayload } from "@utils/auth/loginNonce";

export function toHex(s) {
    let hex = "";

    for (let i = 0; i < s.length; i++) {
        hex += "" + s.charCodeAt(i).toString(16);
    }

    return `0x${hex}`;
}

export function verifySolana(sig, nonce, owner) {
    let msg = new TextEncoder().encode(nonce);
    const pubKey = new PublicKey(owner);
    return nacl.sign.detached.verify(msg, sig, pubKey.toBytes());
}

export const provider = new ethers.providers.JsonRpcProvider(nodeEnv.ETH_RPC);

const EIP1271_ABI = [
    "function isValidSignature(bytes32 _hash, bytes memory _signature) public view returns (bytes4 magicValue)",
];
const EIP1271_MAGIC_VALUE = "0x1626ba7e";

export async function isValidContractSignature(
    signature,
    nonce,
    walletAddress
) {
    try {
        const hashMessage = ethers.utils.hashMessage(nonce);
        const hashBytes = ethers.utils.arrayify(hashMessage);
        const instance = new ethers.Contract(
            walletAddress,
            EIP1271_ABI,
            provider
        );
        const result = await instance.isValidSignature(hashBytes, signature);
        return result.toLowerCase() === EIP1271_MAGIC_VALUE.toLowerCase();
    } catch (err) {
        // We catch errors because this maybe simply a normal EOA account
        console.error(err);
        return false;
    }
}

export async function verifyEth(sig, nonce, owner) {
    if (sig === "0x") {
        console.log("Detected gnosis signature");
        return isValidGnosisSignature(nonce, owner);
    }
    const data = toHex(nonce);

    const message = ethUtil.toBuffer(data);
    const msgHash = ethUtil.hashPersonalMessage(message);

    // Get the address of whoever signed this message
    const signature = ethUtil.toBuffer(sig);
    const sigParams = ethUtil.fromRpcSig(signature);
    const publicKey = ethUtil.ecrecover(
        msgHash,
        sigParams.v,
        sigParams.r,
        sigParams.s
    );
    const sender = ethUtil.publicToAddress(publicKey);
    const addr = ethUtil.bufferToHex(sender);
    if (addr === owner) return true;
    console.log("erecover failed. Checking eip1271");

    return isValidContractSignature(sig, nonce, owner);
}

const tezosPrefix = {
    ed: {
        pk: prefix["edpk"],
        sk: prefix["edsk"],
        pkh: prefix.tz1,
        sig: prefix.edsig,
    },
    p2: {
        pk: prefix["p2pk"],
        sk: prefix["p2sk"],
        pkh: prefix.tz3,
        sig: prefix.p2sig,
    },
    sp: {
        pk: prefix["sppk"],
        sk: prefix["spsk"],
        pkh: prefix.tz2,
        sig: prefix.spsig,
    },
};

const tezosAddrToCurve = {
    tz1: "ed",
    tz2: "sp",
    tz3: "p2",
};

/**
 * A Tezos login proves the address with its public key AND a signature over
 * the server nonce. Only tz1 (ed25519) is verified here; other curves fail
 * closed until they get a verifier.
 */
export async function verifyTezos(publicKey, owner, signature, nonce) {
    if (!publicKey || !signature || !nonce) return false;
    if (!publicKey.startsWith("edpk") || !owner?.startsWith("tz1")) return false;

    const key = b58cdecode(publicKey, prefix.edpk);
    if (b58cencode(hash(key, 20), prefix.tz1) !== owner) return false;

    const sig = signature.startsWith("edsig")
        ? b58cdecode(signature, prefix.edsig)
        : signature.startsWith("sig")
        ? b58cdecode(signature, prefix.sig)
        : null;
    if (!sig || sig.length !== 64) return false;

    const digest = hash(hex2buf(tezosLoginPayload(nonce)), 32);
    return nacl.sign.detached.verify(digest, sig, key);
}

export function getNonce(req) {
    const nonce = openNonce(req.cookies["nonce"]);

    if (nonce == null) {
        throw new Error("Unable to retreive signed message");
    }

    return nonce;
}

export async function validateSig({ sig, owner, req }) {
    let isValid = false;

    if (sig.type === "ethereum") {
        console.log("verify eth");

        let nonce = getNonce(req);

        isValid = await verifyEth(sig.sig, nonce, owner);

        console.log("verify eth: valid");
    } else if (sig.type === "solana") {
        let nonce = getNonce(req);

        console.log("/api/user/authenticate");

        let arrSig = new Uint8Array(sig.sig);

        console.log(owner);

        console.log(arrSig);

        isValid = verifySolana(arrSig, nonce, owner);
    } else if (sig.type === "tezos") {
        try {
            isValid = await verifyTezos(sig.publicKey, owner, sig.sig, getNonce(req));
        } catch (err) {
            console.error(err);

            throw new Error("Invalid tezos credentials");
        }
    } else if (sig.type === "web2") {
        try {
            const adminAuth = auth();

            const firebaseUser = await adminAuth.verifyIdToken(sig.sig);

            // The token must belong to the account being signed in to.
            isValid = !!firebaseUser?.uid && firebaseUser.uid === owner;
        } catch (err) {
            throw new Error("Invalid token");
        }
    } else if (sig.type === "niftygateway") {
        try {
            // An existing Oncyber token, and only for the account it names.
            const user = await verify(sig.sig);
            return typeof user === "string" && user.toLowerCase() === owner?.toLowerCase();
        } catch (err) {
            throw new Error("Invalid token");
        }
    }

    return isValid;
}
