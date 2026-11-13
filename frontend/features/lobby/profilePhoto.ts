import { useEffect, useState } from "react";
import { LOBBY_GUEST_PORTRAIT, lobbyPortraitUrl } from "./lobbyIdentity";

type ProfileFields = {
    avatar?: unknown;
    avatarContractAddress?: unknown;
    avatarTokenId?: unknown;
};

const loads = (url: string, timeoutMs = 12000) =>
    new Promise<boolean>((resolve) => {
        if (typeof Image === "undefined") return resolve(true);
        const image = new Image();
        const timer = setTimeout(() => resolve(false), timeoutMs);
        image.onload = () => {
            clearTimeout(timer);
            resolve(image.naturalWidth > 0);
        };
        image.onerror = () => {
            clearTimeout(timer);
            resolve(false);
        };
        image.src = url;
    });

const cache = new Map<string, Promise<string>>();

/** A saved profile photo can be gone from its host (unpinned CID, retired
 * CDN). When it is an NFT, ask OpenSea for the token's current image the
 * same way artworks recover; otherwise use the guest portrait. */
export function resolveProfilePhoto(
    profile: ProfileFields | undefined,
    check = loads,
    fetchMedia: typeof fetch = (input, init) => fetch(input, init)
): Promise<string> {
    const saved =
        typeof profile?.avatar === "string" &&
        /^https?:\/\//.test(profile.avatar)
            ? profile.avatar
            : "";
    const contract =
        typeof profile?.avatarContractAddress === "string"
            ? profile.avatarContractAddress.toLowerCase()
            : "";
    const token =
        profile?.avatarTokenId === undefined || profile?.avatarTokenId === null
            ? ""
            : String(profile.avatarTokenId);
    const key = `${saved}\u0000${contract}\u0000${token}`;
    if (!cache.has(key))
        cache.set(
            key,
            (async () => {
                if (saved && (await check(saved))) return saved;
                if (
                    /^0x[a-f0-9]{40}$/.test(contract) &&
                    /^\d{1,78}$/.test(token)
                )
                    try {
                        const query = new URLSearchParams({
                            chain: "ethereum",
                            contract,
                            token,
                        });
                        const response = await fetchMedia(
                            `/api/artwork-media?${query}`
                        );
                        const image = response.ok
                            ? (await response.json())?.image
                            : undefined;
                        if (
                            typeof image === "string" &&
                            image.startsWith("https://") &&
                            (await check(image))
                        )
                            return image;
                    } catch {}
                return LOBBY_GUEST_PORTRAIT;
            })()
        );
    return cache.get(key);
}

export function useProfilePhoto(profile: ProfileFields | undefined) {
    // Known-dead hosts skip straight to recovery.
    const normalized = lobbyPortraitUrl(profile?.avatar);
    const saved = normalized === LOBBY_GUEST_PORTRAIT ? "" : normalized;
    const [photo, setPhoto] = useState(saved || LOBBY_GUEST_PORTRAIT);
    const contract = profile?.avatarContractAddress;
    const token = profile?.avatarTokenId;
    useEffect(() => {
        let live = true;
        setPhoto(saved || LOBBY_GUEST_PORTRAIT);
        if (!saved && !contract) return;
        void resolveProfilePhoto({
            avatar: saved,
            avatarContractAddress: contract,
            avatarTokenId: token,
        }).then((url) => {
            if (live) setPhoto(url);
        });
        return () => {
            live = false;
        };
    }, [saved, contract, token]);
    return photo;
}
