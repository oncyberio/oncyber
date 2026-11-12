import { LobbyMotionStore } from "./LobbyMotionStore";
import { LobbyPrediction } from "./LobbyPrediction";
import { LobbyVoiceSignaling, legacyVoicePeers } from "./LobbyVoiceSignaling";
import type { LobbyPlayer } from "./LobbyConnection";
const player = (id = "peer"): LobbyPlayer => ({
    id,
    name: id,
    avatar: "",
    isLocal: false,
    vrmUrl: "",
    scale: 1,
    x: 0,
    y: 0,
    z: 0,
    rotation: 0,
    animation: -1,
    floor: true,
});
const pose = (x: number) => ({
    x,
    y: 0,
    z: 0,
    rotation: 0,
    animation: -1,
    floor: true,
});

describe("imperative lobby motion timeline", () => {
    test("the first remote snapshot appears directly at its authoritative spawn", () => {
        const store = new LobbyMotionStore();
        store.upsert(player());
        expect(store.sample(100)).toEqual([]);
        store.pushFrame(1, 1000, [["peer", pose(80)]], 100);
        expect(store.sample(110)[0].x).toBe(80);
        expect(store.sample(120)[0].x).toBe(80);
    });
    test("samples staggered changed-only senders smoothly without treating omitted rows as a stop", () => {
        const store = new LobbyMotionStore();
        store.upsert(player("slow"));
        store.upsert(player("fast"));
        store.observeClock(0, 200, 100);
        store.pushFrame(
            1,
            0,
            [
                ["slow", pose(0)],
                ["fast", pose(0)],
            ],
            100
        );
        store.pushFrame(2, 50, [["fast", pose(0.2)]], 150);
        store.pushFrame(
            3,
            100,
            [
                ["slow", pose(0.4)],
                ["fast", pose(0.4)],
            ],
            200
        );
        const list = store.sample(175);
        for (const p of list) expect(p.x).toBeCloseTo(0.3);
        expect(store.sample(200)).toBe(list);
        expect(list[0].x).toBe(0.4);
        expect(list[0].speed).toBeCloseTo(4);
    });
    test("mixed20Hz and5Hz actors use their own interpolation delay without heartbeat-induced lag", () => {
        const store = new LobbyMotionStore();
        store.upsert(player("near"));
        store.upsert(player("far"));
        store.observeClock(0, 200, 100);
        for (let tick = 0; tick <= 12; tick++) {
            const time = tick * 50;
            const poses: Array<[string, ReturnType<typeof pose>]> = [
                ["near", pose(time * 0.004)],
            ];
            if (tick % 4 === 0) poses.push(["far", pose(time * 0.004)]);
            store.pushFrame(tick + 1, time, poses, time + 100);
        }
        const actors = store.sample(650);
        expect(actors.find((actor) => actor.id === "near").x).toBeCloseTo(2.2);
        expect(actors.find((actor) => actor.id === "far").x).toBeCloseTo(1.72);
        expect(store.diagnostics().interpolationMs).toBe(220);
        expect(store.diagnostics().extrapolatedPlayers).toBe(0);
        store.clear();
        store.upsert(player());
        store.observeClock(0, 0, 0);
        store.pushFrame(1, 0, [["peer", pose(0)]], 0);
        store.pushFrame(2, 500, [["peer", pose(0)]], 500);
        store.sample(600);
        expect(store.diagnostics().interpolationMs).toBe(100);
    });
    test("rejects stale sequences and timestamps, extrapolates briefly then freezes", () => {
        const store = new LobbyMotionStore();
        store.upsert(player());
        store.observeClock(0, 200, 100);
        store.pushFrame(1, 0, [["peer", pose(0)]], 100);
        store.pushFrame(2, 100, [["peer", pose(0.4)]], 200);
        expect(store.pushFrame(2, 110, [["peer", pose(100)]], 210)).toBe(false);
        expect(store.pushFrame(3, 90, [["peer", pose(100)]], 220)).toBe(false);
        expect(store.sample(250)[0].x).toBeCloseTo(0.6);
        expect(store.sample(1000)[0].x).toBeCloseTo(1);
        expect(store.sample(3000)[0].x).toBeCloseTo(1);
        expect(store.diagnostics()).toMatchObject({
            rejectedSnapshots: 2,
            frozenPlayers: 1,
            rttMs: 200,
        });
    });
    test("interpolates shortest yaw path and discrete native emotes and floor", () => {
        const store = new LobbyMotionStore();
        store.upsert(player());
        store.observeClock(0, 0, 0);
        store.pushFrame(1, 0, [["peer", { ...pose(0), rotation: 3.1 }]], 0);
        store.pushFrame(
            2,
            100,
            [
                [
                    "peer",
                    { ...pose(1), rotation: -3.1, animation: 0, floor: false },
                ],
            ],
            100
        );
        const halfway = store.sample(150)[0];
        expect(halfway.rotation).toBeCloseTo(Math.PI);
        expect(halfway.animation).toBe(-1);
        expect(halfway.floor).toBe(true);
        expect(store.sample(200)[0]).toMatchObject({
            animation: 0,
            floor: false,
        });
    });
    test("jittered 150–250ms RTT arrivals and missed frames keep constant motion monotonic and bounded", () => {
        const store = new LobbyMotionStore();
        store.upsert(player());
        store.observeClock(0, 200, 100);
        const delays = [75, 100, 125, 85, 110, 90];
        const arrivals = Array.from({ length: 60 }, (_, i) => ({
            tick: i + 1,
            time: i * 50,
            received: i * 50 + delays[i % delays.length],
        })).filter((_, i) => i % 9 !== 5);
        let index = 0,
            lastX = 0;
        for (let now = 0; now <= 3500; now += 10) {
            while (arrivals[index]?.received <= now) {
                const frame = arrivals[index++];
                store.pushFrame(
                    frame.tick,
                    frame.time,
                    [["peer", pose(frame.time * 0.004)]],
                    frame.received
                );
            }
            const sampled = store.sample(now)[0];
            if (!sampled) continue;
            expect(sampled.x).toBeGreaterThanOrEqual(lastX - 0.00001);
            expect(sampled.x).toBeLessThanOrEqual(now * 0.004 + 0.001);
            expect(sampled.x - lastX).toBeLessThan(0.16);
            lastX = sampled.x;
        }
        expect(store.diagnostics().interpolationMs).toBeGreaterThan(100);
        expect(store.diagnostics().interpolationMs).toBeLessThanOrEqual(220);
        store.clear();
        expect(store.sample(4000)).toEqual([]);
        store.upsert(player());
        expect(store.pushFrame(1, 0, [["peer", pose(2)]], 4000)).toBe(true);
        expect(store.sample(4100)[0].x).toBe(2);
    });
});

