import assert from "assert";
import { GROUP_RECONNECT_GRACE_MS, LobbyGroups } from "../src/world/groups";
import { WorldGateway } from "../src/world/gateway";
import { createSharedWorld, SharedWorld, blankPose } from "../src/world/shared";
import { encodeMovement } from "../protocol/lobby-v2";
import { encodeInputs } from "../protocol/movement";
import WebSocket from "ws";
import { createWorldServer } from "../src/world/server";
import { mintLobbyIdentity } from "../src/identity/lobby";

function fixture(count = 4) {
    let now = 1000, sequence = 0;
    const events: { id: string; event: string; data: any }[] = [], places: any[] = [], presence: any[] = [];
    const members = new Map(Array.from({ length: count }, (_, i) => [String(i + 1), { id: String(i + 1), name: `Guest ${i + 1}`, avatar: "", vrmUrl: "", scale: 1 }]));
    // The real server never reuses an id: a reconnect is a new id carrying the same private identity.
    const identities = new Map(Array.from(members.keys(), id => [id, `traveller-${id}`]));
    const service = new LobbyGroups({ member: id => members.get(id), pose: id => ({ x: Number(id) * 10, y: 0, z: 4, rotation: 0.2 }), send: (id, event, data) => events.push({ id, event, data }), place: (...args) => places.push(args), activeWorld: (...args) => presence.push(args), identity: id => identities.get(id), now: () => now });
    for (const id of members.keys()) service.connect(id);
    const arrive = (id: string, identity?: string, name = `Guest ${id}`) => {
        members.set(id, { id, name, avatar: "", vrmUrl: "", scale: 1 });
        if (identity) identities.set(id, identity);
        service.connect(id);
    };
    const action = (actor: string, action: string, data: any = {}) => {
        const requestId = `request${++sequence}`;
        service.action(actor, { ...data, action, requestId });
        return [...events].reverse().find(item => item.id === actor && item.event === "lobby-group-result" && item.data.requestId === requestId)!.data;
    };
    const create = () => { const result = action("1", "create", { name: "Friends", memberIds: ["2", "3"] }); assert(!result.error); return result.groupId; };
    const accept = (id: string) => action(id, "respond-invite", { invitationId: service.snapshot(id).invitations[0].id, accepted: true });
    return { service, action, create, accept, arrive, events, places, presence, members, at: (value: number) => { now = value; }, time: (value: number) => { now = value; service.tick(); } };
}
/**
 * What the lobby client checks before it accepts a snapshot (frontend/features/lobby/lobbyGroupValidation.ts, which
 * frontend/features/lobby/lobbyGroupReconnect.test.ts runs against this coordinator): the reader and the owner are
 * listed members, within both limits, and a live trip only names people it also lists as members.
 */
