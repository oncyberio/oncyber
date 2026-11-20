/**
 * The game's end of the page's party messages, for any game in the frame
 * (on the lifecycle or not): the party it arrived with, the room's roster
 * with its events, and the real-time match channel.
 *
 * There is one party message. The roster is part of the trip the page
 * hands a game in `enter` and again in `party` whenever it changes
 * (`trip.roster`, contract.ts); the link reads it from there and turns
 * each change into events.
 *
 *     const link = createPartyLink();
 *     link.on("dropped", ({ member }) => standIn(member.id));
 *     link.on("host", ({ self }) => self && takeOver());
 *     link.on("match", (packet) => apply(packet));
 *     link.channel.state(snapshot); link.channel.pump(); // each frame
 *
 * Messages (`oncyber:game:<kind>`): page to game `enter`, `party`, `match`,
 * `match-limit`, `party-probe`; game to page `match`, `party-report`. Pass
 * a game id only for a build from before the contract, which says
 * `<id>:<kind>`; the link answers in the form the page spoke.
 */
import { GAME_MESSAGE_PREFIX } from "./contract.ts";
import { createMatchChannel, type MatchPacket } from "./match.ts";
import {
    EMPTY_ROSTER,
    readRoster,
    rosterEvents,
    type Roster,
    type RosterEvent,
} from "./roster.ts";

export interface LinkParty {
    id: string;
    size: number;
    members: { id: string; name: string }[];
}
/** What a game tells the check (and anyone debugging) about its party play. */
export interface PartyReport {
    /** Options on offer right now; `solo` marks the one that needs nobody else. */
    options: { id: string; solo: boolean }[];
    /** Where the game is: "menu", "match", "results", ... */
    phase: string;
    /** The match being played or watched, if any. */
    match: null | {
        format: string;
        players: string[];
        authority: string;
        role: "authority" | "guest" | "spectator" | "solo";
        /** Grows while the match is being played; the check watches it move. */
        progress: number;
        /** Members whose seat a stand-in (a CPU) is holding. */
        standIns: string[];
    };
}
type Handlers = {
    party: (party: LinkParty | null) => void;
    roster: (roster: Roster, events: RosterEvent[]) => void;
    match: (packet: MatchPacket) => void;
    choose: (option: string) => void;
} & {
    [K in RosterEvent["type"]]: (
        event: Extract<RosterEvent, { type: K }>,
        roster: Roster
    ) => void;
};

/** The visitor's party: { id, size, members: [{ id, name }] }, or null. */
export function readLinkParty(value: any): LinkParty | null {
    if (!value || typeof value.id !== "string" || !Array.isArray(value.members))
        return null;
    const members = value.members
        .slice(0, 7)
        .filter((m: any) => m && typeof m.id === "string" && m.id)
        .map((m: any) => ({
            id: m.id.slice(0, 64),
            name:
                typeof m.name === "string" && m.name.trim()
                    ? m.name.trim().slice(0, 24)
                    : "Player",
        }));
    if (!members.length) return null;
    return { id: value.id.slice(0, 96), size: members.length + 1, members };
}

export function createPartyLink(game = "", scope: Window = window) {
    const forms = [GAME_MESSAGE_PREFIX, ...(game ? [`${game}:`] : [])];
    let prefix = forms[0];
    const page = scope.parent;
    const embedded = page !== scope;
    const checking = new URLSearchParams(scope.location.search).has("check");
    const listeners: { [K in keyof Handlers]?: Handlers[K][] } = {};
    const fire = <K extends keyof Handlers>(
        type: K,
        ...args: Parameters<Handlers[K]>
    ) => {
        for (const handler of listeners[type] ?? [])
            (handler as (...a: unknown[]) => void)(...args);
    };
    const post = (kind: string, data: object) => {
        // As connectPage: the frame's URL shares the page's origin.
        if (embedded)
            page.postMessage(
                { type: prefix + kind, ...data },
                scope.location.origin
            );
    };
    const channel = createMatchChannel({
        post: (packet, to) =>
            post("match", to ? { data: packet, to } : { data: packet }),
    });
    let reporter: (() => PartyReport) | null = null;
    const link = {
        embedded,
        party: null as LinkParty | null,
        roster: EMPTY_ROSTER,
        channel,
        on<K extends keyof Handlers>(type: K, handler: Handlers[K]) {
            (listeners[type] ??= [] as never).push(handler);
            return () => {
                const list = listeners[type] as Handlers[K][] | undefined;
                const at = list?.indexOf(handler) ?? -1;
                if (at >= 0) list!.splice(at, 1);
            };
        },
        /** The facts `pnpm games:check` asks for; see docs/games/party.md. */
        report(build: () => PartyReport) {
            reporter = build;
        },
        dispose() {
            scope.removeEventListener("message", receive);
        },
    };
    /** The trip from `enter` or `party`: who travelled, and the room's roster. */
    function trip(value: any) {
        const party = readLinkParty(value);
        if (JSON.stringify(party) !== JSON.stringify(link.party)) {
            link.party = party;
            fire("party", party);
        }
        const next = party ? readRoster(value.roster) : EMPTY_ROSTER;
        if (JSON.stringify(next) === JSON.stringify(link.roster)) return;
        const previous = link.roster === EMPTY_ROSTER ? null : link.roster;
        const events = rosterEvents(previous, next);
        link.roster = next;
        for (const e of events) {
            // A returning member's packets start again from a low sequence.
            if (e.type === "returned" || e.type === "left")
                channel.forget(e.member.id);
            (fire as (type: string, ...args: unknown[]) => void)(
                e.type,
                e,
                next
            );
        }
        fire("roster", next, events);
    }
    function receive(event: MessageEvent) {
        if (event.source !== page || event.origin !== scope.location.origin)
            return;
        const data = event.data ?? {};
        const form =
            typeof data.type === "string"
                ? forms.find((f) => data.type.startsWith(f))
                : undefined;
        if (!form) return;
        const kind = data.type.slice(form.length);
        prefix = form;
        if (kind === "enter") trip(data.trip);
        else if (kind === "party") trip(data.party);
        else if (kind === "match") {
            const packet = channel.receive(data.from, data.data);
            if (packet) fire("match", packet);
        } else if (kind === "match-limit") {
            channel.limited(data.dropped);
        } else if (kind === "party-probe") {
            // Only a check may drive the game's choices from outside.
            if (
                data.op === "choose" &&
                checking &&
                typeof data.option === "string"
            )
                fire("choose", data.option);
            let report: PartyReport | null = null;
            try {
                report = reporter?.() ?? null;
            } catch {
                report = null;
            }
            post("party-report", { id: data.id, report });
        }
    }
    scope.addEventListener("message", receive);
    return link;
}
export type PartyLink = ReturnType<typeof createPartyLink>;
