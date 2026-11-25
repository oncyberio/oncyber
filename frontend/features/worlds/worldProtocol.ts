/**
 * Every kind of message a framed world and its page exchange, in one place
 * (docs/plans/framed-worlds.md). Each travels as `oncyber:game:<kind>`, the
 * games contract's form (features/games/gameContract.ts), and is checked
 * on arrival by the file named here. A kind that is not on this list is
 * not part of the protocol: ./worldProtocol.test.ts fails when either side
 * of the bridge sends or reads one that is missing.
 *
 * Four families carry a relay of their own, each with its own list of
 * kinds and its own checks: the room, voice, the live channels and world
 * scripts.
 */

/** Families: any kind beginning with the prefix belongs to that relay. */
export const RELAYED_FAMILIES = {
    "room-": "the world's room, held by the page (./roomRelay.ts)",
    "voice-":
        "voice in that room, the page's (./voiceRelay rules in ./worldVoiceHost.ts)",
    "live-": "the space's live channels (./relayedLive.ts)",
    "script-": "world scripts (features/world-scripts/runtimeRelay.ts)",
} as const;

/** What a world says to its page. */
export const WORLD_TO_PAGE = {
    hello: "I am up: who is visiting? Repeated until answered (./worldDocument.ts)",
    progress: "how far loading is, 0 to 1 (the games contract)",
    "first-frame": "the world has drawn (the games contract)",
    ready: "the visitor can play (the games contract)",
    error: "the world could not load (the games contract)",
    alive: "this thread is running, about once a second after drawing",
    location:
        "where the world is now; the address bar follows (./worldLocation.ts)",
    travel: "take the visitor to this page of the site (utils/experienceLocation.ts)",
    "open-link": "offer to open this address in a new tab (./worldLinks.ts)",
    download: "offer to save this file the world made (./worldLinks.ts)",
    "sign-in": "show the sign-in sheet",
    "pointer-lock": "the pointer is, or is no longer, locked to the world",
    dock: "the buttons the world has for the page's dock (./worldDock.ts)",
    ask: "a question only the page can answer: rpc, api, moderator (./accountRelay.ts)",
} as const;

/** What a page says to its world. */
export const PAGE_TO_WORLD = {
    identity: "who is visiting, in answer to hello (./worldVisitor.ts)",
    answer: "the answer to an ask, by its number",
    "dock-press": "the visitor pressed one of the world's dock buttons",
} as const;

export type WorldKind = keyof typeof WORLD_TO_PAGE;
export type PageKind = keyof typeof PAGE_TO_WORLD;

/** True for a kind that is part of the protocol, in either direction. */
export function knownWorldKind(kind: string): boolean {
    return (
        Object.prototype.hasOwnProperty.call(WORLD_TO_PAGE, kind) ||
        Object.prototype.hasOwnProperty.call(PAGE_TO_WORLD, kind) ||
        Object.keys(RELAYED_FAMILIES).some((family) => kind.startsWith(family))
    );
}
