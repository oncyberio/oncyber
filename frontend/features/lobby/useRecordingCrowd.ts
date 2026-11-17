import { useEffect, useMemo, useState } from "react";
import VRMS from "@components/_3DExhibit-v2/three/factory/player/vrms.json";
import { nodeEnv } from "@env";
import type { LobbyAvatarChoice } from "./AvatarCarousel";
import { discoverWalletAvatars } from "./useOwnedLobbyAvatars";
import {
    createRecordingCrowd,
    mixCrowdAvatars,
    readRecordingCrowd,
    type CrowdAvatar,
    type RecordingCrowd,
    type RecordingCrowdOptions,
} from "./recordingCrowd";

// The first avatars in the picker, which most visitors wear.
const DEFAULT_CROWD_AVATARS = 10;
// Enough owned avatars to mix in; stop paging wallets after that.
const OWNED_CROWD_AVATARS = 10;
// Don't hold the crowd back forever for a slow wallet lookup.
const GATHER_TIMEOUT_MS = 8000;

async function resolveWallet(wallet: string) {
    if (/^0x[0-9a-f]{40}$/i.test(wallet)) return wallet;
    const { ethers } = await import("ethers");
    const provider = new ethers.providers.JsonRpcProvider(nodeEnv.ETH_RPC);
    return (await provider.resolveName(wallet)) || undefined;
}

async function walletAvatars(wallets: readonly string[]) {
    const found = new Map<string, CrowdAvatar>();
    const enough = () => found.size >= OWNED_CROWD_AVATARS;
    const append = (more: LobbyAvatarChoice[]) => {
        for (const item of more)
            if (!enough() && !found.has(item.url))
                found.set(item.url, { url: item.url, image: item.img });
    };
    const discovery = Promise.allSettled(
        wallets.map(async (wallet) => {
            const address = await resolveWallet(wallet);
            if (!address) return;
            // Ethereum first: that's where most of a collector's avatars are.
            await discoverWalletAvatars(
                "eth",
                address,
                append,
                () => !enough()
            );
            await discoverWalletAvatars(
                "polygon",
                address,
                append,
                () => !enough()
            );
        })
    );
    await Promise.race([
        discovery,
        new Promise((resolve) => setTimeout(resolve, GATHER_TIMEOUT_MS)),
    ]);
    return [...found.values()];
}

/** Warm the network cache so the lobby only has to parse each model. */
function prefetch(avatars: readonly CrowdAvatar[]) {
    for (const { url } of avatars)
        void Promise.resolve()
            .then(() => fetch(url, { priority: "low" } as RequestInit))
            .catch(() => {});
}

function catalogueAvatars(options: RecordingCrowdOptions): CrowdAvatar[] {
    const catalogue = Object.values(VRMS) as {
        id: string;
        url: string;
        image?: string;
    }[];
    const chosen = options.avatarIds.length
        ? catalogue.filter((item) => options.avatarIds.includes(item.id))
        : catalogue.slice(0, DEFAULT_CROWD_AVATARS);
    return chosen.map((item) => ({ url: item.url, image: item.image }));
}

// One wardrobe per page visit: leaving the lobby and jumping in again shows
// the same people in the same avatars, with nothing to look up again.
const wardrobes = new Map<string, Promise<CrowdAvatar[]>>();

/**
 * The crowd's avatars, settled once. A crowd re-dressed while avatars trickle
 * in would reload every model each time, which is what made entry stutter.
 * Called from the landing page too, so the lookup and downloads start before
 * Jump in.
 */
export function prepareRecordingWardrobe(
    options: RecordingCrowdOptions
): Promise<CrowdAvatar[]> {
    const key = JSON.stringify([options.wallets, options.avatarIds]);
    let wardrobe = wardrobes.get(key);
    if (!wardrobe) {
        wardrobe = (
            options.wallets.length
                ? walletAvatars(options.wallets)
                : Promise.resolve([])
        )
            .catch(() => [] as CrowdAvatar[])
            .then((owned) => {
                const avatars = mixCrowdAvatars(
                    owned,
                    catalogueAvatars(options)
                );
                prefetch(avatars);
                return avatars;
            });
        wardrobes.set(key, wardrobe);
    }
    return wardrobe;
}

/**
 * The staged crowd for `?crowd=N`, or null. Read after mount so the server
 * render and the first client render agree. The crowd appears once its
 * avatars are settled, and never changes clothes afterwards.
 */
export default function useRecordingCrowd(): {
    options: RecordingCrowdOptions;
    crowd: RecordingCrowd;
} | null {
    const [options, setOptions] = useState<RecordingCrowdOptions | null>(null);
    const [avatars, setAvatars] = useState<CrowdAvatar[] | null>(null);
    useEffect(() => {
        const read = readRecordingCrowd();
        setOptions(read);
        if (!read) return;
        let cancelled = false;
        void prepareRecordingWardrobe(read).then((list) => {
            if (!cancelled) setAvatars(list);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    const crowd = useMemo(
        () =>
            options && avatars ? createRecordingCrowd(options, avatars) : null,
        [options, avatars]
    );
    // One object for the crowd's whole life: effects depend on it, and a new
    // one each render makes them run forever.
    return useMemo(
        () => (options && crowd ? { options, crowd } : null),
        [options, crowd]
    );
}
