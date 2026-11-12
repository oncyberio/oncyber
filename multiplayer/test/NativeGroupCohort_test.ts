import assert from "assert";
import { readLobbyGroupCohort, selectNativeRoom } from "../src/express/groupCohort";

describe("native lobby group cohort matching", () => {
    const cohort = "group-trip_abcdefghijklmn", other = "other-trip_abcdefghijklmn";
    const room = (roomId: string, key?: string, clients = 2, maxClients = 8, spaceId = "gallery") => ({ roomId, clients, maxClients, metadata: { spaceId, ...(key ? { lobbyGroupCohort: key } : {}) } });
    it("accepts bounded opaque cohort IDs and rejects malformed supplied hints", () => {
        assert.equal(readLobbyGroupCohort(undefined), undefined);
        assert.equal(readLobbyGroupCohort(cohort), cohort);
        assert.equal(readLobbyGroupCohort("a341311a-1208-4e0b-9285-8752421b8f6b"), "a341311a-1208-4e0b-9285-8752421b8f6b");
        for (const value of [null, "", "short", "a".repeat(81), "/group/abcdefghijklmn", { id: cohort }, 123]) assert.throws(() => readLobbyGroupCohort(value));
    });
    it("keeps ordinary visitors out of cohort rooms even when those rooms are busiest", () => {
        const rooms = [room("cohort", cohort, 7), room("ordinary-low", undefined, 1), room("ordinary-high", undefined, 3)];
        assert.equal(selectNativeRoom(rooms, "gallery")!.roomId, "ordinary-high");
        assert.equal(selectNativeRoom([room("cohort", cohort)], "gallery"), undefined);
    });
    it("matches both destination and cohort and never falls back into another group or public room", () => {
        const rooms = [room("public", undefined, 7), room("other", other, 6), room("wrong-destination", cohort, 5, 8, "elsewhere"), room("correct", cohort, 1)];
        assert.equal(selectNativeRoom(rooms, "gallery", cohort)!.roomId, "correct");
        assert.equal(selectNativeRoom(rooms.filter(item => item.roomId !== "correct"), "gallery", cohort), undefined);
    });
    it("fails a full or locked cohort instead of creating a second destination room", () => {
        assert.throws(() => selectNativeRoom([room("full", cohort, 8), room("public")], "gallery", cohort), /not been split/);
        assert.throws(() => selectNativeRoom([{ ...room("locked", cohort), locked: true }], "gallery", cohort), /not been split/);
        assert.equal(selectNativeRoom([room("ordinary-full", undefined, 8)], "gallery"), undefined);
    });
});
