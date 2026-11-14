import type { LobbyAvatarChoice } from "@features/lobby/AvatarCarousel";
import { ownedFirst } from "@features/lobby/useOwnedLobbyAvatars";

export type Source = "UPLOADED" | "OWNED" | "DEFAULT";
export type Choice = LobbyAvatarChoice & { source: Source };

type VrmEntry = {
    id: string;
    name?: string;
    url?: string;
    image?: string;
    hidden?: boolean;
};

const choice = (vrm: VrmEntry, source: Source): Choice => ({
    id: vrm.id,
    name: vrm.name || "Avatar",
    url: vrm.url || vrm.id,
    img: vrm.image,
    owned: source !== "DEFAULT",
    source,
});

/** A visitor's avatars in a space: uploads and owned first, then the catalog. */
export function spaceAvatarChoices(
    uploaded: readonly VrmEntry[],
    owned: readonly VrmEntry[],
    catalog: readonly VrmEntry[]
): Choice[] {
    return ownedFirst(
        [
            ...uploaded.filter(Boolean).map((vrm) => choice(vrm, "UPLOADED")),
            ...owned.filter(Boolean).map((vrm) => choice(vrm, "OWNED")),
        ],
        catalog
            .filter((vrm) => vrm && !vrm.hidden)
            .map((vrm) => choice(vrm, "DEFAULT"))
    ) as Choice[];
}
