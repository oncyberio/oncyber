import { admitCrowd, crowdBudget } from "./crowdAdmission";
import { FrameTimings } from "./frameTimings";

const crowd = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
        id: String(i),
        name: "Guest",
        x: i,
        y: 0,
        z: 0,
        rotation: 0,
        vrmUrl: `/avatar-${i}.vrm`,
    }));

test("a 10,000-person roster has bounded detailed avatars and distinct assets", () => {
    const budget = crowdBudget();
    const selected = admitCrowd(
        crowd(10000),
        { x: 0, z: 0 },
        new Set(),
        budget,
        "/default.vrm"
    );
    expect(selected).toHaveLength(256);
    expect(new Set(selected.map((p) => p.url)).size).toBe(16);
    expect(selected[0].person.id).toBe("0");
    expect(selected[255].person.id).toBe("255");
    expect(selected[255].url).toBe("/default.vrm");
});

test("retention avoids cutoff churn but admits a substantially closer arrival", () => {
    const budget = crowdBudget({ maxAvatars: 1 });
    const participants = crowd(2);
    participants[0].x = 10;
    participants[1].x = 9.5;
    expect(
        admitCrowd(
            participants,
            { x: 0, z: 0 },
            new Set(["0"]),
            budget,
            "/default.vrm"
        )[0].person.id
    ).toBe("0");
    participants[1].x = 5;
    expect(
        admitCrowd(
            participants,
            { x: 0, z: 0 },
            new Set(["0"]),
            budget,
            "/default.vrm"
        )[0].person.id
    ).toBe("1");
});

test("malformed or duplicate presence cannot consume the detail budget", () => {
    const people = crowd(3);
    people[1].x = NaN;
    people[2].id = "0";
    expect(
        admitCrowd(
            people,
            { x: 0, z: 0 },
            new Set(),
            crowdBudget(),
            "/default.vrm"
        )
    ).toHaveLength(1);
});

test("frame measurements discard loading, warmup and inactive intervals", () => {
    const timings = new FrameTimings();
    for (let time = 16; time < 7000; time += 16) timings.record(time, 3, true);
    expect(timings.stats()).toEqual({
        sampleFrames: 249,
        frameCpuMs: { p50: 3, p95: 3, p99: 3, max: 3 },
        frameIntervalMs: { p50: 16, p95: 16, p99: 16, max: 16 },
    });
    timings.record(7010, 100, false);
    expect(timings.stats()).toEqual({ sampleFrames: 0 });
    timings.record(90000, 2, true);
    expect(timings.stats()).toEqual({ sampleFrames: 0 });
});

test("resident avatar models stay stable when admitted players reorder", () => {
    const people = crowd(3);
    const first = admitCrowd(
        people,
        { x: 0, z: 0 },
        new Set(),
        crowdBudget({ maxModels: 2 }),
        "/default.vrm"
    );
    const next = admitCrowd(
        people,
        { x: 2, z: 0 },
        new Set(people.map((p) => p.id)),
        crowdBudget({ maxModels: 2 }),
        "/default.vrm",
        new Set(first.map((p) => p.url))
    );
    expect(next.find((p) => p.person.id === "0").url).toBe("/avatar-0.vrm");
    expect(next.find((p) => p.person.id === "2").url).toBe("/default.vrm");
});