function wellFormed(events: { id: string; event: string; data: any }[]) {
    for (const { id, event, data } of events) if (event === "lobby-groups") {
        assert(data.groups.length <= 4, "nobody is in more than four parties");
        for (const group of data.groups) {
            const listed = new Set<string>(group.members.map((member: any) => member.id)), trip = group.travel;
            assert(listed.size === group.members.length && listed.size >= 1 && listed.size <= 8, "a party lists one to eight different members");
            assert(listed.has(id) && listed.has(group.ownerId), "a snapshot must list its reader and the owner");
            if (!trip || ["complete", "cancelled"].includes(trip.status)) { assert.equal(trip?.waitingFor, undefined); continue; }
            assert(listed.has(trip.initiatorId) && trip.responses[trip.initiatorId] === "accepted", "the initiator must be a traveller in the group");
            for (const [member, response] of Object.entries(trip.responses)) assert(listed.has(member) || response === "declined", "only a declined response may outlive membership");
            for (const key of ["readyIds", "acceptedIds"]) assert(trip[key].every((member: string) => member in trip.responses));
            assert(Object.keys(trip.poses).every(member => member in trip.responses));
            for (const wait of trip.waitingFor || []) assert(trip.acceptedIds.includes(wait.id) && listed.has(wait.id) && wait.name && Number.isFinite(wait.until));
        }
    }
}
/** A group of 1, 2 and 3 with a trip proposed by 1 at the fixture's start time (1000). */
function trip(accepting: string[] = ["2", "3"]) {
    const f = fixture(), groupId = f.create(); f.accept("2"); f.accept("3");
    assert(!f.action("1", "travel-propose", { groupId, destination: { id: "x", title: "X", href: "/x" } }).error);
    const travel = (viewer = "1") => f.service.snapshot(viewer).groups[0].travel!, travelId = travel().id;
    const act = (actor: string, action: string, data: any = {}) => { const result = f.action(actor, action, { groupId, travelId, ...data }); assert(!result.error, result.error); };
    for (const id of accepting) act(id, "travel-respond", { accepted: true });
    const ready = (...ids: string[]) => { for (const id of ids) act(id, "travel-ready", { success: true }); };
    return { ...f, groupId, travelId, travel, act, ready, wellFormed: () => wellFormed(f.events) };
}
describe("authoritative lobby groups", () => {
    it("keeps location and chat private to current group members while their coordinate world changes", () => {
        const f = fixture(), destination = { id: "private", title: "Private gallery", href: "/private" };
        assert(!f.action("1", "active-world", { active: true, location: { state: "space", destination } }).error);
        const groupId = f.create();
        assert.equal(f.service.snapshot("2").invitations[0].inviter.location, undefined);
        assert.equal(JSON.stringify(f.service.snapshot("2")).includes("Private gallery"), false);
        f.accept("2");
        const current = (id: string) => f.service.snapshot("2").groups[0].members.find(member => member.id === id)!.location;
        assert.deepEqual(current("1"), { state: "space", destination });
        const start = f.events.length;
        assert(!f.action("2", "active-world", { active: false, sessionId: "1", location: { state: "travelling", destination } }).error);
        assert.deepEqual(current("1"), { state: "space", destination });
        assert.deepEqual(current("2"), { state: "travelling", destination });
        assert(f.events.slice(start).every(event => event.id === "1" || event.id === "2"));
        assert(!f.action("2", "message", { groupId, text: "Chat while loading" }).error);
        assert(!f.action("2", "active-world", { active: true, location: { state: "space", destination } }).error);
        assert(!f.action("2", "message", { groupId, text: "Coordinates still connecting" }).error);
        assert.equal(f.service.snapshot("1").groups[0].messages.length, 2);
        f.action("2", "leave", { groupId });
        assert.equal(f.service.snapshot("2").groups.length, 0);
        assert(f.action("2", "message", { groupId, text: "No longer authorized" }).error);
        assert.equal(f.service.snapshot("3").groups.length, 0);
        assert.equal(f.service.snapshot("4").groups.length, 0);
    });
    it("rejects unsafe or contradictory locations, returns to lobby, and clears disconnected identity state", () => {
        const f = fixture(), groupId = f.create(); f.accept("2");
        const destination = { id: "one", title: "Gallery", href: "/spaces/one" };
        assert(!f.action("2", "active-world", { active: true, location: { state: "space", destination } }).error);
        for (const href of ["https://evil.test/x", "//evil.test", "/x?token=secret", "/x#secret", "/../admin", "/x%2fy", "/x\\evil"])
            assert(f.action("2", "active-world", { active: true, location: { state: "space", destination: { ...destination, href } } }).error);
        assert(f.action("2", "active-world", { active: false, location: { state: "space", destination } }).error);
        assert(f.action("2", "active-world", { active: true, location: { state: "space", destination: { ...destination, title: "x".repeat(81) } } }).error);
        assert.deepEqual(f.service.snapshot("1").groups[0].members[1].location, { state: "space", destination });
        assert(!f.action("2", "active-world", { active: true, location: { state: "travelling" } }).error);
        assert(!f.action("2", "active-world", { active: false, location: { state: "lobby" } }).error);
        assert.deepEqual(f.service.snapshot("1").groups[0].members[1].location, { state: "lobby" });
        // A dropped connection forgets where it was at once, even though the party keeps their place for a while.
        assert(!f.action("2", "active-world", { active: true, location: { state: "space", destination } }).error);
        f.service.disconnect("2"); f.service.connect("2");
        assert.deepEqual(f.service.snapshot("1").groups[0].members[1].location, { state: "lobby" });
        assert(!f.action("2", "travel-propose", { groupId, destination }).error, "no longer counted as inside a world");
        assert(!f.action("2", "travel-cancel", { groupId, travelId: f.service.snapshot("2").groups[0].travel!.id }).error);
        // Once the grace has run out the old session is no member of anything.
        f.service.disconnect("2"); f.time(1000 + GROUP_RECONNECT_GRACE_MS); f.service.connect("2");
        assert.equal(f.service.snapshot("2").groups.length, 0);
        assert(f.action("2", "message", { groupId, text: "Old session" }).error);
    });

    it("requires explicit invite consent and restricts private history and member identity", () => {
        const f = fixture(), groupId = f.create();
        assert.equal(f.service.snapshot("2").groups.length, 0);
        assert.equal(f.service.snapshot("4").invitations.length, 0);
        const stolen = f.service.snapshot("2").invitations[0].id;
        assert(f.action("4", "respond-invite", { invitationId: stolen, accepted: true }).error);
        f.accept("2");
        assert(f.action("3", "message", { groupId, text: "Not accepted" }).error);
        assert(!f.action("2", "message", { groupId, text: "Private hello", sessionId: "4", name: "Spoof" }).error);
        const message = f.service.snapshot("1").groups[0].messages[0];
        assert.equal(message.sessionId, "2"); assert.equal(message.name, "Guest 2");
        assert.equal(f.service.snapshot("2").groups[0].messages[0].id, message.id);
        assert.equal(f.service.snapshot("3").groups.length, 0);
        assert.equal(f.service.snapshot("4").groups.length, 0);
    });
    it("allows an explicit join code, caps groups at eight, and invalidates removed memberships", () => {
        const f = fixture(10), groupId = f.create(), code = f.service.snapshot("1").groups[0].joinCode;
        for (let id = 2; id <= 8; id++) assert(!f.action(String(id), "join", { code }).error);
        assert.equal(f.service.snapshot("1").groups[0].members.length, 8);
        assert(f.action("9", "join", { code }).error);
        assert(f.action("9", "join", { code: "wrong" }).error);
        f.action("2", "leave", { groupId });
        assert(f.action("2", "message", { groupId, text: "No longer a member" }).error);
        assert(!f.action("9", "join", { code }).error);
    });
    it("seals only accepted participants and waits for readiness and worker placement acknowledgments", () => {
        const f = fixture(), groupId = f.create(); f.accept("2"); f.accept("3");
        const destination = { id: "example", title: "Example", href: "/example" };
        assert(!f.action("1", "travel-propose", { groupId, destination, poses: { "1": { x: 999 } } }).error);
        let travel = f.service.snapshot("1").groups[0].travel!;
        const travelId = travel.id;
        assert.equal(travel.poses["1"].x, 10); assert.equal(f.places[0][0], "1");
        assert(f.action("4", "travel-respond", { groupId, travelId, accepted: true }).error);
        f.action("2", "travel-respond", { groupId, travelId, accepted: true });
        assert(f.action("3", "travel-ready", { groupId, travelId, success: true }).error);
        assert(f.action("2", "travel-launch", { groupId, travelId }).error);
        f.action("1", "travel-launch", { groupId, travelId });
        assert(f.action("3", "travel-respond", { groupId, travelId, accepted: true }).error);
        f.action("1", "travel-ready", { groupId, travelId, success: true });
        assert.equal(f.service.snapshot("1").groups[0].travel!.status, "preparing");
        f.action("2", "travel-ready", { groupId, travelId, success: true });
        travel = f.service.snapshot("1").groups[0].travel!;
        assert.equal(travel.status, "gathering"); assert.deepEqual(travel.acceptedIds, ["1", "2"]);
        assert.equal(travel.responses["3"], "declined");
        assert(Math.abs(Math.hypot(travel.poses["2"].x - 10, travel.poses["2"].z - 4) - 1.8) < 1e-6);
        f.service.placed("4", travelId); f.service.placed("1", travelId);
        assert.equal(f.service.snapshot("1").groups[0].travel!.status, "gathering");
        f.service.placed("2", travelId);
        travel = f.service.snapshot("1").groups[0].travel!;
        assert.equal(travel.status, "travelling"); assert.equal(travel.startAt, 1700);
        f.service.placed("2", travelId); assert.equal(f.service.snapshot("1").groups[0].travel!.startAt, 1700);
        assert(f.action("2", "travel-entered", { groupId, travelId }).error);
        f.time(1800); f.action("1", "travel-entered", { groupId, travelId }); f.action("2", "travel-entered", { groupId, travelId });
        assert.equal(f.service.snapshot("1").groups[0].travel!.status, "complete");
        assert.deepEqual(f.presence, [["1", true], ["2", true]]);
        assert(f.places.some(place => place[0] === "1" && place[4] === false));
        assert(!f.action("2", "message", { groupId, text: "Still connected in destination" }).error);
    });
    it("invites group members already in a destination and requires their explicit return before accepting", () => {
        const f = fixture(), groupId = f.create(); f.accept("2");
        f.action("2", "active-world", { active: true });
        f.action("1", "travel-propose", { groupId, destination: { id: "next", title: "Next space", href: "/next" } });
        const travelId = f.service.snapshot("2").groups[0].travel!.id;
        assert.equal(f.service.snapshot("2").groups[0].travel!.responses["2"], "pending");
        assert(f.action("2", "travel-respond", { groupId, travelId, accepted: true }).error);
        assert.equal(f.service.snapshot("1").groups[0].travel!.responses["2"], "pending");
        assert(!f.action("2", "active-world", { active: false }).error);
        assert(!f.action("2", "travel-respond", { groupId, travelId, accepted: true }).error);
        assert.equal(f.service.snapshot("1").groups[0].travel!.responses["2"], "accepted");
    });
    it("cancels and releases on failures, timeouts, and a last traveller who never comes back; rejects stale trips", () => {
        const f = fixture(), groupId = f.create(); f.accept("2");
        const destination = { id: "x", title: "X", href: "/x" };
        f.action("1", "travel-propose", { groupId, destination });
        let travelId = f.service.snapshot("1").groups[0].travel!.id;
        f.action("2", "travel-respond", { groupId, travelId, accepted: true });
        f.action("2", "travel-ready", { groupId, travelId, success: false });
        assert.equal(f.service.snapshot("1").groups[0].travel!.status, "cancelled");
        assert(f.places.some(place => place[4] === false));
        f.action("1", "travel-propose", { groupId, destination });
        assert(f.action("1", "travel-ready", { groupId, travelId, success: true }).error);
        // The only traveller drops: the trip and their ownership wait out the grace, then nobody is left to go.
        f.service.disconnect("1");
        assert.equal(f.service.snapshot("2").groups[0].ownerId, "1");
        assert.equal(f.service.snapshot("2").groups[0].travel!.status, "inviting");
        f.time(1000 + GROUP_RECONNECT_GRACE_MS - 1);
        assert.equal(f.service.snapshot("2").groups[0].travel!.status, "inviting");
        f.time(1000 + GROUP_RECONNECT_GRACE_MS);
        assert.equal(f.service.snapshot("2").groups[0].ownerId, "2");
        assert.deepEqual(f.service.snapshot("2").groups[0].members.map(member => member.id), ["2"]);
        assert.equal(f.service.snapshot("2").groups[0].travel!.status, "cancelled");
        assert.equal(f.service.snapshot("2").groups[0].travel!.reason, "A traveller left the party. Everyone is still in the lobby.");
        f.action("2", "travel-propose", { groupId, destination });
        f.time(200000); assert.equal(f.service.snapshot("2").groups[0].travel!.status, "cancelled");
        assert.equal(f.service.snapshot("3").invitations.length, 0);
    });
    it("keeps a dropped traveller's place and hands it to the connection they come back on", () => {
        const t = trip(); t.ready("1", "2");
        assert(!t.action("2", "message", { groupId: t.groupId, text: "Almost there" }).error);
        t.service.disconnect("2");
        let travel = t.travel();
        assert.equal(travel.status, "preparing"); assert.equal(travel.reason, undefined);
        assert.deepEqual(travel.acceptedIds, ["1", "2", "3"]); assert.equal(travel.responses["2"], "accepted");
        assert.deepEqual(travel.waitingFor, [{ id: "2", name: "Guest 2", until: 1000 + GROUP_RECONNECT_GRACE_MS }]);
        assert.deepEqual(t.service.snapshot("1").groups[0].members.map(member => member.id), ["1", "2", "3"]);
        // Whatever the lost connection had confirmed is void, so the trip cannot leave without them.
        assert.deepEqual(travel.readyIds, ["1"]);
        t.ready("3"); t.service.disconnect("2"); t.time(6000);
        assert.equal(t.travel().status, "preparing");
        // Someone else arriving is not given the place.
        t.arrive("8"); t.arrive("7", "traveller-8");
        assert.equal(t.service.snapshot("8").groups.length, 0); assert.equal(t.service.snapshot("7").groups.length, 0);
        assert.equal(t.travel().waitingFor!.length, 1);
        t.arrive("9", "traveller-2", "Guest 2");
        const group = t.service.snapshot("9").groups[0]; travel = group.travel!;
        assert.deepEqual(group.members.map(member => member.id), ["1", "9", "3"]);
        assert.equal(travel.waitingFor, undefined); assert.equal(travel.status, "preparing");
        assert.deepEqual(travel.acceptedIds, ["1", "9", "3"]); assert.deepEqual(travel.responses, { "1": "accepted", "3": "accepted", "9": "accepted" });
        assert.equal(group.messages[0].sessionId, "9");
        assert.equal(t.service.snapshot("2").groups.length, 0);
        // Their place is theirs for good: the old grace no longer runs, and they go on like anyone else.
        t.time(1000 + GROUP_RECONNECT_GRACE_MS + 5000);
        assert.deepEqual(t.travel().acceptedIds, ["1", "9", "3"]);
        t.ready("9");
        assert.equal(t.travel().status, "gathering");
        for (const id of ["1", "3", "9"]) t.service.placed(id, t.travelId);
        assert.equal(t.travel().status, "travelling");
        t.time(t.travel().startAt!); for (const id of ["1", "3", "9"]) t.act(id, "travel-entered");
        assert.equal(t.travel().status, "complete");
        assert(!t.places.some(place => place[0] === "2" && place[4] === false));
        t.wellFormed();
    });
    it("gives a returning initiator the trip back, held where it was called", () => {
        const t = trip(["2"]);
        t.service.disconnect("1");
        assert.equal(t.travel("2").status, "inviting"); assert.equal(t.travel("2").expiresAt, 31000);
        assert.deepEqual(t.travel("2").waitingFor!.map(wait => wait.id), ["1"]);
        t.time(4000); t.arrive("9", "traveller-1");
        const group = t.service.snapshot("9").groups[0], anchor = { x: 10, y: 0, z: 4, rotation: 0.2 };
        assert.equal(group.ownerId, "9"); assert.equal(group.travel!.initiatorId, "9");
        assert.deepEqual(group.travel!.poses, { "9": anchor });
        assert.deepEqual(t.places[t.places.length - 1], ["9", t.travelId, anchor, [], true]);
        t.act("9", "travel-launch"); t.ready("2", "9");
        assert.equal(t.travel("9").status, "gathering"); assert.deepEqual(t.travel("9").acceptedIds, ["2", "9"]);
        // The trip's hold on them moved with the place, so ending the trip frees the connection they are on now.
        t.act("2", "travel-cancel");
        assert(t.places.some(place => place[0] === "9" && place[4] === false));
        assert(!t.action("9", "travel-propose", { groupId: t.groupId, destination: { id: "y", title: "Y", href: "/y" } }).error);
        t.wellFormed();
    });
    it("places a traveller who comes back to a gathered trip and waits for that connection to confirm", () => {
        const t = trip(); t.ready("1", "2", "3");
        assert.equal(t.travel().status, "gathering");
        t.service.placed("1", t.travelId); t.service.placed("2", t.travelId);
        t.service.disconnect("2"); t.service.placed("3", t.travelId);
        assert.equal(t.travel().status, "gathering");
        t.time(5000); t.arrive("9", "traveller-2");
        assert.deepEqual(t.places[t.places.length - 1], ["9", t.travelId, t.travel().poses["9"], ["1", "3"], true]);
        assert.equal(t.travel().status, "gathering");
        // Their lobby prepares the destination again and reports it; that is welcome at any step, a late failure is not.
        t.act("9", "travel-ready", { success: true });
        assert(t.action("9", "travel-ready", { groupId: t.groupId, travelId: t.travelId, success: false }).error);
        assert.equal(t.travel().status, "gathering");
        t.service.placed("9", t.travelId);
        assert.equal(t.travel().status, "travelling"); assert.equal(t.travel().startAt, 5700);
        // The same holds once the trip is under way: entering has to come from a live connection.
        t.time(6000); t.act("1", "travel-entered"); t.act("9", "travel-entered");
        t.service.disconnect("9"); t.act("3", "travel-entered");
        assert.equal(t.travel().status, "travelling");
        t.arrive("10", "traveller-2");
        assert.deepEqual(t.places[t.places.length - 1].slice(0, 2), ["10", t.travelId]);
        t.act("10", "travel-ready", { success: true });
        assert.equal(t.travel().status, "travelling");
        t.act("10", "travel-entered");
        assert.equal(t.travel().status, "complete");
        t.wellFormed();
    });
    it("takes a traveller straight back when the very same connection id is reported again", () => {
        const t = trip(); t.ready("1", "2", "3");
        t.service.disconnect("2"); t.time(3000); t.service.connect("2");
        const travel = t.travel("2");
        assert.equal(travel.waitingFor, undefined); assert.equal(travel.status, "gathering");
        assert.deepEqual(travel.acceptedIds, ["1", "2", "3"]);
        assert.deepEqual(t.places[t.places.length - 1], ["2", t.travelId, travel.poses["2"], ["1", "3"], true]);
        for (const id of ["1", "2", "3"]) t.service.placed(id, t.travelId);
        t.time(1000 + GROUP_RECONNECT_GRACE_MS);
        assert.equal(t.travel().status, "travelling"); assert.deepEqual(t.travel().acceptedIds, ["1", "2", "3"]);
        t.wellFormed();
    });
    it("goes on without a traveller who is not back within the grace", () => {
        const t = trip(); t.ready("1", "3");
        t.service.disconnect("2");
        t.time(1000 + GROUP_RECONNECT_GRACE_MS - 1);
        assert.equal(t.travel().status, "preparing"); assert.equal(t.travel().waitingFor!.length, 1);
        t.time(1000 + GROUP_RECONNECT_GRACE_MS);
        const group = t.service.snapshot("1").groups[0], travel = group.travel!;
        assert.equal(travel.status, "gathering"); assert.equal(travel.reason, undefined); assert.equal(travel.waitingFor, undefined);
        assert.deepEqual(travel.acceptedIds, ["1", "3"]); assert.deepEqual(travel.readyIds, ["1", "3"]);
        assert.equal(travel.responses["2"], "declined"); assert.deepEqual(Object.keys(travel.poses), ["1", "3"]);
        assert.deepEqual(group.members.map(member => member.id), ["1", "3"]);
        assert(!t.places.some(place => place[4] === false), "nobody else was sent back to the lobby");
        // Too late is too late: they are a newcomer now, and free to start another trip.
        t.arrive("9", "traveller-2");
        assert.equal(t.service.snapshot("9").groups.length, 0);
        t.service.placed("1", t.travelId); t.service.placed("3", t.travelId);
        t.time(t.travel().startAt!); t.act("1", "travel-entered"); t.act("3", "travel-entered");
        assert.equal(t.travel().status, "complete");
        t.wellFormed();
    });
    it("carries on under another traveller when the initiator is not back within the grace", () => {
        const t = trip(); t.ready("2", "3");
        t.service.disconnect("1");
        t.time(1000 + GROUP_RECONNECT_GRACE_MS);
        let group = t.service.snapshot("2").groups[0], travel = group.travel!;
        assert.equal(group.ownerId, "2"); assert.equal(travel.initiatorId, "2");
        assert.equal(travel.status, "gathering"); assert.deepEqual(travel.acceptedIds, ["2", "3"]);
        // The formation gathers around the new initiator, who is held where they stand.
        assert.deepEqual(travel.poses["2"], { x: 20, y: 0, z: 4, rotation: 0.2 });
        assert(Math.abs(Math.hypot(travel.poses["3"].x - 20, travel.poses["3"].z - 4) - 1.8) < 1e-6);
        assert(t.places.some(place => place[0] === "2" && place[3].length === 0 && place[4] === true));
        t.service.placed("2", t.travelId); t.service.placed("3", t.travelId);
        assert.equal(t.travel("2").status, "travelling");
        t.wellFormed();
        // Before the trip is sealed the new initiator can also start it.
        const u = trip(["2"]);
        u.service.disconnect("1"); u.time(1000 + GROUP_RECONNECT_GRACE_MS);
        assert.equal(u.travel("2").status, "inviting"); assert.equal(u.travel("2").initiatorId, "2");
        u.act("2", "travel-launch"); u.ready("2");
        assert.equal(u.travel("2").status, "gathering"); assert.deepEqual(u.travel("2").acceptedIds, ["2"]);
        u.wellFormed();
        // Once everyone is under way nothing has to be re-formed: the others simply arrive.
        const v = trip(); v.ready("1", "2", "3");
        for (const id of ["1", "2", "3"]) v.service.placed(id, v.travelId);
        v.time(2000); v.act("2", "travel-entered"); v.act("3", "travel-entered");
        v.service.disconnect("1");
        assert.equal(v.travel("2").status, "travelling");
        v.time(2000 + GROUP_RECONNECT_GRACE_MS);
        assert.equal(v.travel("2").status, "complete"); assert.equal(v.travel("2").initiatorId, "2");
        v.wellFormed();
    });
    it("does not time a trip out for the time it spent waiting", () => {
        // Preparing ends at 91000. A traveller drops half a second before, so the grace runs past it.
        const t = trip(); t.ready("1", "3");
        t.time(90500); t.service.disconnect("2");
        assert.equal(t.travel().expiresAt, 91000 + GROUP_RECONNECT_GRACE_MS);
        t.time(91000); t.time(90500 + GROUP_RECONNECT_GRACE_MS - 1);
        assert.equal(t.travel().status, "preparing");
        t.time(90500 + GROUP_RECONNECT_GRACE_MS);
        assert.equal(t.travel().status, "gathering");
        // Coming back does not cancel it either, and the deadline still stands afterwards.
        const u = trip(); u.ready("1", "3");
        u.time(90500); u.service.disconnect("2"); u.time(99000); u.arrive("9", "traveller-2");
        u.time(100999); assert.equal(u.travel().status, "preparing");
        u.time(101000); assert.equal(u.travel().status, "cancelled");
        assert.equal(u.travel().reason, "The party trip timed out. You can try again from the lobby.");
        // Gathering allows ten seconds, the same as the grace: a drop there must not use it up.
        const v = trip(); v.ready("1", "2", "3");
        v.service.placed("1", v.travelId); v.service.placed("3", v.travelId);
        v.time(10000); v.service.disconnect("2");
        v.time(11000); v.time(19999); assert.equal(v.travel().status, "gathering");
        v.time(20000); assert.equal(v.travel().status, "travelling");
        // A drop that lands after the deadline but before the next tick is settled first on the tick both fall due.
        const w = trip(); w.ready("1", "3");
        w.time(90999); w.at(91200); w.service.disconnect("2");
        w.time(91200 + GROUP_RECONNECT_GRACE_MS - 1); assert.equal(w.travel().status, "preparing");
        w.time(91200 + GROUP_RECONNECT_GRACE_MS); assert.equal(w.travel().status, "gathering");
        for (const check of [t, u, v, w]) check.wellFormed();
    });
    it("still counts an invited member who drops before answering as declined", () => {
        const t = trip(["3"]);
        assert.equal(t.travel().status, "inviting");
        t.service.disconnect("2");
        const group = t.service.snapshot("1").groups[0], travel = group.travel!;
        assert.equal(travel.responses["2"], "declined"); assert.equal(travel.waitingFor, undefined);
        assert.equal(travel.status, "preparing"); assert.deepEqual(travel.acceptedIds, ["1", "3"]);
        // The trip does not wait for them, the party does: back in time they are a member who is not going.
        assert.deepEqual(group.members.map(member => member.id), ["1", "2", "3"]);
        t.arrive("9", "traveller-2");
        const back = t.service.snapshot("9").groups[0];
        assert.deepEqual(back.members.map(member => member.id), ["1", "9", "3"]);
        assert.equal(back.travel!.responses["9"], "declined"); assert.deepEqual(back.travel!.acceptedIds, ["1", "3"]);
        assert(t.action("9", "travel-respond", { groupId: t.groupId, travelId: t.travelId, accepted: true }).error);
        // Not back in time, they leave the party as before, and the trip is none the wiser.
        const u = trip(["3"]);
        u.service.disconnect("2"); u.time(1000 + GROUP_RECONNECT_GRACE_MS);
        assert.deepEqual(u.service.snapshot("1").groups[0].members.map(member => member.id), ["1", "3"]);
        assert.equal(u.travel().status, "preparing"); assert.deepEqual(u.travel().acceptedIds, ["1", "3"]);
        u.arrive("9", "traveller-2");
        assert.equal(u.service.snapshot("9").groups.length, 0);
        for (const check of [t, u]) check.wellFormed();
    });
    it("still cancels at once when a traveller leaves or cancels on purpose, and then waits for nobody", () => {
        const t = trip();
        assert(!t.action("2", "leave", { groupId: t.groupId }).error);
        assert.equal(t.travel().status, "cancelled"); assert.equal(t.travel().waitingFor, undefined);
        assert.equal(t.travel().reason, "A traveller left the party. Everyone is still in the lobby.");
        assert.deepEqual(t.service.snapshot("1").groups[0].members.map(member => member.id), ["1", "3"]);
        const u = trip();
        u.act("2", "travel-cancel");
        assert.equal(u.travel().status, "cancelled"); assert.equal(u.travel().waitingFor, undefined);
        assert.equal(u.travel().reason, "A traveller cancelled. Everyone is still in the lobby.");
        // A trip that ends while someone is away gives their place on it up with it. Their place in the party keeps its own grace.
        const v = trip();
        v.service.disconnect("2"); v.act("3", "travel-cancel");
        assert.equal(v.travel().status, "cancelled"); assert.equal(v.travel().waitingFor, undefined);
        assert.deepEqual(v.service.snapshot("1").groups[0].members.map(member => member.id), ["1", "2", "3"]);
        // Nothing holds the others: the next trip starts at once, and neither asks nor waits for the one who is away.
        assert(!v.action("1", "travel-propose", { groupId: v.groupId, destination: { id: "y", title: "Y", href: "/y" } }).error);
        assert.deepEqual(v.travel().responses, { "1": "accepted", "2": "declined", "3": "pending" }); assert.equal(v.travel().waitingFor, undefined);
        v.arrive("9", "traveller-2");
        assert.deepEqual(v.service.snapshot("9").groups[0].members.map(member => member.id), ["1", "9", "3"]);
        assert.equal(v.travel("9").responses["9"], "declined");
        assert(!v.places.some(place => place[0] === "9"), "they come back to the party, held nowhere");
        // Away for longer than the grace, they have left the party, as before.
        const w = trip();
        w.service.disconnect("2"); w.act("3", "travel-cancel"); w.time(1000 + GROUP_RECONNECT_GRACE_MS);
        assert.deepEqual(w.service.snapshot("1").groups[0].members.map(member => member.id), ["1", "3"]);
        w.arrive("9", "traveller-2");
        assert.equal(w.service.snapshot("9").groups.length, 0);
        for (const check of [t, u, v, w]) check.wellFormed();
    });
    it("ends the trip and the group when every traveller is gone for good", () => {
        const t = trip(["2"]), joinCode = t.service.snapshot("1").groups[0].joinCode;
        assert(!t.action("3", "leave", { groupId: t.groupId }).error);
        t.service.disconnect("1"); t.time(4000); t.service.disconnect("2");
        // The first grace to run out leaves the trip to the traveller who may still come back.
        t.time(1000 + GROUP_RECONNECT_GRACE_MS);
        t.arrive("8", "traveller-2");
        assert.deepEqual(t.service.snapshot("8").groups[0].members.map(member => member.id), ["8"]);
        assert.equal(t.travel("8").status, "preparing"); assert.equal(t.travel("8").initiatorId, "8"); assert.deepEqual(t.travel("8").acceptedIds, ["8"]);
        t.service.disconnect("8"); t.time(40000);
        t.arrive("9", "traveller-2"); t.arrive("10", "traveller-1");
        assert.equal(t.service.snapshot("9").groups.length, 0); assert.equal(t.service.snapshot("10").groups.length, 0);
        assert(t.action("9", "join", { code: joinCode }).error);
        t.wellFormed();
    });
    it("keeps someone whose connection dropped in every party, and gives membership, ownership and authorship to the connection they come back on", () => {
        const f = fixture(), groupId = f.create(); f.accept("2"); f.accept("3");
        const destination = { id: "one", title: "Gallery", href: "/spaces/one" };
        assert(!f.action("1", "active-world", { active: true, location: { state: "space", destination } }).error);
        assert(!f.action("1", "message", { groupId, text: "Back in a moment" }).error);
        const second = f.action("1", "create", { name: "Second", memberIds: [] }).groupId;
        const before = JSON.stringify(f.service.snapshot("2").groups), sent = f.events.length;
        f.service.disconnect("1");
        // Nobody is told anything new: they are still listed, exactly as last seen, and still the owner.
        assert.equal(JSON.stringify(f.service.snapshot("2").groups), before); assert.equal(f.events.length, sent);
        assert.deepEqual(f.service.snapshot("2").groups[0].members[0], { id: "1", name: "Guest 1", avatar: "", vrmUrl: "", scale: 1, location: { state: "space", destination } });
        assert.equal(f.service.snapshot("2").groups[0].ownerId, "1");
        // The party carries on meanwhile; what only the owner may do waits for the owner.
        assert(!f.action("2", "message", { groupId, text: "See you soon" }).error);
        assert(f.action("2", "invite", { groupId, inviteeId: "4" }).error);
        f.time(1000 + GROUP_RECONNECT_GRACE_MS - 1);
        // Someone else arriving is not given the place, whatever they are called.
        f.arrive("8", undefined, "Guest 1"); f.arrive("7", "traveller-2");
        assert.equal(f.service.snapshot("8").groups.length, 0); assert.equal(f.service.snapshot("7").groups.length, 0);
        f.arrive("9", "traveller-1");
        const groups = f.service.snapshot("9").groups, group = groups.find(item => item.id === groupId)!;
        assert.deepEqual(groups.map(item => item.id).sort(), [groupId, second].sort());
        assert.deepEqual(group.members.map(member => member.id), ["9", "2", "3"]); assert.equal(group.ownerId, "9");
        assert.deepEqual(group.members[0].location, { state: "lobby" });
        assert.deepEqual(group.messages.map(message => [message.sessionId, message.text]), [["9", "Back in a moment"], ["2", "See you soon"]]);
        assert.equal(groups.find(item => item.id === second)!.ownerId, "9");
        assert.equal(JSON.stringify(f.service.snapshot("2")).includes('"1"'), false, "the id they left behind is named nowhere");
        assert.equal(f.service.snapshot("1").groups.length, 0);
        // The others hear of the new id once, and the place is theirs for good: the old grace no longer runs.
        assert(f.events.slice(sent).some(item => item.id === "3" && item.event === "lobby-groups" && item.data.groups[0].ownerId === "9"));
        f.time(1000 + GROUP_RECONNECT_GRACE_MS + 5000);
        assert.deepEqual(f.service.snapshot("2").groups[0].members.map(member => member.id), ["9", "2", "3"]);
        assert(!f.action("9", "invite", { groupId, inviteeId: "4" }).error);
        assert(!f.action("9", "message", { groupId, text: "I am back" }).error);
        // The very same connection id reported again is taken straight back too; one with no identity is known by nothing else.
        f.arrive("5"); assert(!f.action("5", "join", { code: group.joinCode }).error);
        f.service.disconnect("5"); f.arrive("6");
        assert.equal(f.service.snapshot("6").groups.length, 0);
        f.service.connect("5");
        assert.deepEqual(f.service.snapshot("5").groups[0].members.map(member => member.id), ["9", "2", "3", "5"]);
        assert.equal((f.service as any).absent.size, 0);
        wellFormed(f.events);
    });
    it("lets go of every party when they are not back within the grace, and cleans up a party nobody returns to", () => {
        const f = fixture(), groupId = f.create(); f.accept("2"); f.accept("3");
        const solo = f.action("2", "create", { name: "Solo", memberIds: ["4"] }).groupId;
        const code = f.service.snapshot("2").groups.find(group => group.id === solo)!.joinCode;
        assert.equal(f.service.snapshot("4").invitations.length, 1);
        f.at(3000); f.service.disconnect("1"); f.service.disconnect("2"); f.service.disconnect("2");
        f.time(3000 + GROUP_RECONNECT_GRACE_MS - 1);
        assert.deepEqual(f.service.snapshot("3").groups[0].members.map(member => member.id), ["1", "2", "3"]);
        assert.equal(f.service.snapshot("3").groups[0].ownerId, "1");
        assert.equal(f.service.snapshot("4").invitations[0].groupId, solo);
        const sent = f.events.length;
        f.time(3000 + GROUP_RECONNECT_GRACE_MS);
        // Removed as before, and ownership passes to the member who is here, not to the next one in line who is away too.
        const group = f.service.snapshot("3").groups[0];
        assert.deepEqual(group.members.map(member => member.id), ["3"]); assert.equal(group.ownerId, "3"); assert.equal(group.id, groupId);
        assert(f.events.slice(sent).some(item => item.id === "3" && item.event === "lobby-groups"));
        // The party whose only member never came back is gone, with its link and the invitation into it.
        assert.equal(f.service.snapshot("4").invitations.length, 0);
        assert(f.events.slice(sent).some(item => item.id === "4" && item.event === "lobby-groups" && !item.data.invitations.length));
        assert(f.action("4", "join", { code }).error);
        // Too late is too late: they are newcomers now.
        f.arrive("9", "traveller-1"); f.arrive("10", "traveller-2");
        assert.equal(f.service.snapshot("9").groups.length, 0); assert.equal(f.service.snapshot("10").groups.length, 0);
        // A visitor with no party and no invitation has nothing to hold, and nothing is held.
        f.service.disconnect("4");
        assert.equal((f.service as any).absent.size, 0); assert.equal((f.service as any).groups.size, 1);
        wellFormed(f.events);
    });
    it("keeps invitations to and from someone who is away, and re-addresses them when they come back", () => {
        // The invitee drops before answering: the invitation waits and follows them.
        const f = fixture(), groupId = f.create();
        f.service.disconnect("2"); f.time(5000);
        assert.equal(f.service.snapshot("2").invitations.length, 1);
        f.arrive("9", "traveller-2");
        const [waiting] = f.service.snapshot("9").invitations;
        assert.equal(waiting.groupId, groupId); assert.equal(f.service.snapshot("2").invitations.length, 0);
        assert([...f.events].reverse().find(item => item.id === "9" && item.event === "lobby-groups")!.data.invitations.length === 1, "they are told on arrival");
        assert(!f.action("9", "respond-invite", { invitationId: waiting.id, accepted: true }).error);
        assert.deepEqual(f.service.snapshot("1").groups[0].members.map(member => member.id), ["1", "9"]);
        // The inviter drops: the invitation they sent stays good, and names their new id once they are back.
        f.service.disconnect("1");
        assert.equal(f.service.snapshot("3").invitations[0].inviter.id, "1");
        const sent = f.events.length;
        f.arrive("10", "traveller-1");
        assert.equal(f.service.snapshot("3").invitations[0].inviter.id, "10");
        assert(f.events.slice(sent).some(item => item.id === "3" && item.event === "lobby-groups" && item.data.invitations[0].inviter.id === "10"));
        f.accept("3");
        assert.deepEqual(f.service.snapshot("3").groups[0].members.map(member => member.id), ["10", "9", "3"]);
        // It can also be accepted while the inviter is away. If they never return, what they sent goes with them.
        const g = fixture(); g.create();
        g.service.disconnect("1"); g.accept("2");
        assert.deepEqual(g.service.snapshot("2").groups[0].members.map(member => member.id), ["1", "2"]);
        g.time(1000 + GROUP_RECONNECT_GRACE_MS - 1); assert.equal(g.service.snapshot("3").invitations.length, 1);
        g.time(1000 + GROUP_RECONNECT_GRACE_MS);
        assert.equal(g.service.snapshot("3").invitations.length, 0);
        assert.deepEqual(g.service.snapshot("2").groups[0].members.map(member => member.id), ["2"]); assert.equal(g.service.snapshot("2").groups[0].ownerId, "2");
        // An invitee who never returns loses theirs, and the wait never adds to an invitation's own two minutes.
        const h = fixture(); h.create();
        h.service.disconnect("3"); h.time(1000 + GROUP_RECONNECT_GRACE_MS); h.arrive("9", "traveller-3");
        assert.equal(h.service.snapshot("9").invitations.length, 0);
        h.at(120500); h.service.disconnect("2"); h.time(121000); h.arrive("10", "traveller-2");
        assert.equal(h.service.snapshot("10").invitations.length, 0); assert.equal((h.service as any).invitations.size, 0);
        for (const check of [f, g, h]) wellFormed(check.events);
    });
    it("counts someone who is away against both limits until the grace ends", () => {
        const f = fixture(10); f.create();
        const code = f.service.snapshot("1").groups[0].joinCode;
        for (let id = 2; id <= 8; id++) assert(!f.action(String(id), "join", { code }).error);
        f.service.disconnect("8");
        assert.equal(f.action("9", "join", { code }).error, "This party is full.");
        assert.equal(f.service.snapshot("1").groups[0].members.length, 8);
        f.time(1000 + GROUP_RECONNECT_GRACE_MS);
        assert(!f.action("9", "join", { code }).error);
        assert.deepEqual(f.service.snapshot("1").groups[0].members.map(member => member.id), ["1", "2", "3", "4", "5", "6", "7", "9"]);
        // Four parties each: the places kept while away are the places they come back to, and no fifth.
        const g = fixture();
        for (let index = 0; index < 4; index++) assert(!g.action("1", "create", { name: `Party ${index}`, memberIds: [] }).error);
        g.service.disconnect("1"); g.arrive("9", "traveller-1");
        assert.equal(g.service.snapshot("9").groups.length, 4);
        assert.equal(g.action("9", "create", { name: "Fifth", memberIds: [] }).error, "You can belong to four lobby parties at a time.");
        // The real server never reports a connection twice. Were one that already has parties to be matched, the limit still holds.
        const h = fixture();
        h.arrive("7", "traveller-1");
        for (let index = 0; index < 3; index++) assert(!h.action("7", "create", { name: `Theirs ${index}`, memberIds: [] }).error);
        for (let index = 0; index < 2; index++) assert(!h.action("1", "create", { name: `Dropped ${index}`, memberIds: [] }).error);
        h.service.disconnect("1"); h.service.connect("7");
        assert.deepEqual(h.service.snapshot("7").groups.map(group => group.name), ["Theirs 0", "Theirs 1", "Theirs 2", "Dropped 0"]);
        assert.equal((h.service as any).groups.size, 4); assert.equal((h.service as any).absent.size, 0);
        for (const check of [f, g, h]) wellFormed(check.events);
    });
    it("keeps the trip's party and every other party through the same drop", () => {
        const t = trip(); t.ready("1", "2");
        const other = t.action("2", "create", { name: "Other", memberIds: ["4"] }).groupId;
        t.service.disconnect("2"); t.time(5000); t.arrive("9", "traveller-2");
        assert.deepEqual(t.service.snapshot("9").groups.map(group => group.id), [t.groupId, other]);
        assert.equal(t.travel("9").responses["9"], "accepted"); assert.equal(t.travel("9").waitingFor, undefined);
        assert.equal(t.service.snapshot("4").invitations[0].inviter.id, "9");
        // Not back in time, the trip goes on without them and they leave both parties.
        const u = trip(); u.ready("1", "3");
        const solo = u.action("2", "create", { name: "Solo", memberIds: [] }).groupId;
        u.service.disconnect("2"); u.time(1000 + GROUP_RECONNECT_GRACE_MS);
        assert.equal(u.travel().status, "gathering"); assert.deepEqual(u.travel().acceptedIds, ["1", "3"]);
        assert.deepEqual(u.service.snapshot("1").groups[0].members.map(member => member.id), ["1", "3"]);
        assert.equal((u.service as any).groups.has(solo), false);
        for (const check of [t, u]) check.wellFormed();
    });
    it("rejects cross-origin/malformed destinations and repeated request IDs have one effect", () => {
        const f = fixture(), groupId = f.create();
        for (const href of ["https://evil.test/x", "//evil.test", "/x?redirect=evil", "/../admin", "/x#evil", "/x\\evil"]) {
            assert(f.action("1", "travel-propose", { groupId, destination: { id: "x", title: "X", href } }).error);
        }
        const command = { requestId: "same", action: "message" as const, groupId, text: "Once" };
        f.service.action("1", command); f.service.action("1", command);
        assert.equal(f.service.snapshot("1").groups[0].messages.length, 1);
    });
    it("bounds history and wire snapshot size for long UTF-8 messages and profiles", () => {
        const f = fixture(8);
        for (const member of f.members.values()) { member.avatar = "https://example.com/" + "x".repeat(2000); member.vrmUrl = member.avatar; member.name = "界".repeat(40); }
        for (let i = 0; i < 4; i++) {
            const groupId = f.create(), code = f.service.snapshot("1").groups.find(group => group.id === groupId)!.joinCode;
            for (let id = 2; id <= 8; id++) f.action(String(id), "join", { code });
            for (let m = 0; m < 30; m++) f.action("1", "message", { groupId, text: "界".repeat(500) });
        }
        for (let id = 1; id <= 8; id++) f.action(String(id), "active-world", { active: true, location: { state: "space", destination: { id: "x".repeat(128), title: "界".repeat(80), href: "/spaces/" + "x".repeat(128) } } });
        const snapshot = f.service.snapshot("1");
        assert.equal(snapshot.groups.length, 4);
        assert(Buffer.byteLength(JSON.stringify(snapshot)) < 15000);
        assert(snapshot.groups.every(group => group.messages.length <= 24));
    });
});

