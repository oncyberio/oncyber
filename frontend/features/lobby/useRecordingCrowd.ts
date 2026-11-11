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

async function resolveWallet(wallet: string) {
    if (/^0x[0-9a-f]{40}$/i.test(wallet)) return wallet;
    const { ethers } = await import("ethers");
    const provider = new ethers.providers.JsonRpcProvider(nodeEnv.ETH_RPC);
    return (await provider.resolveName(wallet)) || undefined;
}

/** Avatars the listed wallets hold, for dressing the recording crowd. */
function useWalletAvatars(wallets: readonly string[]) {
    const [items, setItems] = useState<LobbyAvatarChoice[]>([]);
    const key = wallets.join(",");
    useEffect(() => {
        if (!key) return;
        let cancelled = false;
        const active = () => !cancelled;
        const found: LobbyAvatarChoice[] = [];
        const append = (more: LobbyAvatarChoice[]) => {
            found.push(...more);
            if (active()) setItems([...found]);
        };
        for (const wallet of key.split(","))
            void resolveWallet(wallet)
                .then((address) => {
                    if (!address || !active()) return;
                    return Promise.allSettled([
                        discoverWalletAvatars("eth", address, append, active),
                        discoverWalletAvatars(
                            "polygon",
                            address,
                            append,
                            active
                        ),
                    ]);
                })
                .catch((error) =>
                    console.warn(
                        "[recording crowd] wallet avatars",
                        wallet,
                        error
                    )
                );
        return () => {
            cancelled = true;
        };
    }, [key]);
    return items;
}

/**
 * The staged crowd for `?crowd=N`, or null. Read after mount so the server
 * render and the first client render agree.
 */
export default function useRecordingCrowd(
    signedInOwned: readonly LobbyAvatarChoice[]
): { options: RecordingCrowdOptions; crowd: RecordingCrowd } | null {
    const [options, setOptions] = useState<RecordingCrowdOptions | null>(null);
    useEffect(() => setOptions(readRecordingCrowd()), []);
    const walletOwned = useWalletAvatars(options?.wallets || []);
    const avatars = useMemo(() => {
        if (!options) return [];
        const catalogue = Object.values(VRMS) as {
            id: string;
            url: string;
            image?: string;
        }[];
        const chosen = options.avatarIds.length
            ? catalogue.filter((item) => options.avatarIds.includes(item.id))
            : catalogue.slice(0, DEFAULT_CROWD_AVATARS);
        const owned: CrowdAvatar[] = [...walletOwned, ...signedInOwned].map(
            (item) => ({ url: item.url, image: item.img })
        );
        return mixCrowdAvatars(
            owned,
            chosen.map((item) => ({ url: item.url, image: item.image }))
        );
    }, [options, walletOwned, signedInOwned]);
    const avatarKey = avatars.map((item) => item.url).join("|");
    const crowd = useMemo(
        () => (options ? createRecordingCrowd(options, avatars) : null),
        // Re-dress the crowd only when the set of avatars actually changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [options, avatarKey]
    );
    return options && crowd ? { options, crowd } : null;
}
