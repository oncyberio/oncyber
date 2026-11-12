import type { AssetAccount, FetchedAsset } from "../../@types/Asset";

function accountId(account?: AssetAccount) {
    const address = account?.address?.trim();
    return address?.startsWith("0x") ? address.toLowerCase() : address;
}

function presentFields<T extends object>(value?: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(value || {}).filter(
            ([, field]) => field != null && field !== ""
        )
    ) as Partial<T>;
}

function mergeAccount(saved?: AssetAccount, refreshed?: AssetAccount) {
    if (!accountId(refreshed)) return saved;
    // Never attach the previous owner's name/avatar to a different address.
    if (accountId(saved) !== accountId(refreshed)) return refreshed;
    return {
        ...saved,
        ...presentFields(refreshed),
        user: { ...saved?.user, ...presentFields(refreshed?.user) },
    };
}

/** Metadata-only responses omit attribution; omission is not an ownership change. */
export function mergeArtworkMetadata<T extends FetchedAsset>(
    saved: T,
    refreshed: FetchedAsset
): T {
    const ownerChanged =
        !!accountId(refreshed.owner) &&
        accountId(refreshed.owner) !== accountId(saved.owner);
    return {
        ...saved,
        ...refreshed,
        owner: mergeAccount(saved.owner, refreshed.owner),
        creator: mergeAccount(saved.creator, refreshed.creator),
        ownerships:
            refreshed.ownerships ??
            (ownerChanged ? undefined : saved.ownerships),
        supply: refreshed.supply ?? saved.supply,
    };
}
