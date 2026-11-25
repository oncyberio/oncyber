/**
 * Who a signed-out visitor is: one id for this page, and the name others
 * see for it. The lobby, a space and a framed world's room all use the
 * same id, so a guest is the same guest through every trip between them.
 *
 * The id lives for as long as the page does and is not saved anywhere:
 * two tabs with one id would put each other out of a room.
 */
const GUEST_ID = /^Anon-[A-Za-z0-9_-]{4,64}$/;

let id = "";

/** This page's guest id. */
export function guestId(): string {
    if (!id)
        id = `Anon-${
            globalThis.crypto?.randomUUID?.() ||
            Math.random().toString(36).slice(2).padEnd(8, "0")
        }`;
    return id;
}

/**
 * A framed world takes the guest id of the page around it, before it makes
 * one of its own. False when the id is not one, and nothing changes.
 */
export function adoptGuestId(value: unknown): boolean {
    if (typeof value !== "string" || !GUEST_ID.test(value)) return false;
    id = value;
    return true;
}

export function isGuestId(value: unknown): value is string {
    return typeof value === "string" && value.startsWith("Anon-");
}

/** The name a guest goes by: "Guest" and the end of their id. */
export function guestName(guest: string): string {
    const tail = guest
        .replace(/[^a-z0-9]/gi, "")
        .slice(-4)
        .toUpperCase();
    return tail ? `Guest ${tail}` : "Guest";
}

/** The name others see: the account's, or the guest's own. */
export function visitorName(
    username: string | null | undefined,
    userId: string | null | undefined
): string {
    if (username) return username;
    return isGuestId(userId) ? guestName(userId) : userId || "";
}

/**
 * A name as it is drawn. A visitor on an older page still sends their
 * guest id as their name: they read as a guest too.
 */
export function shownName(name: string): string {
    return isGuestId(name) ? guestName(name) : name;
}

/** Test seam: forget this page's guest. */
export function resetGuestIdentity() {
    id = "";
}
