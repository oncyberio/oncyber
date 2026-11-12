import {
    createRenderDemand,
    RENDER_DEMAND_GRACE_MS,
    RENDER_DEMAND_PROBE_MS,
} from "./renderDemand";

/**
 * Runs a list of steps against one demand and returns what each decide()
 * answered. A step is [time, action, ...args]; actions other than "decide"
 * return nothing.
 */
function run(steps, options) {
    const demand = createRenderDemand({
        graceMs: 500,
        probeMs: 1000,
        ...options,
    });
    const answers = [];
    for (const [time, action, ...args] of steps) {
        if (action === "decide") {
            answers.push(demand.decide(time, args[0]).reason);
        } else if (action === "drawn") {
            demand.drawn(time, args[0]);
        } else if (action === "wake") {
            answers.push(demand.wake(time).reason);
        } else {
            demand[action](...args);
        }
    }
    return { answers, demand };
}

describe("createRenderDemand", () => {
    test.each([
        [
            "the start draws for the grace period, then a quiet world idles",
            [
                [0, "decide"],
                [16, "decide"],
                [499, "decide"],
                [500, "decide"],
                [900, "decide"],
            ],
            ["recent-change", "recent-change", "recent-change", "idle", "idle"],
        ],
        [
            "a probe frame is drawn every second while idle",
            [
                [0, "decide"],
                [600, "decide"],
                [999, "decide"],
                [1000, "decide"],
                [1016, "decide"],
                [2000, "decide"],
            ],
            ["recent-change", "idle", "idle", "probe", "idle", "probe"],
        ],
        [
            "an invalidation draws at once and for the grace period",
            [
                [0, "decide"],
                [600, "decide"],
                [700, "invalidate"],
                [716, "decide"],
                [1200, "decide"],
                [1216, "decide"],
            ],
            ["recent-change", "idle", "recent-change", "recent-change", "idle"],
        ],
        [
            "a drawn frame that changed the GPU keeps the world awake",
            [
                [0, "decide"],
                [0, "drawn", { changed: true }],
                [400, "decide"],
                [400, "drawn", { changed: true }],
                [800, "decide"],
                [800, "drawn", { changed: false }],
                [1300, "decide"],
            ],
            ["recent-change", "recent-change", "recent-change", "idle"],
        ],
        [
            "a probe that finds a change wakes the world",
            [
                [0, "decide"],
                [1000, "decide"],
                [1000, "drawn", { changed: true }],
                [1016, "decide"],
            ],
            ["recent-change", "probe", "recent-change"],
        ],
        [
            "a continuous source draws every frame, then the grace runs",
            [
                [0, "setContinuous", "video", true],
                [0, "decide"],
                [5000, "decide"],
                [5016, "setContinuous", "video", false],
                [5016, "decide"],
                [5400, "decide"],
                [5600, "decide"],
            ],
            [
                "continuous",
                "continuous",
                "recent-change",
                "recent-change",
                "idle",
            ],
        ],
        [
            "an ineligible frame (editor, XR, transition) always draws",
            [
                [0, "decide"],
                [600, "decide", { eligible: false }],
                [700, "decide", { eligible: true }],
                [1100, "decide", { eligible: true }],
            ],
            ["recent-change", "ineligible", "recent-change", "idle"],
        ],
        [
            "a skipped frame woken by a detector is drawn, once",
            [
                [0, "decide"],
                [600, "decide"],
                [600, "wake"],
                [616, "decide"],
                [1600, "decide"],
            ],
            ["recent-change", "idle", "change", "idle", "probe"],
        ],
        [
            "a woken frame the GPU found changed keeps the world awake",
            [
                [0, "decide"],
                [600, "decide"],
                [600, "wake"],
                [600, "drawn", { changed: true }],
                [616, "decide"],
                [1100, "decide"],
            ],
            ["recent-change", "idle", "change", "recent-change", "idle"],
        ],
    ])("%s", (_name, steps, expected) => {
        expect(run(steps).answers).toEqual(expected);
    });

    test("turned off, every frame draws", () => {
        const { answers } = run(
            [
                [0, "decide"],
                [5000, "decide"],
                [9000, "decide"],
            ],
            { enabled: false }
        );
        expect(answers).toEqual(["disabled", "disabled", "disabled"]);
    });

    test("the frame record says whether this and the previous frame drew", () => {
        const { demand } = run([
            [0, "decide"],
            [600, "decide"],
        ]);
        expect(demand.frame).toMatchObject({
            drawn: false,
            previousDrawn: true,
        });
        demand.wake(600);
        expect(demand.frame).toMatchObject({
            drawn: true,
            previousDrawn: true,
        });
        demand.decide(616);
        expect(demand.frame).toMatchObject({
            drawn: false,
            previousDrawn: true,
            reason: "idle",
        });
    });

    test("ten seconds of a still world at 60 fps draw a few frames", () => {
        const demand = createRenderDemand();
        let drawn = 0;
        for (let i = 0; i < 600; i++) {
            const t = (i * 1000) / 60;
            if (demand.decide(t).draw) drawn++;
            demand.drawn(t, { changed: false });
        }
        // the grace after start, then one probe a second
        const expected =
            Math.ceil(RENDER_DEMAND_GRACE_MS / (1000 / 60)) +
            Math.floor(10000 / RENDER_DEMAND_PROBE_MS) -
            1;
        expect(Math.abs(drawn - expected)).toBeLessThanOrEqual(2);
        expect(demand.stats.drawn + demand.stats.skipped).toBe(600);
    });
});
