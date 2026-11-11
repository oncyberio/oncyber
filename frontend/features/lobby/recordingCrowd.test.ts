import {
    createRecordingCrowd,
    mixCrowdAvatars,
    parseRecordingCrowd,
} from "./recordingCrowd";
import { travelParticipants } from "./travelPresentation";

const avatars = ["a", "b", "c", "d"].map((id) => ({
    url: `https://x/${id}.vrm`,
}));

test("the crowd is off unless the URL asks for it", () => {
    expect(parseRecordingCrowd("")).toBeNull();
    expect(parseRecordingCrowd("?crowd=0")).toBeNull();
    expect(parseRecordingCrowd("?crowd=abc")).toBeNull();
});

test("options are bounded", () => {
    const options = parseRecordingCrowd(
        "?crowd=500&crowdTravel=99&crowdWallet=rayan.eth,not a wallet,0x" +
            "a".repeat(40) +
            "&crowdNames=0"
    );
    expect(options).toMatchObject({
        count: 80,
        travel: 16,
        wallets: ["rayan.eth", "0x" + "a".repeat(40)],
        names: false,
    });
    expect(parseRecordingCrowd("?crowd=3")?.travel).toBe(3);
});

test("the crowd has the requested size, unique ids and real avatars", () => {
    const crowd = createRecordingCrowd(
        parseRecordingCrowd("?crowd=40"),
        avatars
    );
    expect(crowd.participants).toHaveLength(40);
    expect(new Set(crowd.participants.map((p) => p.id)).size).toBe(40);
    expect(crowd.travelIds).toHaveLength(8);
    expect(new Set(crowd.participants.map((p) => p.vrmUrl)).size).toBe(
        avatars.length
    );
});

test("samples move walkers smoothly and keep everyone on the floor", () => {
    const crowd = createRecordingCrowd(
        parseRecordingCrowd("?crowd=30"),
        avatars
    );
    let previous = crowd.sample(0).map((p) => ({ ...p }));
    let moved = 0;
    for (let frame = 1; frame < 600; frame++) {
        const now = frame * (1000 / 60);
        const next = crowd.sample(now);
        next.forEach((p, i) => {
            expect(Number.isFinite(p.x) && Number.isFinite(p.z)).toBe(true);
            expect(p.y).toBe(0);
            const step = Math.hypot(p.x - previous[i].x, p.z - previous[i].z);
            // Walking pace, never a jump across the room between frames.
            expect(step).toBeLessThan(0.1);
            if (step > 0) moved++;
        });
        previous = next.map((p) => ({ ...p }));
    }
    expect(moved).toBeGreaterThan(0);
});

test("the same seed stages the same scene", () => {
    const options = parseRecordingCrowd("?crowd=20&crowdSeed=4");
    const a = createRecordingCrowd(options, avatars).sample(1234);
    const b = createRecordingCrowd(options, avatars).sample(1234);
    expect(a).toEqual(b);
});

test("owned avatars are mixed in with the catalogue ones", () => {
    const owned = [{ url: "o1" }, { url: "o2" }];
    const catalogue = [
        { url: "c1" },
        { url: "c2" },
        { url: "c3" },
        { url: "o1" },
    ];
    expect(mixCrowdAvatars(owned, catalogue).map((a) => a.url)).toEqual([
        "c1",
        "o1",
        "c2",
        "o2",
        "c3",
    ]);
});

test("more than 8 travellers stand in rows instead of one wide line", () => {
    const source = Array.from({ length: 16 }, (_, i) => ({
        id: `p${i}`,
        name: "",
        x: 0,
        y: 0,
        z: 0,
        rotation: 0,
    }));
    const placed = travelParticipants(
        source,
        { partyIds: source.map((p) => p.id) },
        { x: 0, z: 0 },
        0
    );
    const width = Math.max(...placed.map((p) => Math.abs(p.x)));
    expect(width).toBeLessThan(5);
    // A party of 8 keeps its existing single row.
    const eight = travelParticipants(
        source.slice(0, 8),
        { partyIds: source.slice(0, 8).map((p) => p.id) },
        { x: 0, z: 0 },
        0
    );
    expect(eight[0].x).toBeCloseTo(-3.5 * 1.15);
});
