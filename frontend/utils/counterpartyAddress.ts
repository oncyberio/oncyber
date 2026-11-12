import { base58Decode } from "./js";

// Counterparty address checks, kept apart from counterpartyAssets.ts (and its
// 319 KB xchain project list) because getAddrType runs on every page.
// counterpartyAssets.ts re-exports these names.

export const COUNTERPARTY_NS = "@counterparty";

export function isCounterpartyAddress(walletId: string) {
    return walletId?.endsWith(COUNTERPARTY_NS);
}

export function isValidBTCAddress(address: string) {
    // lightweight validation : check only if it's a correct base58 chain and has a correct length
    // Alt we can do a full validation here by checking the checksum in the last 4 bytes matches
    // the 21 first bytes
    const dec = base58Decode(address);
    return dec != null && dec.length === 25;
}
