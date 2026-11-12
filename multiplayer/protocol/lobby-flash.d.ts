/** Public artwork presentation only. This is not proof of NFT ownership. */
export interface FlashArtwork {
    id: string;
    title: string;
    imageUrl: string;
    aspect?: number;
}
export interface LobbyFlash extends FlashArtwork {
    /** A fresh token makes selecting the same artwork play the gesture again. */
    nonce: string;
    startedAt: number;
}

export function readFlashArtwork(value: unknown): FlashArtwork | null;
export function readLobbyFlash(value: unknown): LobbyFlash | null;
