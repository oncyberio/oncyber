import {
    sampleWorldCell,
    WORLD_TILE_REVEAL_MS,
    WORLD_TILE_SPAN,
    WORLD_TILE_MAX_DELAY,
} from "./worldTileMotion";
const input = {
    center: { x: 3, y: 2, z: 4 },
    anchor: { x: 0, y: 0, z: 0 },
    delay: 0.2,
    cellSize: 0.5,
    seed: 12,
};
const at = (local: number) =>
    sampleWorldCell(input.delay + local * WORLD_TILE_SPAN, input);

test("tiles charge, turn and settle exactly while retaining the earlier overlapping cadence", () => {
    expect(WORLD_TILE_REVEAL_MS).toBe(1000);
    expect(WORLD_TILE_SPAN).toBe(0.28);
    const charged = at(0.179);
    expect(charged.phase).toBe("charge");
    expect(charged.glow).toBeGreaterThan(0.99);
    expect(charged.scale).toBeCloseTo(1, 3);
    expect(
        Math.max(Math.abs(charged.rotation.x), Math.abs(charged.rotation.z))
    ).toBeCloseTo(Math.PI / 2);
    // Each tile's charge stays a visible beat (about 50 ms of the 1 s reveal).
    expect(WORLD_TILE_SPAN * 0.18 * WORLD_TILE_REVEAL_MS).toBeGreaterThan(40);
    expect(WORLD_TILE_SPAN * 0.18 * WORLD_TILE_REVEAL_MS).toBeLessThan(120);
    expect(at(0.5).phase).toBe("assemble");
    expect(at(0.5).glow).toBeLessThan(charged.glow);
    expect(at(0.92).phase).toBe("settle");
    expect(at(1)).toEqual({
        offset: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1,
        glow: 0,
        visible: true,
        phase: "complete",
    });
});

test("staggered cells overlap in motion without all starting together", () => {
    const cells = Array.from({ length: 30 }, (_, i) => ({
        ...input,
        delay: (i / 29) * WORLD_TILE_MAX_DELAY,
        seed: i,
    }));
    const snapshot = cells.map((cell) => sampleWorldCell(0.45, cell));
    expect(snapshot.some((cell) => cell.phase === "hidden")).toBe(true);
    expect(snapshot.some((cell) => cell.phase === "complete")).toBe(true);
    expect(
        snapshot.filter((cell) => cell.phase === "assemble").length
    ).toBeGreaterThan(3);
    expect(snapshot.filter((cell) => cell.glow > 0).length).toBeLessThan(
        cells.length / 2
    );
    expect(
        cells.every((cell) => sampleWorldCell(1, cell).phase === "complete")
    ).toBe(true);
});

test("compact trajectories remain deterministic and continuous at phase boundaries", () => {
    for (let seed = 0; seed < 25; seed++)
        for (let step = 0; step <= 100; step++) {
            const cell = { ...input, seed },
                progress = step / 100;
            const motion = sampleWorldCell(progress, cell);
            expect(motion).toEqual(sampleWorldCell(progress, cell));
            expect(
                Math.hypot(motion.offset.x, motion.offset.y, motion.offset.z)
            ).toBeLessThan(0.5 * input.cellSize);
            for (const value of [motion.scale, motion.glow]) {
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(1);
            }
        }
    for (const boundary of [0.18, 0.84, 1]) {
        const before = at(boundary - 1e-7),
            after = at(boundary + 1e-7);
        for (const axis of ["x", "y", "z"] as const) {
            expect(before.offset[axis]).toBeCloseTo(after.offset[axis], 5);
            expect(before.rotation[axis]).toBeCloseTo(after.rotation[axis], 5);
        }
        expect(before.glow).toBeCloseTo(after.glow, 5);
        expect(before.scale).toBeCloseTo(after.scale, 5);
    }
});

test("fractional geometry seeds retain varied axes, signs and compact paths", () => {
    const samples = Array.from({ length: 24 }, (_, i) =>
        sampleWorldCell(input.delay + WORLD_TILE_SPAN * 0.3, {
            ...input,
            seed: (i + 0.37) / 24,
        })
    );
    expect(samples.some((value) => value.rotation.x !== 0)).toBe(true);
    expect(samples.some((value) => value.rotation.z !== 0)).toBe(true);
    expect(
        samples.some((value) => value.rotation.x + value.rotation.z < 0)
    ).toBe(true);
    expect(
        samples.some((value) => value.rotation.x + value.rotation.z > 0)
    ).toBe(true);
    expect(
        new Set(samples.map((value) => JSON.stringify(value.offset))).size
    ).toBe(24);
});