describe("authoritative pose delta replay", () => {
    test("welcome resets spawn and ack correction preserves unacknowledged local movement", () => {
        const prediction = new LobbyPrediction();
        prediction.pose = pose(10);
        prediction.welcome([2, 0, 0, 0]);
        expect(prediction.consume()).toMatchObject({ x: -8, hardSnap: true });
        expect(prediction.consume()).toBeNull();
        prediction.pose = pose(4);
        prediction.packet();
        prediction.pose = pose(5);
        prediction.packet();
        prediction.pose = pose(6);
        expect(prediction.acknowledge({ seq: 1, position: [3, 0, 0, 0] })).toBe(
            true
        );
        expect(prediction.pose.x).toBe(5);
        expect(prediction.consume()).toMatchObject({
            sequence: 1,
            x: -1,
            hardSnap: false,
        });
        expect(prediction.acknowledge({ seq: 2, position: [4, 0, 0, 0] })).toBe(
            true
        );
        expect(prediction.pose.x).toBe(5);
        expect(prediction.consume()).toBeNull();
        expect(
            prediction.acknowledge({ seq: 1, position: [100, 0, 0, 0] })
        ).toBe(false);
        expect(
            prediction.acknowledge({ seq: 1000, position: [100, 0, 0, 0] })
        ).toBe(false);
    });
    test("pending packets are bounded, cumulative corrections consume once, and new sessions reject old ack", () => {
        const prediction = new LobbyPrediction();
        for (let i = 0; i < 200; i++) prediction.packet();
        expect(prediction.pendingPackets).toBe(128);
        expect(prediction.acknowledge({ seq: 1, position: [4, 0, 0, 0] })).toBe(
            false
        );
        prediction.welcome([2, 0, 0, 0]);
        prediction.welcome([4, 0, 0, 0]);
        expect(prediction.consume()).toMatchObject({
            x: 4,
            z: -4,
            hardSnap: true,
        });
        expect(
            prediction.acknowledge({ seq: 200, position: [4, 0, 0, 0] })
        ).toBe(false);
    });
});

