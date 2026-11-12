// The realtime backend host (Colyseus + matchmaking HTTP + TURN credentials).
// Hardcoded to the GCP VM for now; revisit making this an env var later.
export const ARENA_BASE_URL = "arena.oncyber.io";

const INSECURE = /^(localhost|127\.)/.test(ARENA_BASE_URL);

export const ARENA_HTTP_URL = `${INSECURE ? "http" : "https"}://${ARENA_BASE_URL}`;

export const ARENA_WS_URL = `${INSECURE ? "ws" : "wss"}://${ARENA_BASE_URL}`;
