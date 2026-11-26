/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";

const mockReport = jest.fn(async (_input: unknown) => ({
    recorded: true,
    outcome: "win",
    standing: null,
}));
jest.mock("@api/games/_api", () => ({
    __esModule: true,
    default: {
        reportResult: (input: unknown) => mockReport(input),
        leaderboard: async () => ({ entries: [] }),
    },
}));

import {
    partyResultPacket,
    resultOutcome,
    summarizeGameResult,
} from "./gameResults";
import { useGameResults } from "./useGameResults";

// A 1 v 1 between room members m1 and m2, as each one's game reports it.
const versus = (self: "m1" | "m2", winner = 0) =>
    ({
        match: "v_0123456789",
        format: "singles",
        durationSeconds: 90,
        teams: [
            {
                score: 2,
                players: [
                    {
                        id: "m1",
                        name: "Ada",
                        kind: self === "m1" ? "self" : "peer",
                    },
                ],
            },
            {
                score: 1,
                players: [
                    {
                        id: "m2",
                        name: "Bo",
                        kind: self === "m2" ? "self" : "peer",
                    },
                ],
            },
        ],
        winner,
    } as any);
const solo = {
    match: "s_0123456789",
    format: "solo",
    durationSeconds: 60,
    teams: [
        { score: 2, players: [{ id: "m1", name: "Ada", kind: "self" }] },
        { score: 0, players: [{ id: "cpu-pro", name: "Rally", kind: "cpu" }] },
    ],
    winner: 0,
};
const roster = {
    self: "m1",
    members: [
        { id: "m1", session: "s1" },
        { id: "m2", session: "s2" },
    ],
};

function mount(more: { recorded?: boolean } = {}) {
    const sent: any[] = [];
    const relayed: any[] = [];
    let current: ReturnType<typeof useGameResults>;
    function Probe() {
        current = useGameResults({
            game: "ace",
            fromGame: () => true,
            send: (message) => sent.push(message),
            signedIn: () => true,
            selfName: () => "Ada",
            partyRoom: { relay: (data: unknown) => relayed.push(data) } as any,
            roster: () => roster,
            ...more,
        });
        return null;
    }
    const root = createRoot(document.createElement("div"));
    mounted.push(root);
    act(() => root.render(<Probe />));
    const hook = {
        result: {
            get current() {
                return current;
            },
        },
    };
    const game = (result: unknown) =>
        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: { type: "oncyber:game:result", result },
                })
            );
        });
    const peer = (result: any, from = "s2") =>
        act(() => {
            hook.result.current.fromParty(
                partyResultPacket(
                    summarizeGameResult(result),
                    resultOutcome(result)
                ),
                from
            );
        });
    return { hook, sent, relayed, game, peer };
}

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
async function waitFor(check: () => void, ms = 3000) {
    const deadline = Date.now() + ms;
    for (;;) {
        try {
            return check();
        } catch (error) {
            if (Date.now() > deadline) throw error;
        }
        await act(() => new Promise((done) => setTimeout(done, 20)));
    }
}

const mounted: Array<ReturnType<typeof createRoot>> = [];
beforeEach(() => mockReport.mockClear());
afterEach(() => {
    for (const root of mounted.splice(0)) act(() => root.unmount());
});

describe("a game whose results the site does not record", () => {
    it("shows the card, tells the party and the game, and sends nothing", async () => {
        // A game published from outside the repository
        // (docs/games/publishing.md).
        const { game, sent, relayed, hook } = mount({ recorded: false });
        game(solo);
        expect(sent.at(-1)).toMatchObject({
            type: "ace:result-status",
            match: solo.match,
            status: "unrecorded",
            reason: "NOT_RECORDED",
        });
        expect(relayed).toHaveLength(1);
        expect(hook.result.current.card).toBeTruthy();
        await act(() => new Promise((done) => setTimeout(done, 50)));
        expect(mockReport).not.toHaveBeenCalled();
    });
});

describe("party-agreed results on the page", () => {
    it("marks a match agreed when the other player's page reports the same", async () => {
        const { game, peer, relayed, sent } = mount();
        peer(versus("m2"));
        game(versus("m1"));
        await waitFor(() => expect(mockReport).toHaveBeenCalledTimes(1));
        expect(mockReport.mock.calls[0][0]).toMatchObject({
            game: "ace",
            agreedBy: ["m1", "m2"],
        });
        // The visitor's own outcome went to the party's room for the others.
        expect(relayed[0]).toMatchObject({
            type: "oncyber:party-result",
            outcome: resultOutcome(versus("m1")),
        });
        await waitFor(() =>
            expect(sent.at(-1)).toMatchObject({ status: "recorded" })
        );
    });

    it("waits for the other report, and takes it only from the room's sender", async () => {
        const { game, peer } = mount();
        game(versus("m1"));
        // Someone the room doesn't seat as m2 can't speak for m2.
        peer(versus("m2"), "s9");
        expect(mockReport).not.toHaveBeenCalled();
        peer(versus("m2"));
        await waitFor(() => expect(mockReport).toHaveBeenCalledTimes(1));
        expect(mockReport.mock.calls[0][0]).toMatchObject({
            agreedBy: ["m1", "m2"],
        });
    });

    it("leaves a disputed match and a solo match unverified", async () => {
        const disputed = mount();
        disputed.peer(versus("m2", 1));
        disputed.game(versus("m1"));
        await waitFor(() => expect(mockReport).toHaveBeenCalledTimes(1));
        expect(mockReport.mock.calls[0][0]).not.toHaveProperty("agreedBy");
        const alone = mount();
        alone.game(solo);
        await waitFor(() =>
            expect(
                mockReport.mock.calls.map(([input]: any) => input.result.match)
            ).toContain(solo.match)
        );
        for (const [input] of mockReport.mock.calls)
            expect(input).not.toHaveProperty("agreedBy");
    });
});