describe("bounded voice admission", () => {
    test("caps peers before WebRTC receives signals and removes departed peers", () => {
        const handlers = {
            onPeerJoin: jest.fn(),
            onPeerLeave: jest.fn(),
            onSignal: jest.fn(),
        };
        const callbacks = new Map();
        const room: any = {
            sessionId: "self",
            send: jest.fn(),
            onMessage: (type, handler) => {
                callbacks.set(type, handler);
                return () => callbacks.delete(type);
            },
        };
        const transport = new LobbyVoiceSignaling(
            room,
            Array.from({ length: 80 }, (_, i) => `peer${i}`)
        );
        transport.start(handlers);
        expect(transport.initialPeers()).toHaveLength(64);
        callbacks.get("rtc-signal")({
            from: "peer79",
            payload: { kind: "offer" },
        });
        callbacks.get("rtc-join")({ sessionId: "peer79" });
        expect(handlers.onSignal).not.toHaveBeenCalled();
        expect(handlers.onPeerJoin).not.toHaveBeenCalled();
        callbacks.get("rtc-signal")({
            from: "peer0",
            payload: { kind: "offer" },
        });
        expect(handlers.onSignal).toHaveBeenCalledTimes(1);
        transport.send("peer79", { kind: "offer" });
        expect(room.send).not.toHaveBeenCalledWith(
            "rtc-signal",
            expect.anything()
        );
        callbacks.get("rtc-leave")({ sessionId: "peer0" });
        callbacks.get("rtc-join")({ sessionId: "peer0" });
        expect(handlers.onPeerJoin).toHaveBeenCalledWith("peer0");
        handlers.onPeerLeave.mockClear();
        transport.replacePeers(["peer7", "peer70"]);
        expect(handlers.onPeerLeave).toHaveBeenCalledTimes(63);
        expect(handlers.onPeerJoin).toHaveBeenCalledWith("peer70");
        transport.dispose();
        transport.dispose();
        expect(
            room.send.mock.calls.filter(
                ([type, body]) => type === "rtc-ready" && body.enabled === false
            )
        ).toHaveLength(1);
        expect(callbacks.size).toBe(0);
    });
    test("legacy nearest peers are mutual, audible, deterministic, and capped even in a dense room", () => {
        const positions = Array.from({ length: 50 }, (_, i) => ({
            id: `p${i}`,
            x: i * 0.1,
            z: 0,
        }));
        for (const player of positions) {
            const peers = legacyVoicePeers(player.id, positions);
            expect(peers.length).toBeLessThanOrEqual(8);
            for (const peer of peers)
                expect(legacyVoicePeers(peer, positions)).toContain(player.id);
        }
        expect(
            legacyVoicePeers("self", [
                { id: "self", x: 0, z: 0 },
                { id: "far", x: 15, z: 0 },
            ])
        ).toEqual([]);
    });
});

