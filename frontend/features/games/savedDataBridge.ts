/**
 * Page half of saved data. The game, in its sandboxed frame, sends
 * `saved` requests (`oncyber:game:saved`, or `<id>:saved` from an older
 * build); this answers each with `saved-result` through the page's one
 * `send`, which puts it in the form the game speaks.
 *
 * Where a value lives:
 *   visitor  signed in: the server. Guests: this browser's storage.
 *   party    the server, under the trip id. No party: refused ("no-party").
 *   game     the server.
 * Guests read shared keys but cannot write them ("sign-in-required"). In
 * development with no server to reach, shared keys fall back to this
 * browser's storage so a game can still be built and tried.
 */
import {
    createLocalSavedStore,
    readSavedDeclarations,
    readSavedRequest,
    type SavedDeclarations,
    type SavedResult,
    type SavedSlot,
    type SavedStore,
} from "./savedData";
import { readGameMessage } from "./gameContract";
import declaredByGame from "./savedData.declared.json";

export interface SavedDataBridgeOptions {
    game: string;
    declared: SavedDeclarations;
    local: SavedStore;
    /** The server; null where there is none (the check, unit tests). */
    remote: SavedStore | null;
    /** The signed-in account id, or null for a guest. */
    account(): string | null;
    /** The party's trip id, or null when the visitor came alone. */
    party(): string | null;
    /** Shared keys may use `local` when `remote` can't be reached. */
    localShared?: boolean;
}

/** Answers one request from the game. Never throws. */
export function createSavedDataBridge(options: SavedDataBridgeOptions) {
    const { game, declared, local, remote } = options;
    return async function handle(raw: unknown): Promise<SavedResult> {
        const read = readSavedRequest(declared, raw);
        if ("reason" in read) return { ok: false, reason: read.reason };
        const { request, declaration } = read;
        const scope = declaration.scope;
        const account = options.account();
        const slot: SavedSlot = { game, scope, owner: "", key: request.key };
        const run = (store: SavedStore) =>
            request.op === "get"
                ? store.read(slot)
                : store.write(slot, request);
        try {
            if (scope === "visitor") {
                if (!account || !remote) {
                    slot.owner = "guest";
                    return await run(local);
                }
                slot.owner = account;
                const result = await run(remote);
                // Progress made as a guest carries over on first sign-in:
                // the game reads it here and its next save lands on the server.
                if (request.op === "get" && result.ok && !result.entry) {
                    const guest = await local.read({ ...slot, owner: "guest" });
                    if (guest.ok && guest.entry)
                        return {
                            ok: true,
                            entry: { ...guest.entry, revision: 0 },
                        };
                }
                return result;
            }
            if (scope === "party") {
                const party = options.party();
                if (!party) return { ok: false, reason: "no-party" };
                slot.owner = party;
            }
            const shared = async (): Promise<SavedResult> => {
                if (!remote) return { ok: false, reason: "unavailable" };
                if (request.op === "get" || account) return run(remote);
                // A guest's write: refused, unless the server is out of reach.
                const reachable = (await remote.read(slot)).ok;
                return {
                    ok: false,
                    reason: reachable ? "sign-in-required" : "unavailable",
                };
            };
            let result = await shared();
            if (
                options.localShared &&
                result.ok === false &&
                result.reason === "unavailable"
            )
                result = await run(local);
            return result;
        } catch {
            return { ok: false, reason: "unavailable" };
        }
    };
}

/** The account id saved data belongs to; null for guests. */
export function signedInAccount(profile: {
    user?: { id?: unknown } | null;
    authenticated?: boolean;
    isAnonymous?: boolean;
}): string | null {
    const id = profile.user?.id;
    return profile.authenticated && !profile.isAnonymous && id
        ? String(id)
        : null;
}

export function declaredForGame(game: string): SavedDeclarations {
    const all: Record<string, unknown> = declaredByGame;
    return readSavedDeclarations(Object.hasOwn(all, game) ? all[game] : null)
        .declared;
}

/**
 * Wires a game frame to its saved data. `fromGame` vouches that a message
 * came from the frame; `send` posts to it. Returns the detach function.
 */
export function attachSavedData(options: {
    game: string;
    remote: SavedStore | null;
    fromGame(event: MessageEvent): boolean;
    send(message: object): void;
    account(): string | null;
    party(): string | null;
    target?: Pick<Window, "addEventListener" | "removeEventListener">;
}) {
    const { game, target = window } = options;
    const handle = createSavedDataBridge({
        game,
        declared: declaredForGame(game),
        local: createLocalSavedStore(),
        remote: options.remote,
        account: options.account,
        party: options.party,
        localShared: process.env.NODE_ENV === "development",
    });
    const receive = (event: MessageEvent) => {
        if (!options.fromGame(event)) return;
        // Either form a game speaks: `oncyber:game:saved` or `<id>:saved`.
        if (readGameMessage(event.data?.type, game)?.kind !== "saved") return;
        const request = event.data.request;
        if (typeof request !== "number" && typeof request !== "string") return;
        void handle(event.data).then((result) =>
            options.send({ type: `${game}:saved-result`, request, ...result })
        );
    };
    target.addEventListener("message", receive as EventListener);
    return () =>
        target.removeEventListener("message", receive as EventListener);
}
