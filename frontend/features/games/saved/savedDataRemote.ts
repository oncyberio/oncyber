import api from "@api/gameSaved/_api";
import type { SavedResult, SavedStore } from "./savedData";

/** The server as a store, through the gameSaved RPC procedures. */
export function createRemoteSavedStore(): SavedStore {
    const guard = (call: Promise<SavedResult>): Promise<SavedResult> =>
        call.catch(() => ({ ok: false, reason: "unavailable" }));
    const party = (slot: { scope: string; owner: string }) =>
        slot.scope === "party" ? slot.owner : undefined;
    return {
        read: (slot) =>
            guard(
                api.savedRead({
                    game: slot.game,
                    party: party(slot),
                    key: slot.key,
                })
            ),
        write: (slot, request) =>
            guard(
                api.savedWrite({
                    game: slot.game,
                    party: party(slot),
                    ...request,
                })
            ),
    };
}
