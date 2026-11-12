"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFlashArtwork = readFlashArtwork;
exports.readLobbyFlash = readLobbyFlash;
const bounded = (value, limit) => (typeof value === "string" && value.length > 0 && value.length <= limit ? value : null);
/** Images may use our relay or public HTTP(S) NFT media; never executable URLs. */
function readFlashArtwork(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const input = value;
    const id = bounded(input.id, 256);
    const title = bounded(input.title, 160);
    const imageUrl = bounded(input.imageUrl, 4096);
    if (!id || !title || !imageUrl || /[\u0000-\u001f\\]/.test(imageUrl)) return null;
    if (imageUrl.startsWith("/")) {
        if (imageUrl.startsWith("//")) return null;
    } else {
        try {
            const url = new URL(imageUrl);
            if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
        } catch {
            return null;
        }
    }
    const aspect = typeof input.aspect === "number" && Number.isFinite(input.aspect) && input.aspect > 0 ? Math.min(20, Math.max(0.05, input.aspect)) : undefined;
    return { id, title, imageUrl, ...(aspect ? { aspect } : {}) };
}
function readLobbyFlash(value) {
    const art = readFlashArtwork(value);
    if (!art) return null;
    const input = value;
    const nonce = bounded(input.nonce, 80);
    if (!nonce || !/^[a-zA-Z0-9_-]+$/.test(nonce) || typeof input.startedAt !== "number" || !Number.isFinite(input.startedAt) || input.startedAt <= 0) return null;
    return { ...art, nonce, startedAt: input.startedAt };
}
