import {
    OUTCOME_MAX_LENGTH,
    canonicalOutcome,
    judgePartyResult,
    leaderboardEligible,
} from "./resultTrust";

// An Ace 1 v 1 as each client would report it: ids are room ids.
const aceSingles = {
    format: "singles",
    winner: "room-a",
    sets: [
        [6, 3],
        [6, 4],
    ],
};
const sameInAnotherKeyOrder = {
    sets: [
        [6, 3],
        [6, 4],
    ],
    winner: "room-a",
    format: "singles",
};

describe("canonical outcomes", () => {
    it("is the same text whatever the key order", () => {
        expect(canonicalOutcome(aceSingles)).toBe(
            canonicalOutcome(sameInAnotherKeyOrder)
        );
        expect(canonicalOutcome({ b: -0, a: [true, null, "x"] })).toBe(
            '{"a":[true,null,"x"],"b":0}'
        );
    });

    it("keeps array order: a different score is a different outcome", () => {
        expect(canonicalOutcome([6, 3])).not.toBe(canonicalOutcome([3, 6]));
    });

    it.each([
        ["a non-finite number", { score: Infinity }],
        ["NaN", NaN],
        ["undefined", { winner: undefined }],
        ["a function", { winner: () => "me" }],
        ["a class instance", new Date(0)],
        [
            "a deep graph",
            { a: { b: { c: { d: { e: { f: { g: { h: { i: 1 } } } } } } } } },
        ],
        ["a large outcome", "x".repeat(OUTCOME_MAX_LENGTH)],
    ])("rejects %s", (_label, value) => {
        expect(() => canonicalOutcome(value)).toThrow();
    });
});

describe("party-agreed results", () => {
    it("agrees when every member reported the same outcome", () => {
        const verdict = judgePartyResult(
            ["room-b", "room-a"],
            [
                { member: "room-a", outcome: aceSingles },
                { member: "room-b", outcome: sameInAnotherKeyOrder },
            ]
        );
        expect(verdict).toEqual({
            status: "agreed",
            trust: "party-agreed",
            outcome: aceSingles,
            members: ["room-a", "room-b"],
            missing: [],
            dissenting: [],
        });
        expect(leaderboardEligible(verdict.trust)).toBe(true);
    });

    it("a solo result is unverified and never ranked", () => {
        const verdict = judgePartyResult(
            ["room-a"],
            [{ member: "room-a", outcome: aceSingles }]
        );
        expect(verdict.status).toBe("solo");
        expect(verdict.trust).toBe("solo-unverified");
        expect(verdict.outcome).toBeNull();
        expect(leaderboardEligible(verdict.trust)).toBe(false);
    });

    it("a member can't make a party by listing itself twice", () => {
        expect(judgePartyResult(["room-a", "room-a", ""], []).status).toBe(
            "solo"
        );
    });

    it("waits for every member: one silent client blocks agreement", () => {
        const verdict = judgePartyResult(
            ["room-a", "room-b", "room-c"],
            [
                { member: "room-a", outcome: aceSingles },
                { member: "room-b", outcome: aceSingles },
            ]
        );
        expect(verdict.status).toBe("incomplete");
        expect(verdict.missing).toEqual(["room-c"]);
        expect(leaderboardEligible(verdict.trust)).toBe(false);
    });

    it("one member claiming the win for itself disputes the result", () => {
        const verdict = judgePartyResult(
            ["room-a", "room-b", "room-c"],
            [
                { member: "room-a", outcome: aceSingles },
                { member: "room-b", outcome: aceSingles },
                {
                    member: "room-c",
                    outcome: { ...aceSingles, winner: "room-c" },
                },
            ]
        );
        expect(verdict.status).toBe("disputed");
        expect(verdict.dissenting).toEqual(["room-c"]);
        expect(verdict.outcome).toBeNull();
        expect(leaderboardEligible(verdict.trust)).toBe(false);
    });

    it("with no most common report, everyone who reported is in dispute", () => {
        const verdict = judgePartyResult(
            ["room-a", "room-b"],
            [
                { member: "room-a", outcome: { winner: "room-a" } },
                { member: "room-b", outcome: { winner: "room-b" } },
            ]
        );
        expect(verdict.status).toBe("disputed");
        expect(verdict.dissenting).toEqual(["room-a", "room-b"]);
    });

    it("ignores reports from outside the party", () => {
        const verdict = judgePartyResult(
            ["room-a", "room-b"],
            [
                { member: "room-a", outcome: aceSingles },
                { member: "stranger", outcome: aceSingles },
                { member: undefined as any, outcome: aceSingles },
                null as any,
            ]
        );
        expect(verdict.status).toBe("incomplete");
        expect(verdict.missing).toEqual(["room-b"]);
    });

    it("a member can repeat its report but not change it", () => {
        const repeated = judgePartyResult(
            ["room-a", "room-b"],
            [
                { member: "room-a", outcome: aceSingles },
                { member: "room-a", outcome: sameInAnotherKeyOrder },
                { member: "room-b", outcome: aceSingles },
            ]
        );
        expect(repeated.status).toBe("agreed");

        // room-b waits, sees room-a's report, then tries a second story.
        const switched = judgePartyResult(
            ["room-a", "room-b"],
            [
                { member: "room-b", outcome: { winner: "room-b" } },
                { member: "room-a", outcome: aceSingles },
                { member: "room-b", outcome: aceSingles },
            ]
        );
        expect(switched.status).toBe("disputed");
        expect(switched.dissenting).toContain("room-b");
    });

    it("an outcome that can't be compared agrees with nothing", () => {
        const verdict = judgePartyResult(
            ["room-a", "room-b"],
            [
                { member: "room-a", outcome: aceSingles },
                { member: "room-b", outcome: { score: NaN } },
            ]
        );
        expect(verdict.status).toBe("disputed");
        expect(verdict.dissenting).toEqual(["room-b"]);
    });

    it("refuses a roster larger than a party", () => {
        const roster = Array.from({ length: 9 }, (_, i) => `room-${i}`);
        const verdict = judgePartyResult(
            roster,
            roster.map((member) => ({ member, outcome: aceSingles }))
        );
        expect(verdict.status).toBe("disputed");
        expect(leaderboardEligible(verdict.trust)).toBe(false);
    });

    it("does not depend on the order reports arrive in", () => {
        const reports = [
            { member: "room-a", outcome: aceSingles },
            { member: "room-b", outcome: aceSingles },
            { member: "room-c", outcome: aceSingles },
            { member: "room-d", outcome: sameInAnotherKeyOrder },
        ];
        const members = reports.map((report) => report.member);
        expect(judgePartyResult(members, reports)).toEqual(
            judgePartyResult([...members].reverse(), [...reports].reverse())
        );
    });

    it("ranks server-judged results too, once they exist", () => {
        expect(leaderboardEligible("server-judged")).toBe(true);
    });
});