test("reusable output is reset and frozen inputs remain untouched", () => {
    const frozen = Object.freeze({
        ...input,
        center: Object.freeze({ ...input.center }),
        anchor: Object.freeze({ ...input.anchor }),
    });
    const out = sampleWorldCell(0.3, frozen),
        offset = out.offset,
        rotation = out.rotation;
    expect(sampleWorldCell(1, frozen, out)).toBe(out);
    expect(out.offset).toBe(offset);
    expect(out.rotation).toBe(rotation);
    expect(out.glow).toBe(0);
    expect(out.scale).toBe(1);
    expect(sampleWorldCell(NaN, frozen, out)).toMatchObject({
        scale: 0,
        visible: false,
        glow: 0,
        phase: "hidden",
    });
    const invalid = sampleWorldCell(0.5, {
        ...input,
        delay: NaN,
        seed: NaN,
        cellSize: NaN,
    });
    expect(
        [
            ...Object.values(invalid.offset),
            ...Object.values(invalid.rotation),
            invalid.scale,
            invalid.glow,
        ].every(Number.isFinite)
    ).toBe(true);
});

test("dissolution preserves the exact source, then flips near tiles before distant tiles", () => {
    const near = { ...input, delay: 0, mode: "dissolve" as const };
    const far = { ...input, delay: 0.6, mode: "dissolve" as const };
    for (const cell of [near, far]) {
        expect(sampleWorldCell(0, cell)).toEqual({
            phase: "complete",
            visible: true,
            scale: 1,
            glow: 0,
            offset: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
        });
        expect(sampleWorldCell(1, cell)).toMatchObject({
            phase: "hidden",
            visible: false,
            scale: 0,
            glow: 0,
        });
    }
    expect(sampleWorldCell(0.4, near).visible).toBe(false);
    expect(sampleWorldCell(0.4, far).phase).toBe("complete");
    expect(sampleWorldCell(0.14, near).phase).toBe("dissolve");
    expect(sampleWorldCell(0.74, far).phase).toBe("dissolve");
});

test("departing squares make a single in-place quarter-turn with no shrinking, glow or drift", () => {
    for (let seed = 0; seed < 24; seed++) {
        const cell = {
            ...input,
            seed: (seed + 0.37) / 24,
            mode: "dissolve" as const,
        };
        let previousAngle = 0;
        for (let step = 1; step < 100; step++) {
            const motion = sampleWorldCell(
                input.delay + (step / 100) * WORLD_TILE_SPAN,
                cell
            );
            expect(motion.visible).toBe(true);
            expect(motion.scale).toBe(1);
            expect(motion.glow).toBe(0);
            expect(motion.offset).toEqual({ x: 0, y: 0, z: 0 });
            expect(motion.rotation.y).toBe(0);
            expect(
                [motion.rotation.x, motion.rotation.z].filter(
                    (angle) => angle !== 0
                )
            ).toHaveLength(1);
            const angle = Math.hypot(motion.rotation.x, motion.rotation.z);
            expect(angle).toBeGreaterThan(previousAngle);
            expect(angle).toBeLessThan(Math.PI / 2);
            previousAngle = angle;
        }
        expect(previousAngle).toBeCloseTo(Math.PI / 2, 3);
    }
});

test("dissolve resets a reused arrival sample and remains at rest until its delay", () => {
    const out = at(0.1),
        offset = out.offset,
        rotation = out.rotation;
    expect(out.glow).toBeGreaterThan(0);
    const departing = { ...input, mode: "dissolve" as const };
    expect(
        sampleWorldCell(input.delay + WORLD_TILE_SPAN / 2, departing, out)
    ).toBe(out);
    expect(out.offset).toBe(offset);
    expect(out.rotation).toBe(rotation);
    expect(out.offset).toEqual({ x: 0, y: 0, z: 0 });
    expect(out.glow).toBe(0);
    expect(out.scale).toBe(1);
    expect(Math.hypot(out.rotation.x, out.rotation.z)).toBeCloseTo(Math.PI / 4);
    expect(sampleWorldCell(input.delay, departing, out)).toMatchObject({
        phase: "complete",
        visible: true,
        scale: 1,
        glow: 0,
        offset: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
    });
});

test.each(["reveal", "dissolve"] as const)(
    "%s folds architectural faces around their surface, never within it",
    (mode) => {
        for (const normalAxis of ["x", "y", "z"] as const)
            for (let seed = 0; seed < 24; seed++) {
                const surfaceNormal = { x: 0, y: 0, z: 0 };
                surfaceNormal[normalAxis] = 20;
                const motion = sampleWorldCell(
                    input.delay + WORLD_TILE_SPAN * 0.3,
                    {
                        ...input,
                        seed,
                        mode,
                        surfaceNormal,
                    }
                );
                expect(motion.rotation[normalAxis]).toBe(0);
                expect(
                    Math.hypot(...Object.values(motion.rotation))
                ).toBeGreaterThan(0.1);
            }
    }
);

test("coarse tiles cannot fly metres into a cramped room", () => {
    for (const cellSize of [0.5, 1, 4, 8])
        for (let step = 0; step <= 100; step++) {
            const motion = sampleWorldCell(
                input.delay + (WORLD_TILE_SPAN * step) / 100,
                {
                    ...input,
                    cellSize,
                }
            );
            expect(Math.hypot(...Object.values(motion.offset))).toBeLessThan(
                0.09
            );
        }
});
