import {
    GROUP_RECONNECT_GRACE_MS,
    LobbyGroups,
} from "../../../multiplayer/src/world/groups";
import { readLobbyGroups } from "./lobbyGroupValidation";

/**
 * The lobby client drops any party snapshot its strict reader rejects, so a
 * party kept through a dropped connection must still read as valid at every
 * step: while someone is away, when they come back under a new session id,
 * and when the grace runs out. These scenarios drive the real coordinator.
 */
function world(count = 4) {
    let now = 1000,
        sequence = 0;
    const events: { id: string; event: string; data: any }[] = [];
    const members = new Map<string, any>();
    const identities = new Map<string, string>();
    const service = new LobbyGroups({
        member: (id) => members.get(id),
        pose: (id) => ({ x: Number(id) * 10, y: 0, z: 4, rotation: 0.2 }),
        send: (id, event, data) => events.push({ id, event, data }),
        place: () => undefined,
        activeWorld: () => undefined,
        identity: (id) => identities.get(id),
        now: () => now,
    });
    const arrive = (id: string, identity = `traveller-${id}`) => {
        members.set(id, {
            id,
            name: `Guest ${id}`,
            avatar: "/avatar.png",
            vrmUrl: "/model.vrm",
            scale: 1,
        });
        identities.set(id, identity);
        service.connect(id);
    };
    for (let index = 1; index <= count; index++) arrive(String(index));
    const action = (actor: string, name: string, data: any = {}) => {
        const requestId = `request${++sequence}`;
        service.action(actor, { ...data, action: name, requestId });
        const result = [...events]
            .reverse()
            .find(
                (item) =>
                    item.id === actor &&
                    item.event === "lobby-group-result" &&
                    item.data.requestId === requestId
            ).data;
        expect(result.error).toBeUndefined();
        return result;
    };
    const accept = (id: string) =>
        action(id, "respond-invite", {
            invitationId: service.snapshot(id).invitations[0].id,
            accepted: true,
        });
    const time = (value: number) => {
        now = value;
        service.tick();
    };
    /** Every snapshot sent so far, and the one each person would read now. */
    const allRead = () => {
        const sent = events.filter((item) => item.event === "lobby-groups");
        expect(sent.length).toBeGreaterThan(0);
        for (const { id, data } of sent)
            expect(readLobbyGroups(data, id)).not.toBeNull();
        for (const id of members.keys())
            expect(readLobbyGroups(service.snapshot(id), id)).not.toBeNull();
    };
    return { service, action, accept, arrive, time, allRead, events };
}
const destination = { id: "one", title: "Gallery", href: "/spaces/one" };

describe("party snapshots through a dropped connection", () => {
    it("read as valid while a member is away and after they come back", () => {
        const w = world();
        const { groupId } = w.action("1", "create", {
            name: "Friends",
            memberIds: ["2", "3"],
        });
        w.accept("2");
        w.accept("3");
        w.action("1", "active-world", {
            active: true,
            location: { state: "space", destination },
        });
        w.action("1", "message", { groupId, text: "Back in a moment" });
        w.action("1", "create", { name: "Second", memberIds: ["4"] });
        w.service.disconnect("1");
        w.action("2", "message", { groupId, text: "See you soon" });
        w.time(1000 + GROUP_RECONNECT_GRACE_MS - 1);
        w.arrive("9", "traveller-1");
        const back = readLobbyGroups(w.service.snapshot("9"), "9");
        expect(back.groups.map((group) => group.ownerId)).toEqual(["9", "9"]);
        expect(back.groups[0].messages.map((m) => m.sessionId)).toEqual([
            "9",
            "2",
        ]);
        expect(
            readLobbyGroups(w.service.snapshot("4"), "4").invitations[0].inviter
                .id
        ).toBe("9");
        w.allRead();
    });

    it("read as valid when the grace runs out, for owners and lone members", () => {
        const w = world();
        const { groupId } = w.action("1", "create", {
            name: "Friends",
            memberIds: ["2"],
        });
        w.accept("2");
        w.action("3", "create", { name: "Solo", memberIds: ["4"] });
        w.service.disconnect("1");
        w.service.disconnect("3");
        w.time(1000 + GROUP_RECONNECT_GRACE_MS);
        const left = readLobbyGroups(w.service.snapshot("2"), "2");
        expect(left.groups[0].id).toBe(groupId);
        expect(left.groups[0].ownerId).toBe("2");
        expect(w.service.snapshot("4").invitations).toEqual([]);
        w.allRead();
    });

    it("read as valid around a trip while someone is away", () => {
        const w = world();
        const { groupId } = w.action("1", "create", {
            name: "Friends",
            memberIds: ["2", "3"],
        });
        w.accept("2");
        w.accept("3");
        w.action("1", "travel-propose", { groupId, destination });
        const travelId = w.service.snapshot("1").groups[0].travel.id;
        w.action("2", "travel-respond", {
            groupId,
            travelId,
            accepted: true,
        });
        // 2 is waited for; 3 had not answered and counts as declined.
        w.service.disconnect("2");
        w.service.disconnect("3");
        const waiting = readLobbyGroups(w.service.snapshot("1"), "1");
        expect(waiting.groups[0].travel.waitingFor.map((x) => x.id)).toEqual([
            "2",
        ]);
        w.arrive("9", "traveller-2");
        w.action("1", "travel-cancel", { groupId, travelId });
        // A new trip neither asks nor waits for 3, who is still away.
        w.action("1", "travel-propose", { groupId, destination });
        expect(w.service.snapshot("1").groups[0].travel.responses).toEqual({
            "1": "accepted",
            "9": "pending",
            "3": "declined",
        });
        w.arrive("10", "traveller-3");
        w.time(1000 + GROUP_RECONNECT_GRACE_MS);
        w.allRead();
    });

    it("read as valid at both limits", () => {
        const w = world(9);
        const { groupId } = w.action("1", "create", {
            name: "Full",
            memberIds: [],
        });
        const code = w.service.snapshot("1").groups[0].joinCode;
        for (let id = 2; id <= 8; id++) w.action(String(id), "join", { code });
        for (let index = 0; index < 3; index++)
            w.action("8", "create", { name: `Party ${index}`, memberIds: [] });
        w.service.disconnect("8");
        w.arrive("20", "traveller-8");
        const back = readLobbyGroups(w.service.snapshot("20"), "20");
        expect(back.groups.length).toBe(4);
        expect(back.groups.find((g) => g.id === groupId).members.length).toBe(
            8
        );
        w.allRead();
    });
});
