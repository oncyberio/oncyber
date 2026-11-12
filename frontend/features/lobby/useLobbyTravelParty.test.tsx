/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import useLobbyTravelParty, { retainedLobbyPartyIds, prepareLobbyPartyTravel } from "./useLobbyTravelParty";
const alice = "A".repeat(43), bob = "B".repeat(43), carol = "C".repeat(43);
const player = (id: string, extra = {}) => ({ id, name: "Same Name", isLocal: false, ...extra } as any);
const party = { partyId: "party", isLeader: true, selfIdentity: alice, memberIds: [alice, bob] };
const destination = { id: "card", title: "Selected world", href: "/s@world" };

test("retains self and only current server-stamped group connections, ignoring raw IDs and duplicate names", () => {
    expect(retainedLobbyPartyIds([
        player("self", { isLocal: true }), player("bob-session", { partyIdentity: bob }),
        player("impostor", { userId: bob }), player("outsider", { partyIdentity: carol }),
        player("second-tab", { partyIdentity: bob }), player("other-self-tab", { partyIdentity: alice }),
    ], party)).toEqual(["self", "bob-session"]);
    expect(retainedLobbyPartyIds([player("self", { isLocal: true }), player("bob-session", { partyIdentity: bob })], { memberIds: [], isLeader: false })).toEqual(["self"]);
});

test("solo native destinations pass through; members can follow only the actual allocated group destination", async () => {
    const move = jest.fn(); const native = { id: "native", title: "Gallery", href: "/gallery" };
    expect(await prepareLobbyPartyTravel(native, { memberIds: [], isLeader: false }, move)).toBe(native);
    expect(move).not.toHaveBeenCalled();
    await expect(prepareLobbyPartyTravel(destination, { ...party, isLeader: false }, move)).rejects.toThrow("party leader");
    const current = { experienceId: "world", instanceId: "actual", url: "/s@world" };
    expect(await prepareLobbyPartyTravel(destination, { ...party, isLeader: false, destination: current }, move)).toEqual({ ...destination, id: "world" });
    expect(move).not.toHaveBeenCalled();
});

test("leader selection waits for authoritative allocation and uses the canonical returned URL", async () => {
    let complete: any;
    const move = jest.fn(() => new Promise<any>(resolve => { complete = resolve; }));
    let settled = false;
    const selected = prepareLobbyPartyTravel({ ...destination, href: "/custom-link" }, party, move).then(value => { settled = true; return value; });
    await Promise.resolve(); expect(settled).toBe(false); expect(move).toHaveBeenCalledWith("custom-link");
    complete({ ...party, destination: { experienceId: "canonical", instanceId: "reserved", url: "/s@canonical" } });
    expect(await selected).toEqual({ ...destination, id: "canonical", href: "/s@canonical" });
    await expect(prepareLobbyPartyTravel(destination, party, async () => ({ ...party, partyId: "other", destination: { experienceId: "world", url: "/s@world", instanceId: "reserved" } }))).rejects.toThrow("could not reserve");
});

let root: ReturnType<typeof createRoot>, container: HTMLDivElement, hook: ReturnType<typeof useLobbyTravelParty>;
const players = [player("self", { isLocal: true }), player("bob-session", { partyIdentity: bob })];
function Harness({ enabled = true, identityKey = "alice" }) { hook = useLobbyTravelParty({ enabled, players, identityKey }); return null; }
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); root = createRoot(container); });
afterEach(() => act(() => root.unmount()));
const answer = (value: any) => ({ ok: true, json: async () => value });

test("membership failures clear previously approved participants; disabled state stays self-only", async () => {
    global.fetch = jest.fn().mockResolvedValue(answer(party));
    await act(async () => { root.render(<Harness />); });
    expect(hook.partyIds).toEqual(["self", "bob-session"]);
    (fetch as jest.Mock).mockRejectedValue(new Error("offline"));
    await act(async () => { await hook.refresh().catch(() => {}); });
    expect(hook.status).toBe("unavailable"); expect(hook.partyIds).toEqual(["self"]);
    act(() => root.render(<Harness enabled={false} />));
    expect(hook.partyIds).toEqual(["self"]);
});

test("a late response from an old account cannot restore its party after identity changes", async () => {
    let old: any;
    global.fetch = jest.fn().mockImplementationOnce(() => new Promise(resolve => { old = resolve; })).mockResolvedValue(answer({ memberIds: [], isLeader: false }));
    await act(async () => { root.render(<Harness />); });
    await act(async () => { root.render(<Harness identityKey="carol" />); });
    await act(async () => { old(answer(party)); });
    expect(hook.partyIds).toEqual(["self"]); expect(hook.partyId).toBeUndefined();
});


test("stale preparation cannot initiate a group move using a newly selected account", async () => {
    global.fetch = jest.fn().mockResolvedValue(answer(party));
    await act(async () => { root.render(<Harness />); });
    let complete: any;
    (fetch as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; })).mockResolvedValue(answer({ memberIds: [], isLeader: false }));
    let preparing: Promise<any>;
    act(() => { preparing = hook.prepareTravel(destination); });
    const result = preparing.then(() => "unexpected", error => error.message);
    await act(async () => { root.render(<Harness identityKey="carol" />); });
    await act(async () => { complete(answer(party)); });
    expect(await result).toMatch(/changed/);
    expect((fetch as jest.Mock).mock.calls.some(call => call[0] === "/api/social/parties")).toBe(false);
});