describe("independent world snapshot datagrams", () => {
    test("same-tick and out-of-order chunks retain fresh actors while rejecting stale actor revisions", () => {
        const store = new LobbyMotionStore();
        for (const id of ["a", "b", "c"]) store.upsert(player(id));
        expect(
            store.pushChunk(10, 500, [["a", 10, pose(1)]], 600)
        ).toHaveLength(1);
        expect(
            store.pushChunk(11, 550, [["a", 11, pose(2)]], 650)
        ).toHaveLength(1);
        expect(
            store.pushChunk(10, 500, [["b", 10, pose(3)]], 651)
        ).toHaveLength(1);
        expect(
            store.pushChunk(10, 500, [["c", 10, pose(4)]], 652)
        ).toHaveLength(1);
        expect(store.pushChunk(10, 500, [["a", 10, pose(100)]], 653)).toEqual(
            []
        );
        expect(store.pushChunk(10, 500, [["b", 10, pose(100)]], 654)).toEqual(
            []
        );
        expect(store.sample(700).map((value) => value.id)).toEqual([
            "a",
            "b",
            "c",
        ]);
        expect(store.diagnostics().jitterMs).toBe(0);
    });
    test("lost chunks recover from later independently usable states and stationary heartbeats stop extrapolation", () => {
        const store = new LobbyMotionStore();
        store.upsert(player());
        store.observeClock(0, 200, 100);
        store.pushChunk(1, 0, [["peer", 1, pose(0)]], 100);
        store.pushChunk(4, 150, [["peer", 4, pose(0.6)]], 250);
        expect(store.sample(500)[0].x).toBeLessThanOrEqual(1.2);
        store.pushChunk(14, 650, [["peer", 14, pose(0.6)]], 750);
        expect(store.sample(1200)[0].x).toBeCloseTo(0.6);
        expect(store.pushChunk(2, 50, [["peer", 2, pose(100)]], 1300)).toEqual(
            []
        );
    });
    test("uint32 actor sequences wrap without accepting old packets", () => {
        const store = new LobbyMotionStore();
        store.upsert(player());
        expect(
            store.pushChunk(
                0xfffffffe,
                100,
                [["peer", 0xfffffffe, pose(1)]],
                100
            )
        ).toHaveLength(1);
        expect(
            store.pushChunk(0, 200, [["peer", 0, pose(2)]], 200)
        ).toHaveLength(1);
        expect(
            store.pushChunk(
                0xfffffffe,
                100,
                [["peer", 0xfffffffe, pose(100)]],
                300
            )
        ).toEqual([]);
    });
});

test("moving 2Hz world actors interpolate continuously while nearby actors retain their short timeline", () => {
    const store = new LobbyMotionStore();
    store.upsert(player("far"));
    store.upsert(player("near"));
    store.observeClock(0, 200, 100);
    store.pushChunk(
        0,
        0,
        [
            ["far", 0, pose(0)],
            ["near", 0, pose(0)],
        ],
        100
    );
    for (let tick = 1; tick <= 30; tick++) {
        const time = tick * 50;
        const rows: Array<[string, number, ReturnType<typeof pose>]> = [
            ["near", tick, pose(time * 0.004)],
        ];
        if (tick % 10 === 0) rows.push(["far", tick, pose(time * 0.004)]);
        store.pushChunk(tick, time, rows, time + 100);
    }
    const positions: number[] = [];
    for (let time = 1600; time < 1900; time += 16)
        positions.push(
            store.sample(time).find((value) => value.id === "far").x
        );
    expect(
        positions.every(
            (value, index) => !index || value > positions[index - 1]
        )
    ).toBe(true);
    expect(store.diagnostics().interpolationMs).toBe(550);
    const near = store.sample(1600).find((value) => value.id === "near");
    expect(near.x).toBeGreaterThan(positions[0] + 1);
});

test("promoting a 2Hz actor to 20Hz catches up monotonically within the movement speed cap", () => {
    const store = new LobbyMotionStore();
    store.upsert(player());
    store.observeClock(0, 200, 100);
    for (let tick = 0; tick <= 20; tick += 10)
        store.pushChunk(
            tick,
            tick * 50,
            [["peer", tick, pose(tick * 0.2)]],
            tick * 50 + 100
        );
    let previous = store.sample(1100)[0].x;
    for (let tick = 21; tick <= 40; tick++) {
        const time = tick * 50;
        store.pushChunk(
            tick,
            time,
            [["peer", tick, pose(time * 0.004)]],
            time + 100
        );
        const current = store.sample(time + 100)[0].x;
        expect(current).toBeGreaterThanOrEqual(previous);
        expect(current - previous).toBeLessThanOrEqual(0.40001);
        previous = current;
    }
    expect(previous).toBeGreaterThan(7);
    expect(store.diagnostics().interpolationMs).toBe(100);
});

test("velocity snapshots reduce nearby buffering and stop without extrapolation or foot sliding", () => {
    const store = new LobbyMotionStore();
    store.upsert(player());
    store.observeClock(0, 0, 0);
    store.pushFrame(1, 0, [["peer", { ...pose(0), vx: 4, vy: 0, vz: 0 }]], 0);
    store.pushFrame(
        2,
        50,
        [["peer", { ...pose(0.1), vx: 0, vy: 0, vz: 0 }]],
        50
    );
    expect(store.sample(85)[0].x).toBeCloseTo(0.075);
    expect(store.diagnostics().interpolationMs).toBe(60);
    expect(store.sample(140)[0].x).toBeGreaterThan(0.09);
    expect(store.sample(150)[0].speed).toBeLessThan(0.2);
    // The remaining centimetre eases out instead of snapping to idle early.
    for (let time = 160; time <= 450; time += 10) store.sample(time);
    expect(store.sample(460)[0].x).toBe(0.1);
    expect(store.sample(460)[0].speed).toBe(0);
});