describe("worker-owned group formation", () => {
    for (const input of [false, true]) it(`holds authoritative pose against stale and new movement (input: ${input})`, async () => {
        const shared = createSharedWorld(2), messages: any[] = [], posts: any[] = [];
        const gateway = new WorldGateway({ owner: 0, shared, epoch: 1, roomId: "world", region: "local", post: message => posts.push(message) });
        gateway.reserve({ id: 1, slot: 0, owner: 0, token: "group", expires: Date.now() + 10000, profile: { sessionId: "1", username: "Guest", userId: "guest", avatar: "", VRM: "", scale: 1 } });
        await gateway.accept("group", { sendControl: (type, data) => { messages.push({ type, data }); return true; }, sendDatagram: () => true, bufferedAmount: () => 0, close: () => {} });
        gateway.receiveControl("1", "lobby-ready", input ? { movement: "input-v1" } : {});
        const move = (sequence: number) => input ? encodeInputs([{ sequence, strafe: 0, forward: 1, yaw: 0, running: true, jump: true, animation: -1 }]) : encodeMovement({ sequence, x: 99, y: 0, z: 99, yaw: 0, animation: -1, floor: true });
        gateway.receiveDatagram("1", move(1));
        gateway.placeGroup("1", "trip", { x: 5, y: 0, z: 6, rotation: 0.5 }, ["2"], true);
        gateway.receiveDatagram("1", move(2)); gateway.receiveControl("1", "lobby-move", [3, 99, 0, 99, 0, -1, true]); gateway.step();
        const reader = new SharedWorld(shared), pose = blankPose(0); assert(reader.read(0, pose));
        assert.equal(pose.x, 5); assert.equal(pose.z, 6); assert.equal(pose.vx, 0); assert.equal(pose.vz, 0);
        assert(posts.some(post => post.type === "group-placed" && post.actor === 1 && post.travelId === "trip"));
        if (input) assert(messages.some(message => message.type === "lobby-ack" && message.data.resetInputs));
        gateway.groupPresence("1", true); assert.equal(reader.read(0, pose), false);
        gateway.receiveDatagram("1", move(4)); gateway.step(); assert.equal(reader.read(0, pose), false);
        gateway.placeGroup("1", "wrong-trip", { x: 77, y: 0, z: 77, rotation: 0 }, [], false);
        gateway.groupPresence("1", false); assert(reader.read(0, pose)); assert.equal(pose.x, 5);
        gateway.placeGroup("1", "trip", { x: 5, y: 0, z: 6, rotation: 0.5 }, [], false);
        gateway.stop();
    });
});

