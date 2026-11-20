import {
    announcePartyLeave,
    offerPartyLeave,
    partyLeavePacket,
    partyLeaveText,
    readPartyLeave,
} from "./gamePartyLeave";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("a notice round-trips and a game's packets are not notices", () => {
    expect(readPartyLeave(partyLeavePacket("  Ada  "))).toEqual({
        name: "Ada",
    });
    expect(readPartyLeave(partyLeavePacket(""))).toEqual({ name: "Someone" });
    expect(readPartyLeave({ t: "serve", name: "Ada" })).toBeNull();
    expect(readPartyLeave(null)).toBeNull();
    expect(readPartyLeave("party-leave")).toBeNull();
    expect(
        readPartyLeave({ oncyber: "party-leave", name: "x".repeat(200) }).name
    ).toHaveLength(24);
});

test("the notice is retried until the rate-limited relay takes it", () => {
    const results = [false, false, true];
    const sent: unknown[] = [];
    announcePartyLeave((data) => {
        sent.push(data);
        return results.shift() ?? true;
    }, "Ada");
    expect(sent).toHaveLength(1);
    jest.advanceTimersByTime(250);
    jest.advanceTimersByTime(250);
    expect(sent).toHaveLength(3);
    jest.advanceTimersByTime(5000);
    expect(sent).toHaveLength(3);
    expect(sent[2]).toEqual({ oncyber: "party-leave", name: "Ada" });
});

test("the notice gives up when the room never takes it", () => {
    let calls = 0;
    announcePartyLeave(() => (calls++, false), "Ada", { tries: 3 });
    jest.advanceTimersByTime(5000);
    expect(calls).toBe(3);
});

test("the offer names everyone who has left, once each", () => {
    let offer = offerPartyLeave(null, "a", { name: "Ada" });
    expect(partyLeaveText(offer)).toBe("Ada is heading back to the lobby.");
    offer = offerPartyLeave(offer, "b", { name: "Bo" });
    offer = offerPartyLeave(offer, "a", { name: "Ada" });
    expect(offer.leavers.map((l) => l.id)).toEqual(["b", "a"]);
    expect(partyLeaveText(offer)).toBe(
        "Bo and Ada are heading back to the lobby."
    );
    offer = offerPartyLeave(offer, "c", { name: "Cy" });
    expect(partyLeaveText(offer)).toBe(
        "Bo and 2 others are heading back to the lobby."
    );
});