test("jitter smoothing settles at a stopped authoritative target without indefinite foot drift", () => {
    const store = new LobbyMotionStore();
    store.upsert(player());
    store.observeClock(0, 80, 40);
    for (let frame = 0; frame <= 300; frame++) {
        const time = (frame * 1000) / 60;
        if (frame % 3 === 0)
            store.pushChunk(
                frame,
                time,
                [
                    [
                        "peer",
                        frame,
                        {
                            ...pose(Math.min(3, time * 0.003)),
                            vx: time < 1000 ? 3 : 0,
                            vy: 0,
                            vz: 0,
                        },
                    ],
                ],
                time + (frame % 6 ? 60 : 25)
            );
        store.sample(time + 80);
    }
    const stopped = store.sample(5080)[0];
    expect(stopped.x).toBeCloseTo(3, 4);
    expect(stopped.speed).toBe(0);
    expect(store.diagnostics().presentationErrorMeters).toBeLessThan(0.001);
});

test("sampling twice at one presentation time cannot bypass remote smoothing", () => {
    const store = new LobbyMotionStore();
    store.upsert(player());
    store.observeClock(0, 0, 0);
    for (let frame = 0; frame < 120; frame++) {
        const time = (frame * 1000) / 60;
        if (frame % 3 === 0)
            store.pushFrame(
                frame + 1,
                time,
                [
                    [
                        "peer",
                        {
                            ...pose(time * 0.004 + (frame % 9 === 0 ? 0.4 : 0)),
                            vx: 4,
                            vy: 0,
                            vz: 0,
                        },
                    ],
                ],
                time
            );
        const first = { ...store.sample(time)[0] };
        const diagnostics = { ...store.diagnostics() };
        expect(store.sample(time)[0]).toEqual(first);
        expect(store.sample(time + 1e-9)[0]).toEqual(first);
        expect(store.diagnostics()).toEqual(diagnostics);
    }
});

test("a stopped remote target settles without repeated forward/backward oscillation", () => {
    const store = new LobbyMotionStore();
    store.upsert(player());
    store.observeClock(0, 0, 0);
    const samples: number[] = [];
    for (let frame = 0; frame <= 180; frame++) {
        const time = (frame * 1000) / 60;
        if (frame % 3 === 0)
            store.pushFrame(
                frame + 1,
                time,
                [
                    [
                        "peer",
                        {
                            ...pose(Math.min(time, 1000) * 0.004),
                            vx: time < 1000 ? 4 : 0,
                            vy: 0,
                            vz: 0,
                        },
                    ],
                ],
                time + (frame % 9 === 0 ? 80 : 0)
            );
        const x = store.sample(time)[0].x;
        if (time >= 1250) samples.push(x);
    }
    let reversals = 0,
        direction = 0;
    for (let i = 1; i < samples.length; i++) {
        const delta = samples[i] - samples[i - 1];
        if (Math.abs(delta) < 0.001) continue;
        const next = Math.sign(delta);
        if (direction && next !== direction) reversals++;
        direction = next;
    }
    expect(reversals).toBe(0);
    expect(samples.at(-1)).toBeCloseTo(4, 3);
});

