/**
 * A party leaves together: when one member starts the trip back to the
 * lobby, the others are offered to follow. The notice travels through the
 * party's own room on the relay, between pages; games never see or send it.
 */
const KIND = "party-leave";
const NAME_MAX = 24;

export interface PartyLeaveNotice {
    name: string;
}

export function partyLeavePacket(name: string) {
    return {
        oncyber: KIND,
        name: String(name || "")
            .trim()
            .slice(0, NAME_MAX),
    };
}

/** A relayed packet that is a leave notice, or null for a game's packet. */
export function readPartyLeave(data: unknown): PartyLeaveNotice | null {
    const packet = data as { oncyber?: unknown; name?: unknown } | null;
    if (!packet || typeof packet !== "object" || packet.oncyber !== KIND)
        return null;
    const name =
        typeof packet.name === "string"
            ? packet.name.trim().slice(0, NAME_MAX)
            : "";
    return { name: name || "Someone" };
}

/**
 * The relay is rate limited and drops a packet sent too soon after another,
 * so keep trying for a moment until the room takes it. Returns a cancel.
 */
export function announcePartyLeave(
    relay: (data: unknown) => boolean,
    name: string,
    { tries = 6, everyMs = 250 } = {}
) {
    const packet = partyLeavePacket(name);
    let left = tries;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = () => {
        timer = undefined;
        if (relay(packet) || --left <= 0) return;
        timer = setTimeout(attempt, everyMs);
    };
    attempt();
    return () => clearTimeout(timer);
}

/** Who the offer names: every member who has left so far, by room id. */
export type PartyLeaveOffer = { leavers: Array<{ id: string; name: string }> };

export function offerPartyLeave(
    offer: PartyLeaveOffer | null,
    from: string,
    notice: PartyLeaveNotice
): PartyLeaveOffer {
    const leavers = (offer?.leavers ?? []).filter((l) => l.id !== from);
    return { leavers: [...leavers, { id: from, name: notice.name }] };
}

export function partyLeaveText(offer: PartyLeaveOffer) {
    const names = offer.leavers.map((l) => l.name);
    if (names.length === 1) return `${names[0]} is heading back to the lobby.`;
    if (names.length === 2)
        return `${names[0]} and ${names[1]} are heading back to the lobby.`;
    return `${names[0]} and ${
        names.length - 1
    } others are heading back to the lobby.`;
}
