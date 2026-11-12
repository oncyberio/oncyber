import { useCallback, useEffect, useRef, useState } from "react";
import { relay, resize } from "@utils/urlUtils";
import {
    readFlashArtwork,
    type FlashArtwork,
} from "../../../multiplayer/protocol/lobby-flash.js";

export type { FlashArtwork } from "../../../multiplayer/protocol/lobby-flash.js";

type Cursor = string | number;
interface CollectionState {
    wallet: string;
    items: FlashArtwork[];
    loading: boolean;
    error: string;
    next: Cursor | null;
    failedCursor: Cursor;
}
const EMPTY: CollectionState = {
    wallet: "",
    items: [],
    loading: false,
    error: "",
    next: null,
    failedCursor: 0,
};

/** Only wallets supplied by the authenticated account can enter the picker. */
export function flashWallets(account: {
    defaultWallet?: string;
    linkedWallets?: string[];
    userData?: {
        id?: string;
        type?: string;
        walletId?: string;
        linkedAccounts?: any[];
    };
}): string[] {
    const current = account.userData;
    const hasIdentity = typeof current?.id === "string" && !!current.id;
    const accountLinks = (current?.linkedAccounts || [])
        .filter((entry) => entry.type === "web3")
        .map((entry) => entry.originalWalletId || entry.id);
    // UserContext caches defaultWallet/linkedWallets independently of the user
    // ID. Once current identity data exists, never mix a previous account's
    // cached wallets into its collection (including an empty web2 wallet list).
    const linked = hasIdentity
        ? accountLinks
        : [...(account.linkedWallets || []), ...accountLinks];
    const candidates = hasIdentity
        ? [current.type !== "web2" ? current.id : null, ...linked]
        : [
              current?.type !== "web2" || linked.includes(account.defaultWallet)
                  ? account.defaultWallet
                  : null,
              ...linked,
              current?.type !== "web2" ? current?.walletId : null,
          ];
    const seen = new Set<string>();
    return candidates.filter((wallet): wallet is string => {
        if (
            typeof wallet !== "string" ||
            !/^(?:0x[0-9a-f]{40}|(?:tz[1-4]|KT1)[1-9A-HJ-NP-Za-km-z]{33}|[1-9A-HJ-NP-Za-km-z]{32,44}|[^\s@]{1,100}@(niftygateway|counterparty))$/i.test(
                wallet
            )
        )
            return false;
        const key = /^0x/i.test(wallet) ? wallet.toLowerCase() : wallet;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function posterUrl(value: unknown): string | null {
    if (typeof value !== "string" || !value || value.length > 2048) return null;
    let source = value.trim();
    if (source.startsWith("ipfs://"))
        source = `https://ipfs.io/ipfs/${source
            .slice(7)
            .replace(/^ipfs\//, "")}`;
    try {
        const url = new URL(source);
        if (
            !["https:", "http:"].includes(url.protocol) ||
            url.username ||
            url.password ||
            /\.(?:mp4|webm|mov|mp3|wav|glb|gltf|html?)(?:$|[?#])/i.test(source)
        )
            return null;
        // The grid and Three texture use the same CORS-safe, cached image.
        const image = relay(resize(url.href, 1024));
        return image.length <= 4096 ? image : null;
    } catch {
        return null;
    }
}

/** Retain images/posters, never instantiate NFT video, HTML, or model content. */
export function flashArtworkFromAsset(asset: any): FlashArtwork | null {
    if (!asset || typeof asset !== "object") return null;
    const imageUrl = [
        asset.dcompressed_image_url,
        asset.compressed_image_url,
        asset.display_image_url,
        asset.image_preview_url,
        asset.image_url,
        asset.image_original_preview_url,
        asset.image_original_url,
    ]
        .map(posterUrl)
        .find(Boolean);
    const contract =
        asset.asset_contract?.address ||
        asset.contract_address ||
        asset.contract;
    const token = asset.token_id ?? asset.identifier ?? asset.id;
    if (!imageUrl || token == null || typeof token === "object") return null;
    const chain =
        asset.source?.blockchain ||
        asset.blockchain ||
        asset.marketplace ||
        "nft";
    const id = `${chain}:${contract || "token"}:${token}`;
    const title =
        typeof asset.name === "string" && asset.name.trim()
            ? asset.name.trim().slice(0, 160)
            : `NFT #${String(token).slice(0, 140)}`;
    const width = Number(asset.image_width || asset.width);
    const height = Number(asset.image_height || asset.height);
    return readFlashArtwork({
        id,
        title,
        imageUrl,
        ...(width > 0 && height > 0 ? { aspect: width / height } : {}),
    });
}

/** Request further pages explicitly; legacy providers may also paginate internally. */
export default function useFlashNfts(wallet: string, enabled = true) {
    const [state, setState] = useState<CollectionState>(EMPTY);
    const generation = useRef(0);
    const busy = useRef<number | null>(null);
    const load = useCallback(
        async (cursor: Cursor, replace: boolean, owner: number) => {
            if (!enabled || !wallet || busy.current === owner) return;
            busy.current = owner;
            setState((previous) => ({
                ...(replace || previous.wallet !== wallet ? EMPTY : previous),
                wallet,
                loading: true,
                error: "",
                failedCursor: cursor,
            }));
            let timeout: ReturnType<typeof setTimeout>;
            try {
                const request = import("@utils/fetchAssets").then(
                    ({ fetchOwnedAssets }) =>
                        // Use the actual linked wallet, without Studio's legacy demo aliases.
                        fetchOwnedAssets(wallet, cursor)
                );
                const result = await Promise.race([
                    request,
                    new Promise<never>((_, reject) => {
                        timeout = setTimeout(
                            () => reject(new Error("timeout")),
                            20000
                        );
                    }),
                ]);
                if (generation.current !== owner) return;
                if (result?.hasError || !Array.isArray(result?.assets))
                    throw new Error("collection unavailable");
                const incoming = result.assets
                    .map(flashArtworkFromAsset)
                    .filter(Boolean) as FlashArtwork[];
                const next =
                    typeof result.hasMore === "string" && result.hasMore
                        ? result.hasMore
                        : result.hasMore
                        ? (typeof cursor === "number" ? cursor : 0) + 1
                        : null;
                setState((previous) => ({
                    ...previous,
                    items: [
                        ...new Map(
                            [
                                ...(replace ? [] : previous.items),
                                ...incoming,
                            ].map((item) => [item.id, item])
                        ).values(),
                    ],
                    loading: false,
                    next: next === cursor ? null : next,
                    error: "",
                }));
            } catch {
                if (generation.current === owner)
                    setState((previous) => ({
                        ...previous,
                        loading: false,
                        error: "Your NFTs couldn’t load. Please try again.",
                    }));
            } finally {
                clearTimeout(timeout);
                if (busy.current === owner) busy.current = null;
            }
        },
        [enabled, wallet]
    );

    useEffect(() => {
        const owner = ++generation.current;
        busy.current = null;
        if (enabled && wallet) void load(0, true, owner);
        else setState(EMPTY);
        return () => {
            // Existing providers do not accept AbortSignal. Ignore late responses
            // after closing, changing wallet, or signing out instead.
            if (generation.current === owner) generation.current++;
        };
    }, [enabled, wallet, load]);

    const visible = enabled && state.wallet === wallet ? state : EMPTY;
    return {
        items: visible.items,
        loading:
            visible.loading || (enabled && !!wallet && state.wallet !== wallet),
        error: visible.error,
        hasMore: visible.next !== null,
        loadMore: () => {
            if (visible.next !== null)
                void load(visible.next, false, generation.current);
        },
        retry: () =>
            void load(
                visible.failedCursor,
                visible.items.length === 0,
                generation.current
            ),
    };
}