test.each([60, 120])(
    "steady running stays steady under packet jitter at %s Hz",
    (hz) => {
        const store = new LobbyMotionStore();
        store.upsert(player());
        store.observeClock(0, 0, 0);
        const queue = Array.from({ length: 200 }, (_, i) => ({
            time: i * 50,
            arrival: i * 50 + 50 + Math.sin(i * 0.8) * 30,
            seq: i + 1,
        })).sort((a, b) => a.arrival - b.arrival);
        let previous: number | undefined;
        const speeds: number[] = [];
        for (let frame = 0; frame < hz * 10; frame++) {
            const time = (frame * 1000) / hz;
            while (queue[0]?.arrival <= time) {
                const packet = queue.shift();
                store.pushFrame(
                    packet.seq,
                    packet.time,
                    [
                        [
                            "peer",
                            {
                                ...pose(packet.time * 0.004),
                                vx: 4,
                                vy: 0,
                                vz: 0,
                            },
                        ],
                    ],
                    packet.arrival
                );
            }
            const person = store.sample(time)[0];
            if (!person) continue;
            if (previous !== undefined && time > 2000) {
                const speed = (person.x - previous) * hz;
                speeds.push(speed);
                // The animation must use actual presented travel, including corrections.
                expect(person.speed).toBeCloseTo(Math.abs(speed), 6);
            }
            previous = person.x;
        }
        expect(Math.min(...speeds)).toBeGreaterThan(3.8);
        expect(Math.max(...speeds)).toBeLessThan(4.2);
    }
);

test.each([60, 120])(
    "batched authority steps do not pulse remote gait or heading at %s Hz",
    (hz) => {
        const store = new LobbyMotionStore();
        store.upsert(player());
        store.observeClock(0, 0, 0);
        let previous: { x: number; rotation: number };
        const speeds: number[] = [],
            turns: number[] = [];
        for (let frame = 0; frame < hz * 5; frame++) {
            const time = (frame * 1000) / hz;
            if (frame % (hz / 20) === 0) {
                const tick = frame / (hz / 20);
                // Input transport can deliver two 50ms batches together. The authority
                // consumes six steps, then zero, but its physical velocity is steady.
                const simulatedTime = Math.floor(tick / 2) * 100;
                store.pushFrame(
                    tick + 1,
                    time,
                    [
                        [
                            "peer",
                            {
                                ...pose(simulatedTime * 0.0032),
                                rotation: simulatedTime * 0.00065,
                                vx: 3.2,
                                vy: 0,
                                vz: 0,
                            },
                        ],
                    ],
                    time
                );
            }
            const shown = store.sample(time)[0];
            if (previous && time > 1500) {
                const speed = (shown.x - previous.x) * hz;
                speeds.push(speed);
                turns.push(
                    Math.abs(
                        Math.atan2(
                            Math.sin(shown.rotation - previous.rotation),
                            Math.cos(shown.rotation - previous.rotation)
                        )
                    ) * hz
                );
                expect(shown.speed).toBeCloseTo(Math.abs(speed), 6);
            }
            previous = { x: shown.x, rotation: shown.rotation };
        }
        expect(Math.min(...speeds)).toBeGreaterThan(2.9);
        expect(Math.max(...speeds)).toBeLessThan(3.5);
        expect(Math.max(...turns)).toBeLessThan(1.1);
    }
);

test.each([60, 120])(
    "a lost 2Hz crowd snapshot does not cause a stop-and-catch-up at %s Hz",
    (hz) => {
        const store = new LobbyMotionStore();
        store.upsert(player());
        store.observeClock(0, 0, 0);
        let previous = 0;
        const speeds: number[] = [];
        for (let frame = 0; frame <= hz * 5; frame++) {
            const time = (frame * 1000) / hz;
            if (frame % (hz / 2) === 0 && Math.abs(time - 2000) > 1) {
                store.pushFrame(
                    frame + 1,
                    time,
                    [
                        [
                            "peer",
                            {
                                ...pose(Math.min(time, 3000) * 0.004),
                                vx: time < 3000 ? 4 : 0,
                                vy: 0,
                                vz: 0,
                            },
                        ],
                    ],
                    time
                );
            }
            const shown = store.sample(time)[0];
            if (time > 1500 && time < 2800)
                speeds.push((shown.x - previous) * hz);
            previous = shown.x;
        }
        expect(Math.min(...speeds)).toBeGreaterThan(3);
        expect(Math.max(...speeds)).toBeLessThan(5);
        expect(store.sample(5050)[0].x).toBeCloseTo(12, 3);
        expect(store.sample(5060)[0].speed).toBe(0);
    }
);

