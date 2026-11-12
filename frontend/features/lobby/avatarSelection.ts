import { readTravelAvatar } from "@utils/travelAvatar";
import catalogue from "@components/_3DExhibit-v2/three/factory/player/vrms.json";

export interface LobbyAvatarIdentity {
    settings?: { vrm?: string; default_vrm_scale?: number };
    avatarContractAddress?: string;
    walletId?: string;
    vrmUrl?: string;
    VRM?: string;
}

export interface LobbyAvatarSource {
    id: string;
    name: string;
    url: string;
    scale?: number;
}

export const DEFAULT_LOBBY_AVATAR_URL = catalogue.square.url;
const fallback: LobbyAvatarSource = {
    id: "square",
    name: "Square",
    url: DEFAULT_LOBBY_AVATAR_URL,
};

export function validScale(scale?: number) {
    return Number.isFinite(scale) && scale > 0
        ? Math.min(4, Math.max(0.2, scale))
        : 1;
}

/** Read the same saved avatar selection used by the full Oncyber player. */
export async function resolveLobbyAvatar(
    identity?: LobbyAvatarIdentity
): Promise<LobbyAvatarSource> {
    const current = readTravelAvatar(identity);
    if (current) return { ...current, name: current.name || "Avatar" };
    const scale = validScale(identity?.settings?.default_vrm_scale);
    const directUrl = identity?.vrmUrl || identity?.VRM;
    if (directUrl)
        return { id: directUrl, name: "Avatar", url: directUrl, scale };

    let id = identity?.settings?.vrm;
    if (!id || id === "square" || id === "check") {
        id =
            identity?.avatarContractAddress &&
            identity.avatarContractAddress !== "0xnotanaddress"
                ? "check"
                : "square";
        if (id === "square") return { ...fallback, scale };
    }
    const builtin = Object.values(catalogue).find((avatar) => avatar.id === id);
    if (builtin)
        return { id: builtin.id, name: builtin.name, url: builtin.url, scale };

    // Only a custom selection needs the authenticated metadata API.
    if (identity?.walletId) {
        try {
            const { default: vrms } = await import("@api/vrm/_api");
            const uploaded = await vrms.getVrm({ id });
            const selected =
                uploaded || (await vrms.getVrm({ id, type: "owned" }));
            const custom = selected as { url?: string; name?: string } | false;
            if (custom && custom.url) {
                return {
                    id,
                    name: custom.name || "Avatar",
                    url: custom.url,
                    scale,
                };
            }
        } catch {
            // A missing or unavailable saved avatar uses the native default.
        }
    }
    return { ...fallback, scale };
}
