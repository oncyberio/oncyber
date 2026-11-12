/** Resolve profile links from both current and legacy saved NFT metadata. */
export function marketplaceProfileUrl(
    address: string,
    accountBaseUrl?: string
) {
    const savedBase =
        typeof accountBaseUrl === "string" ? accountBaseUrl.trim() : "";
    const base = (savedBase || "https://opensea.io")
        .replace(/\/+$/, "")
        .replace(
            /^https?:\/\/(?:www\.)?opensea\.io(?:\/accounts?)?$/i,
            "https://opensea.io"
        )
        .replace("hicetnunc.xyz", "hicetnunc.art");

    return address ? `${base}/${encodeURIComponent(address)}` : "";
}
