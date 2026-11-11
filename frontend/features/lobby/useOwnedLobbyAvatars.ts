import { useEffect, useState } from "react";
import type { LobbyAvatarChoice } from "./AvatarCarousel";

const mediaUrl = (value: unknown) => {
    if (typeof value !== "string") return undefined;
    const url = value.replace(/^ipfs:\/\/(?:ipfs\/)?/, "https://cyber.mypinata.cloud/ipfs/");
    return /^https?:\/\//i.test(url) ? url : undefined;
};

export function ownedAvatarChoice(value: any): LobbyAvatarChoice | undefined {
    const metadata = value?.metadata || value;
    const raw = metadata?.url || metadata?.vrm || metadata?.vrm_url ||
        metadata?.assets?.find((asset) => asset.media_type === "model")?.files?.find((file) => file.file_type === "model/vrm")?.url ||
        (/\.vrm(?:$|[?#])/i.test(metadata?.asset || "") ? metadata.asset : undefined);
    const url = mediaUrl(raw);
    if (!url) return undefined;
    return { id: value.id || url, url, name: metadata.name || "Your avatar", img: mediaUrl(metadata.image || metadata.image_url), owned: true };
}

export function ownedFirst(owned: LobbyAvatarChoice[], catalog: LobbyAvatarChoice[]) {
    const ids = new Set<string>(), urls = new Set<string>();
    return [...owned, ...catalog].filter((item) => {
        if (ids.has(item.id) || urls.has(item.url)) return false;
        ids.add(item.id);
        urls.add(item.url);
        return true;
    });
}

/** Every VRM a wallet holds on one chain, page by page, until `active()` turns false. */
export async function discoverWalletAvatars(
    chain: "eth" | "polygon",
    wallet: string,
    append: (items: LobbyAvatarChoice[]) => void,
    active: () => boolean = () => true
) {
    const [{ getVrmNftClient }, { default: partners }] = await Promise.all([import("@utils/vrmNftClient"), import("@utils/vrmPartners")]);
    const client = await getVrmNftClient(chain);
    const seen = new Set<string>();
    let pageKey: string | undefined;
    do {
        if (!active()) return;
        const page = await client.alchemy.getNfts({ owner: wallet, withMetadata: true, ...(pageKey ? { pageKey } : {}) });
        if (!active()) return;
        append((page.ownedNfts || []).map((item) => {
            const partner = partners[item.contract?.address?.toLowerCase()]?.(item);
            // NFT ids are objects; use the model URL for a stable choice id.
            return ownedAvatarChoice({ metadata: (partner || item).metadata });
        }).filter(Boolean));
        pageKey = page.pageKey;
        if (seen.has(pageKey)) break;
        seen.add(pageKey);
    } while (pageKey);
}

/** Use the same authenticated uploads and NFT metadata sources as the world picker. */
export default function useOwnedLobbyAvatars(accountKey: string, wallets: string[], open: boolean) {
    const [state, setState] = useState<{ key: string; items: LobbyAvatarChoice[]; loading: boolean; error: string }>({ key: "", items: [], loading: false, error: "" });
    const walletKey = wallets.filter((wallet) => /^0x[0-9a-f]{40}$/i.test(wallet)).join(",");
    const key = accountKey ? `${accountKey}:${walletKey}` : "";
    useEffect(() => {
        if (!open || !key) return;
        let cancelled = false;
        const active = () => !cancelled;
        setState((previous) => ({ key, items: previous.key === key ? previous.items : [], loading: true, error: "" }));
        const append = (items: LobbyAvatarChoice[]) => {
            if (active()) setState((previous) => ({ ...previous, items: ownedFirst(previous.items, items) }));
        };
        const uploaded = async () => {
            const { default: api } = await import("@api/vrm/_api");
            const entries = await api.getVrms({});
            append((entries || []).map(ownedAvatarChoice).filter(Boolean));
        };
        const discover = (chain: "eth" | "polygon", wallet: string) =>
            discoverWalletAvatars(chain, wallet, append, active);
        void Promise.allSettled([uploaded(), ...walletKey.split(",").filter(Boolean).flatMap((wallet) => [discover("eth", wallet), discover("polygon", wallet)])]).then((results) => {
            if (active()) setState((previous) => ({ ...previous, loading: false, error: results.some((result) => result.status === "rejected") ? "Some owned avatars couldn’t load. Reopen to retry." : "" }));
        });
        return () => { cancelled = true; };
    }, [key, walletKey, open]);
    return state.key === key && key ? state : { items: [], loading: false, error: "" };
}
