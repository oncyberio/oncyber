import type { providers } from "ethers";
import { nodeEnv } from "@env";

import GNOSIS_ABI from "./gnosis_abi.json";

// ethers loads, and the provider is created, on first use. Both used to
// happen at import time, which sent eth_chainId to ETH_RPC (and shipped all
// of ethers) on every page that loaded the sign-in code.
type Ethers = typeof import("ethers").ethers;

let provider: providers.JsonRpcProvider = null;

async function loadEthers(): Promise<Ethers> {
    const { ethers } = await import("ethers");

    return ethers;
}

function getProvider(ethers: Ethers) {
    if (provider == null) {
        provider = new ethers.providers.JsonRpcProvider(nodeEnv.ETH_RPC);
    }

    return provider;
}

const MAGIC_VALUE = "0x1626ba7e";

function hashMessage(ethers: Ethers, message: string) {
    const prependedMessage = `\x19Ethereum Signed Message:\n${message.length}${message}`;
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(prependedMessage));
}

export async function isValidGnosisSignature(
    message: string,
    walletAddress: string
) {
    try {
        const ethers = await loadEthers();
        const instance = new ethers.Contract(
            walletAddress,
            GNOSIS_ABI,
            getProvider(ethers)
        );
        const messageHash = hashMessage(ethers, message);
        const magicValue = await instance.isValidSignature(messageHash, "0x");
        return magicValue === MAGIC_VALUE;
    } catch (err) {
        // We catch errors because this maybe simply a normal EOA account
        console.error(err);
        return false;
    }
}

export async function onGnosisSignEvent(walletId: string, message: string) {
    const ethers = await loadEthers();

    const instance = new ethers.Contract(
        walletId,
        GNOSIS_ABI,
        getProvider(ethers)
    );

    const messageHash = hashMessage(ethers, message);

    try {
        const listener = new Promise((resolve) => {
            instance.on("SignMsg", async (msgHash) => {
                // Upon detecting the SignMsg event, validate that the contract signed the message
                const magicValue = await instance.isValidSignature(
                    messageHash,
                    "0x"
                );
                const messageWasSigned = magicValue === MAGIC_VALUE;

                if (messageWasSigned) {
                    resolve(msgHash);
                }
            });
        });

        await listener;
    } finally {
        instance.removeAllListeners();
    }
}