test("remote grounded state follows the rendered jump height between sparse snapshots", () => {
    const store = new LobbyMotionStore();
    store.upsert(player());
    store.observeClock(0, 0, 0);
    store.pushFrame(
        1,
        0,
        [["peer", { ...pose(0), vx: 0, vy: 0, vz: 0, floor: true }]],
        0
    );
    store.pushFrame(
        2,
        500,
        [["peer", { ...pose(0), y: 1, vx: 0, vy: 0, vz: 0, floor: false }]],
        500
    );
    const rising = store.sample(800)[0];
    expect(rising.y).toBeGreaterThan(0.1);
    expect(rising.floor).toBe(false);
});

test.each([60, 120])(
    "late airborne corrections stay bounded and settle on the floor at %s Hz",
    (hz) => {
        const store = new LobbyMotionStore();
        store.upsert(player());
        store.observeClock(0, 0, 0);
        let previous = 0;
        let peak = 0;
        for (let frame = 0; frame < hz * 4; frame++) {
            const time = (frame * 1000) / hz;
            if (frame % (hz / 2) === 0) {
                // A delayed double-jump replaces the predicted landing with a
                // high airborne sample; the following snapshot lands again.
                const height = time === 1000 ? 2 : 0;
                store.pushFrame(
                    frame + 1,
                    time,
                    [
                        [
                            "peer",
                            {
                                ...pose(0),
                                y: height,
                                vx: 0,
                                vy: 0,
                                vz: 0,
                                floor: height === 0,
                            },
                        ],
                    ],
                    time
                );
            }
            const shown = store.sample(time)[0];
            expect(Math.abs(shown.y - previous) * hz).toBeLessThanOrEqual(
                12.001
            );
            expect(shown.floor).toBe(shown.y <= 0.001);
            peak = Math.max(peak, shown.y);
            previous = shown.y;
        }
        expect(peak).toBeGreaterThan(1);
        expect(previous).toBe(0);
    }
);

test.each([60, 120].flatMap((hz) => [2, 5, 20].map((sendHz) => [hz, sendHz])))(
    "a known stop endpoint brakes without overshooting at %s render Hz / %s send Hz",
    (hz, sendHz) => {
        const store = new LobbyMotionStore();
        store.upsert(player());
        store.observeClock(0, 0, 0);
        const stopTime = 3066.6666667,
            end = stopTime * 0.004;
        let peak = 0,
            backwards = 0,
            previous = 0;
        for (let frame = 0; frame < hz * 6; frame++) {
            const time = (frame * 1000) / hz;
            if (frame % (hz / sendHz) === 0)
                store.pushFrame(
                    frame + 1,
                    time,
                    [
                        [
                            "peer",
                            {
                                ...pose(Math.min(time, stopTime) * 0.004),
                                vx: time < stopTime ? 4 : 0,
                                vy: 0,
                                vz: 0,
                            },
                        ],
                    ],
                    time
                );
            const shown = store.sample(time)[0];
            if (time > 3000) {
                peak = Math.max(peak, shown.x);
                backwards += Math.max(0, previous - shown.x);
            }
            previous = shown.x;
        }
        expect(peak - end).toBeLessThan(0.002);
        expect(backwards).toBeLessThan(0.002);
        expect(previous).toBeCloseTo(end, 4);
    }
);

test("a frozen moving snapshot cannot confirm resting idle, but an explicit stop can", () => {
    const store = new LobbyMotionStore();
    store.upsert(player());
    store.observeClock(0, 0, 0);
    store.pushFrame(1, 0, [["peer", { ...pose(0), vx: 4, vy: 0, vz: 0 }]], 0);
    for (let time = 0; time <= 10000; time += 20) store.sample(time);
    expect(store.sample(10020)[0].restConfirmed).toBe(false);
    store.pushFrame(
        2,
        10040,
        [["peer", { ...pose(0), vx: 0, vy: 0, vz: 0 }]],
        10040
    );
    expect(store.sample(10060)[0].restConfirmed).toBe(true);
});

test("a lost airborne snapshot at its apex does not confirm resting after predicted landing", () => {
    const store = new LobbyMotionStore();
    store.upsert(player());
    store.observeClock(0, 0, 0);
    store.pushFrame(
        1,
        0,
        [["peer", { ...pose(0), y: 1, vx: 0, vy: 0, vz: 0, floor: undefined }]],
        0
    );
    for (let time = 0; time < 10000; time += 20) store.sample(time);
    expect(store.sample(10000)[0].restConfirmed).toBe(false);
});
