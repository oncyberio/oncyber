/** Must match the backend artist index's compact Unicode name normalization. */
export function artistQueryKey(value: string) {
    return Array.from(value.trim())
        .slice(0, 160)
        .join("")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, "");
}
export function matchesArtistNames(
    names: string[] = [],
    addresses: string[] = [],
    query: string
) {
    const key = artistQueryKey(query);
    if (!key) return false;
    return (
        (Array.isArray(names) ? names : [])
            .filter((name) => typeof name === "string")
            .some(
                (name) =>
                    artistQueryKey(name).startsWith(key) ||
                    name
                        .split(/[^\p{L}\p{N}]+/u)
                        .some((word) => artistQueryKey(word).startsWith(key))
            ) ||
        (Array.isArray(addresses) ? addresses : []).some(
            (address) =>
                typeof address === "string" &&
                (/^0x/i.test(address)
                    ? address.toLowerCase() === query.trim().toLowerCase()
                    : address === query.trim())
        )
    );
}
