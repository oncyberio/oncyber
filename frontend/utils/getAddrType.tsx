import type { WalletConnection } from "../dApp/connect";
import { base58Decode } from "./js";
// Not ./counterpartyAssets: that module carries the 319 KB xchain list.
import {
    isCounterpartyAddress,
    isValidBTCAddress,
} from "./counterpartyAddress";
import { isNiftyAddress } from "./niftyAssets";

export function getAddrType(addr: string = ""): WalletConnection["type"] {
    if (!addr) return null;
    if (isNiftyAddress(addr)) return "niftygateway";
    if (isCounterpartyAddress(addr)) return "counterparty";
    if (isEthereumAddress(addr)) return "ethereum";
    if (isTezosAddress(addr)) return "tezos";
    if (isSolanaAddress(addr)) return "solana";
    return null;
}

export function isValidAddress(addr: string) {
    return (
        isEthereumAddress(addr) ||
        isTezosAddress(addr) ||
        isSolanaAddress(addr) ||
        isValidBTCAddress(addr)
    );
}

const ETH_ADDRESS_RE = /^(0x)?[0-9a-f]{40}$/i;

export function isEthereumAddress(addr: string) {
    return ETH_ADDRESS_RE.test(addr);
}

export function isTezosAddress(addr: string) {
    if (addr.length !== 36 && !addr.startsWith("tz") && !addr.startsWith("KT"))
        return false;
    const pk = base58Decode(addr);
    return addr != null;
}

export function isSolanaAddress(addr: string) {
    const pk = base58Decode(addr);
    return pk != null && pk.length === 32;
}

export function isValidEns(name: string) {
    return isEthEns(name) || isTezosEns(name);
}

export function isEthEns(name: string) {
    return name?.endsWith(".eth");
}

export function isTezosEns(name: string) {
    return name?.endsWith(".tez");
}
