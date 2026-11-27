// Limits of the party match channel, enforced here per sender. The clients
// pace themselves to the same numbers; mirror any change in
// games/runtime/src/match.ts and frontend/features/games/room/gameMatch.ts.

/** Packets a second a member may send, averaged (the clients send 30). */
export const MATCH_RATE = 32;
/** How far ahead of the average a member may briefly get. */
export const MATCH_BURST = 16;
/** Characters of JSON in one packet. */
export const MATCH_MAX_BYTES = 1200;
/** Members with a player seat: they may send. The rest only receive. */
export const MATCH_PLAYER_SEATS = 8;
/** Members a room keeps on its roster at all, watchers included. */
export const MATCH_ROSTER_MAX = 32;
/** How long a dropped member's seat (and place in the order) is held. */
export const MATCH_AWAY_MS = 20_000;

/** Party rooms are the only rooms with a roster and a match channel. */
export const isPartyRoom = (label: unknown) => typeof label === "string" && /^oncyber-[a-z0-9][a-z0-9-]{0,62}-party-[A-Za-z0-9_-]{16,80}$/.test(label);