describe("cross-worker lobby group sockets", function () {
    this.timeout(20000);
    it("routes invitations and private group history across owners, and gives a dropped traveller's place to the admission that is them again", async () => {
        const world = await createWorldServer({ port: 2790, wsBase: 2791, workers: 2, capacity: 6, testMode: true, singlePort: true, webtransport: false });
        const clients: { id: string; token: string; ws: WebSocket; events: any[]; owner: string }[] = [];
        const until = async (predicate: () => boolean) => {
            const deadline = Date.now() + 5000;
            while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 15));
            assert(predicate(), "Timed out waiting for group socket event");
        };
        const connect = async (username: string, admission: any = {}) => {
            const response = await fetch("http://127.0.0.1:2790/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lobbyProtocol: 2, username, ...admission }) });
            const ticket: any = await response.json(), events: any[] = [], ws = new WebSocket(ticket.wsUrl);
            const client = { id: ticket.sessionId, token: ticket.token, ws, events, owner: ticket.wsUrl }; clients.push(client);
            ws.on("open", () => ws.send(JSON.stringify({ type: "session", data: { token: ticket.token } })));
            ws.on("message", (raw: any, binary?: boolean) => {
                if (typeof binary === "boolean" ? binary : typeof raw !== "string") return;
                const message = JSON.parse(raw.toString()); events.push(message);
                if (message.type === "session-accepted") ws.send(JSON.stringify({ type: "lobby-ready", data: { movement: "input-v1" } }));
            });
            await until(() => events.some(event => event.type === "lobby-groups"));
            return client;
        };
        // The second visitor is signed in: every admission of theirs carries a fresh proof of the same account.
        const secret = process.env.LOBBY_IDENTITY_SECRET, account = () => ({ lobbyIdentityToken: mintLobbyIdentity("account-b").token });
        process.env.LOBBY_IDENTITY_SECRET = "group-test-secret-".repeat(2);
        try {
            for (let index = 0; index < 3; index++) await connect(`Socket ${index}`, index === 1 ? account() : {});
            const [a, b, witness] = clients; assert.notEqual(a.owner, b.owner);
            const latest = (client: typeof a) => [...client.events].reverse().find(event => event.type === "lobby-groups")?.data;
            let request = 0;
            const send = async (client: typeof a, action: string, data: any) => {
                const requestId = `socket${++request}`;
                client.ws.send(JSON.stringify({ type: "lobby-group-action", data: { ...data, action, requestId } }));
                await until(() => client.events.some(event => event.type === "lobby-group-result" && event.data.requestId === requestId));
                const result = client.events.find(event => event.type === "lobby-group-result" && event.data.requestId === requestId).data;
                assert(!result.error, result.error);
                return result;
            };
            const { groupId } = await send(a, "create", { name: "Socket group", memberIds: [b.id] });
            await until(() => latest(b).invitations.length === 1);
            assert.equal(latest(witness).invitations.length, 0);
            await send(b, "respond-invite", { invitationId: latest(b).invitations[0].id, accepted: true });
            await send(b, "message", { groupId, text: "Private group socket test", sessionId: witness.id });
            await until(() => latest(a).groups[0]?.messages.length === 1);
            assert.equal(latest(a).groups[0].messages[0].sessionId, b.id);
            assert.equal(latest(witness).groups.length, 0);
            const destination = { id: "gallery", title: "Gallery", href: "/gallery" };
            await send(b, "active-world", { active: true, location: { state: "space", destination } });
            await until(() => latest(a).groups[0].members.find((member: any) => member.id === b.id)?.location?.state === "space");
            assert.deepEqual(latest(a).groups[0].members.find((member: any) => member.id === b.id).location, { state: "space", destination });
            await send(b, "message", { groupId, text: "Still chatting inside the gallery" });
            await until(() => latest(a).groups[0].messages.length === 2);
            assert(!witness.events.some(event => JSON.stringify(event).includes("Still chatting inside the gallery")));
            await send(b, "active-world", { active: false, location: { state: "lobby" } });
            await send(a, "travel-propose", { groupId, destination: { id: "gallery", title: "Gallery", href: "/gallery" } });
            const travelId = latest(a).groups[0].travel.id;
            await send(b, "travel-respond", { groupId, travelId, accepted: true });
            await send(a, "travel-ready", { groupId, travelId, success: true });
            await send(b, "travel-ready", { groupId, travelId, success: true });
            await until(() => latest(a).groups[0].travel.status === "travelling" && latest(b).groups[0].travel.status === "travelling");
            assert.equal(latest(a).groups[0].travel.startAt, latest(b).groups[0].travel.startAt);
            assert(a.events.some(event => event.type === "lobby-group-position" && event.data.held));
            assert(b.events.some(event => event.type === "lobby-group-position" && event.data.held));
            // The initiator's socket drops mid-trip: nobody is sent back, and the trip says who it is waiting for.
            const dropped = Date.now();
            a.ws.close();
            await until(() => latest(b).groups[0].travel.waitingFor?.length === 1);
            const [wait] = latest(b).groups[0].travel.waitingFor;
            assert.equal(wait.id, a.id); assert.equal(wait.name, "Socket 0");
            assert(wait.until >= dropped + GROUP_RECONNECT_GRACE_MS && wait.until <= Date.now() + GROUP_RECONNECT_GRACE_MS);
            assert.equal(latest(b).groups[0].travel.status, "travelling"); assert.equal(latest(b).groups[0].ownerId, a.id);
            assert(latest(b).groups[0].members.some((member: any) => member.id === a.id));
            assert(!b.events.some(event => event.type === "lobby-group-position" && !event.data.held));
            // A fresh admission is a stranger, whatever it calls itself.
            const stranger = await connect("Socket 0");
            assert.equal(latest(stranger).groups.length, 0); assert.equal(latest(b).groups[0].travel.waitingFor.length, 1);
            // One that names the seat it lost is the same traveller under a new session id.
            const back = await connect("Socket 0", { replaceToken: a.token });
            assert.notEqual(back.id, a.id);
            await until(() => latest(b).groups[0].travel.acceptedIds.includes(back.id));
            const resumed = latest(b).groups[0];
            assert.equal(resumed.travel.waitingFor, undefined); assert.equal(resumed.travel.status, "travelling");
            assert.equal(resumed.ownerId, back.id); assert.equal(resumed.travel.initiatorId, back.id);
            assert.deepEqual(resumed.members.map((member: any) => member.id).sort(), [b.id, back.id].sort());
            assert.equal(JSON.stringify(resumed).includes(`"${a.id}"`), false);
            assert.equal(latest(back).groups[0].travel.responses[back.id], "accepted");
            await until(() => back.events.some(event => event.type === "lobby-group-position" && event.data.held && event.data.travelId === travelId));
            await send(b, "travel-cancel", { groupId, travelId });
            await until(() => latest(back).groups[0].travel.status === "cancelled");
            await until(() => [b, back].every(client => client.events.some(event => event.type === "lobby-group-position" && !event.data.held)));
            // A signed-in traveller needs no hint from the browser: the account behind the new admission is the same.
            await send(back, "travel-propose", { groupId, destination });
            const next = latest(back).groups[0].travel.id;
            await send(b, "travel-respond", { groupId, travelId: next, accepted: true });
            b.ws.close();
            await until(() => latest(back).groups[0].travel.waitingFor?.[0]?.id === b.id);
            const member = await connect("Socket 1", account());
            assert.notEqual(member.id, b.id);
            await until(() => latest(back).groups[0].travel.acceptedIds.includes(member.id));
            assert.equal(latest(back).groups[0].travel.waitingFor, undefined); assert.equal(latest(back).groups[0].travel.status, "preparing");
            assert.equal(latest(member).groups[0].travel.responses[member.id], "accepted");
            assert.equal(latest(stranger).groups.length, 0);
        } finally {
            if (secret === undefined) delete process.env.LOBBY_IDENTITY_SECRET; else process.env.LOBBY_IDENTITY_SECRET = secret;
            for (const client of clients) client.ws.terminate();
            await world.close();
        }
    });
    it("gives a party, its chat and its invitations back to the admission that names the seat it lost, with no trip in progress", async () => {
        const world = await createWorldServer({ port: 2796, wsBase: 2797, workers: 2, capacity: 6, testMode: true, singlePort: true, webtransport: false });
        const clients: { id: string; token: string; ws: WebSocket; events: any[]; owner: string }[] = [];
        const until = async (predicate: () => boolean) => {
            const deadline = Date.now() + 5000;
            while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 15));
            assert(predicate(), "Timed out waiting for group socket event");
        };
        const connect = async (username: string, admission: any = {}) => {
            const response = await fetch("http://127.0.0.1:2796/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lobbyProtocol: 2, username, ...admission }) });
            const ticket: any = await response.json(), events: any[] = [], ws = new WebSocket(ticket.wsUrl);
            const client = { id: ticket.sessionId, token: ticket.token, ws, events, owner: ticket.wsUrl }; clients.push(client);
            ws.on("open", () => ws.send(JSON.stringify({ type: "session", data: { token: ticket.token } })));
            ws.on("message", (raw: any, binary?: boolean) => {
                if (typeof binary === "boolean" ? binary : typeof raw !== "string") return;
                const message = JSON.parse(raw.toString()); events.push(message);
                if (message.type === "session-accepted") ws.send(JSON.stringify({ type: "lobby-ready", data: { movement: "input-v1" } }));
            });
            await until(() => events.some(event => event.type === "lobby-groups"));
            return client;
        };
        const latest = (client: (typeof clients)[number]) => [...client.events].reverse().find(event => event.type === "lobby-groups")?.data;
        let request = 0;
        const send = async (client: (typeof clients)[number], action: string, data: any) => {
            const requestId = `party${++request}`;
            client.ws.send(JSON.stringify({ type: "lobby-group-action", data: { ...data, action, requestId } }));
            await until(() => client.events.some(event => event.type === "lobby-group-result" && event.data.requestId === requestId));
            const result = client.events.find(event => event.type === "lobby-group-result" && event.data.requestId === requestId).data;
            assert(!result.error, result.error);
            return result;
        };
        try {
            for (let index = 0; index < 3; index++) await connect(`Party ${index}`);
            const [a, b, invitee] = clients; assert.notEqual(a.owner, b.owner);
            const { groupId } = await send(a, "create", { name: "Blip party", memberIds: [b.id, invitee.id] });
            await until(() => latest(b).invitations.length === 1 && latest(invitee).invitations.length === 1);
            await send(b, "respond-invite", { invitationId: latest(b).invitations[0].id, accepted: true });
            await send(a, "message", { groupId, text: "Before the blip" });
            await until(() => latest(b).groups[0]?.messages.length === 1);
            // The owner's socket drops outside any trip: they stay listed, still the owner, and the chat goes on.
            a.ws.close();
            await new Promise(resolve => setTimeout(resolve, 300));
            await send(b, "message", { groupId, text: "While you were away" });
            await until(() => latest(b).groups[0].messages.length === 2);
            assert.equal(latest(b).groups[0].ownerId, a.id);
            assert(latest(b).groups[0].members.some((member: any) => member.id === a.id));
            assert.equal(latest(invitee).invitations[0].inviter.id, a.id);
            const back = await connect("Party 0", { replaceToken: a.token });
            assert.notEqual(back.id, a.id);
            await until(() => latest(b).groups[0].ownerId === back.id && latest(invitee).invitations[0]?.inviter.id === back.id);
            const party = latest(back).groups[0];
            assert.equal(party.id, groupId); assert.equal(party.ownerId, back.id);
            assert.deepEqual(party.members.map((member: any) => member.id).sort(), [b.id, back.id].sort());
            assert.deepEqual(party.messages.map((message: any) => [message.sessionId, message.text]), [[back.id, "Before the blip"], [b.id, "While you were away"]]);
            assert.equal(JSON.stringify(latest(b)).includes(`"${a.id}"`), false);
            // The invitation they sent is good: accepting it joins the party they are back in.
            await send(invitee, "respond-invite", { invitationId: latest(invitee).invitations[0].id, accepted: true });
            await until(() => latest(back).groups[0].members.length === 3);
            for (const client of clients) wellFormed(client.events.map(event => ({ id: client.id, event: event.type, data: event.data })));
        } finally {
            for (const client of clients) client.ws.terminate();
            await world.close();
        }
    });
});
