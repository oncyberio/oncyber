import assert from "assert";
import { PLAY_LIMITS, decodeBodies, decodePeople, encodeBodies, encodePeople, playBodies, readPlayRecipe } from "../protocol/play-zone";
import { PlayZone, loadPlayPhysics } from "../src/world/play";

const ballPit = () => readPlayRecipe({ title: "Ball pit", seconds: 30, things: [{ kind: "ball", count: 120, size: 0.18, bounce: 0.5 }] })!;
const volleyball = () =>
    readPlayRecipe({
        title: "Volleyball",
        seconds: 60,
        arena: { halfX: 6, halfZ: 4, net: 1.6 },
        things: [{ kind: "ball", count: 1, size: 0.25, bounce: 0.7, weight: 0.2, drop: "center" }],
        hit: { reach: 1.4, power: 12, lift: 0.7 },
        score: "floor-touch",
    })!;
/** The same court without its net, for hits whose path should not depend on where the ball came to rest. */
const openCourt = () => readPlayRecipe({ ...volleyball(), arena: { halfX: 6, halfZ: 4, net: 0 } })!;
const run = (zone: PlayZone, steps: number) => {
    for (let i = 0; i < steps; i++) zone.step();
};

describe("play recipes", () => {
    it("clamps every number and caps the bodies", () => {
        const recipe = readPlayRecipe({
            title: "x".repeat(200),
            seconds: 99999,
            gravity: -4,
            arena: { halfX: 500, halfZ: 0.1, net: 99 },
            things: [
                { kind: "rocket", count: 1e9, size: 50, bounce: 7, weight: 0 },
                { kind: "box", count: 10 },
            ],
            hit: { reach: 100, power: 1000, lift: 5 },
            score: "anything",
        })!;
        assert.strictEqual(recipe.title.length, 60);
        assert.strictEqual(recipe.seconds, PLAY_LIMITS.seconds[1]);
        assert.strictEqual(recipe.gravity, PLAY_LIMITS.gravity[0]);
        assert.deepStrictEqual(recipe.arena, { halfX: 15, halfZ: 3, walls: true, net: 3 });
        // The first thing takes the whole budget, so the second is left out.
        assert.deepStrictEqual(recipe.things, [{ kind: "ball", count: PLAY_LIMITS.bodies, size: 1.5, bounce: 1, weight: 0.05, drop: "rain", color: 0 }]);
        assert.deepStrictEqual(recipe.hit, { reach: 3, power: 30, lift: 1 });
        assert.strictEqual(recipe.score, "none");
        assert.strictEqual(playBodies(recipe).length, PLAY_LIMITS.bodies);
    });

    it("is nothing without a thing to play with", () => {
        for (const value of [null, "ball", [], {}, { things: [] }, { things: [{ count: 0 }] }, { things: "many" }]) assert.strictEqual(readPlayRecipe(value), null);
    });

    it("reads its own output unchanged", () => {
        const recipe = volleyball();
        assert.deepStrictEqual(readPlayRecipe(JSON.parse(JSON.stringify(recipe))), recipe);
    });
});

describe("play frames", () => {
    it("carries poses to the centimetre and rotations closely", () => {
        const poses = new Float32Array(3 * 7);
        poses.set([1.234, 5.678, -9.012, 0, 0, 0, 1], 0);
        poses.set([-150.5, 0.18, 327.0, 0.5, -0.5, 0.5, -0.5], 7);
        const s = Math.SQRT1_2;
        poses.set([0, 0, 0, s, 0, 0, s], 14);
        const frames = encodeBodies(77, [0, 1, 2], poses, 2);
        assert.deepStrictEqual(
            frames.map((frame) => frame.byteLength),
            [7 + 24, 7 + 12]
        );
        const out = new Float32Array(3 * 7);
        const read = frames.map((frame) => decodeBodies(frame, out)!);
        assert.deepStrictEqual(read, [
            { tick: 77, indices: [0, 1] },
            { tick: 77, indices: [2] },
        ]);
        for (let i = 0; i < 3; i++) {
            for (let k = 0; k < 3; k++) assert.ok(Math.abs(out[i * 7 + k] - poses[i * 7 + k]) <= 0.006, `position ${i}.${k}`);
            // q and -q are the same rotation.
            let dot = 0;
            for (let k = 3; k < 7; k++) dot += out[i * 7 + k] * poses[i * 7 + k];
            assert.ok(Math.abs(dot) > 0.9999, `rotation ${i}: ${dot}`);
        }
    });

    it("refuses frames that are not whole, and ignores bodies it has no room for", () => {
        const poses = new Float32Array(2 * 7);
        poses[6] = poses[13] = 1;
        const [frame] = encodeBodies(1, [0, 1], poses);
        assert.strictEqual(decodeBodies(frame.subarray(0, frame.length - 1), poses), null);
        assert.strictEqual(decodeBodies(new Uint8Array([2, 0, 0, 0, 0, 0, 0]), poses), null);
        assert.deepStrictEqual(decodeBodies(frame, new Float32Array(7))!.indices, [0]);
    });

    it("carries people", () => {
        const frame = encodePeople(9, [
            { id: 7, x: 1.5, y: 0, z: -2.25, yaw: Math.PI / 2 },
            { id: 65535, x: -3, y: 1, z: 4, yaw: -Math.PI / 2 },
        ]);
        const { tick, people } = decodePeople(frame)!;
        assert.strictEqual(tick, 9);
        assert.deepStrictEqual(
            people.map((p) => [p.id, p.x, p.y, p.z]),
            [
                [7, 1.5, 0, -2.25],
                [65535, -3, 1, 4],
            ]
        );
        assert.ok(Math.abs(people[0].yaw - Math.PI / 2) < 0.02);
        assert.ok(Math.abs(people[1].yaw - (Math.PI * 3) / 2) < 0.02);
        assert.strictEqual(decodePeople(frame.subarray(1)), null);
    });
});

describe("play zone", () => {
    before(() => loadPlayPhysics());

    it("drops things that come to rest on the floor inside the walls", () => {
        const zone = new PlayZone(ballPit(), 3);
        run(zone, 600);
        for (let i = 0; i < zone.count; i++) {
            const [x, y, z] = zone.poses.subarray(i * 7, i * 7 + 3);
            assert.ok(Math.abs(x) <= 8 && Math.abs(z) <= 8, `thing ${i} left the arena: ${x}, ${z}`);
            assert.ok(y > 0.1 && y < 1.2, `thing ${i} is not resting: ${y}`);
        }
        zone.free();
    });

    it("plays out the same from the same seed, and differently from another", () => {
        const play = (seed: number) => {
            const zone = new PlayZone(ballPit(), seed);
            zone.setPerson(1, -6, 0, 0, 0);
            for (let i = 0; i < 300; i++) {
                zone.setPerson(1, -6 + i * 0.04, 0, 0, Math.PI / 2);
                zone.step();
            }
            const print = zone.fingerprint();
            zone.free();
            return print;
        };
        assert.strictEqual(play(5), play(5));
        assert.notStrictEqual(play(5), play(6));
    });

    it("lets a person walking through push things aside", () => {
        const recipe = readPlayRecipe({ seconds: 30, arena: { halfX: 6, halfZ: 6 }, things: [{ kind: "ball", count: 1, size: 0.3, drop: "center", bounce: 0 }] })!;
        const zone = new PlayZone(recipe, 1);
        run(zone, 240);
        const before = zone.poses[0];
        // Walk along x through the ball at walking pace.
        for (let i = 0; i < 180; i++) {
            zone.setPerson(4, -4 + i * 0.03, 0, zone.poses[2], Math.PI / 2);
            zone.step();
        }
        assert.ok(zone.poses[0] > before + 0.5, `the ball moved from ${before} to ${zone.poses[0]}`);
        zone.free();
    });

    it("sends a hit thing the way the person faces, with a rest between hits", () => {
        const zone = new PlayZone(openCourt(), 2);
        run(zone, 180);
        const [x, , z] = zone.poses;
        // Stand just behind the ball, facing the far end.
        const way = x < 0 ? 1 : -1;
        assert.ok(zone.setPerson(1, x - way * 0.6, 0, z, (way * Math.PI) / 2));
        zone.step();
        assert.strictEqual(zone.hit(1), 1);
        assert.strictEqual(zone.hit(1), 0, "a second hit straight away");
        assert.strictEqual(zone.hit(99), 0, "someone who is not here");
        run(zone, 20);
        assert.ok((zone.poses[0] - x) * way > 0.5, "it went forward");
        assert.ok(zone.poses[1] > 1, "and up");
        zone.free();
    });

    it("scores a hit ball for the side it did not land on, then serves it again", () => {
        const zone = new PlayZone(volleyball(), 2);
        run(zone, 180);
        assert.deepStrictEqual(zone.score(), [0, 0], "the first drop scores nothing");
        // Hit the ball. It may clear the net or come back off it; either way it lands on one side.
        const [x, , z] = zone.poses;
        const way = x < 0 ? 1 : -1;
        zone.setPerson(1, x - way * 0.6, 0, z, (way * Math.PI) / 2);
        zone.step();
        assert.strictEqual(zone.hit(1), 1);
        zone.removePerson(1);
        let landed: number | null = null;
        for (let i = 0; i < 600 && landed === null; i++) {
            zone.step();
            if (zone.score()[0] + zone.score()[1]) landed = zone.poses[0];
        }
        assert.ok(landed !== null, "it landed");
        // Side A is x < 0. Landing on a side is a point for the other one.
        assert.deepStrictEqual(zone.score(), landed! < 0 ? [0, 1] : [1, 0]);
        // A second later it hangs above the court again, on the side that lost the point.
        run(zone, 62);
        assert.ok(zone.poses[1] > 2.5 && zone.poses[0] * landed! > 0, `served at ${zone.poses[0]}, ${zone.poses[1]}`);
        zone.free();
    });

    it("lets a ball hit hard from the back of the court clear the net", () => {
        const zone = new PlayZone(volleyball(), 2);
        run(zone, 180);
        // Get the ball away from the net first: hit it towards the back wall and let it settle.
        const [x, , z] = zone.poses;
        const away = x < 0 ? -1 : 1;
        zone.setPerson(1, x - away * 0.6, 0, z, (away * Math.PI) / 2);
        zone.step();
        zone.hit(1);
        zone.removePerson(1);
        run(zone, 400);
        // Wherever it came to rest on that side, a hit back towards the net from there goes over.
        const [rest, , restZ] = zone.poses;
        assert.ok(Math.abs(rest) > 1.5, `it rests back from the net: ${rest}`);
        const before = zone.score();
        zone.setPerson(2, rest + away * 0.6, 0, restZ, (-away * Math.PI) / 2);
        zone.step();
        assert.strictEqual(zone.hit(2), 1);
        zone.removePerson(2);
        let crossed = false;
        for (let i = 0; i < 240 && !crossed; i++) {
            zone.step();
            crossed = zone.poses[0] * away < -0.5;
        }
        assert.ok(crossed, `it crossed the net from ${rest}; now at ${zone.poses[0]}`);
        assert.ok(zone.score()[0] + zone.score()[1] >= before[0] + before[1]);
        zone.free();
    });

    it("counts sides and ends on time", () => {
        const recipe = readPlayRecipe({ seconds: 5, things: [{ kind: "box", count: 20, size: 0.2, drop: "sides" }], score: "side-count" })!;
        const zone = new PlayZone(recipe, 4);
        assert.strictEqual(zone.stepsLeft, 300);
        run(zone, 299);
        assert.strictEqual(zone.done, false);
        zone.step();
        assert.strictEqual(zone.done, true);
        const [a, b] = zone.score();
        assert.strictEqual(a + b, 20);
        zone.free();
    });

    it("sends what moved, stops sending what rests, and keeps refreshing a few", () => {
        const zone = new PlayZone(ballPit(), 3);
        const everything = zone.fullFrames();
        assert.strictEqual(
            everything.reduce((n, frame) => n + (frame.byteLength - 7) / 12, 0),
            120
        );
        assert.ok(everything.every((frame) => frame.byteLength <= 1200));
        // A sixth of a second of falling is well past the centimetre that counts as moving.
        run(zone, 10);
        const count = (frames: Uint8Array[]) => frames.reduce((n, frame) => n + (frame.byteLength - 7) / 12, 0);
        assert.strictEqual(count(zone.frames()), 120, "everything is falling");
        // Sent poses are not sent again until they move.
        assert.strictEqual(count(zone.frames()), 16);
        run(zone, 900);
        zone.frames();
        zone.step();
        assert.ok(count(zone.frames()) <= 24, "at rest only the refresh goes out");
        zone.free();
    });

    it("starts the things two recipes share in the same places", () => {
        const small = new PlayZone(readPlayRecipe({ things: [{ kind: "ball", count: 50, size: 0.18 }] })!, 9);
        const large = new PlayZone(readPlayRecipe({ things: [{ kind: "ball", count: 80, size: 0.18 }] })!, 9);
        assert.deepStrictEqual(Array.from(large.poses.subarray(0, 50 * 7)), Array.from(small.poses));
        small.free();
        large.free();
    });

    it("says which changes fit the game as it stands", () => {
        const base = { seconds: 30, arena: { halfX: 8, halfZ: 8 }, things: [{ kind: "ball", count: 60, size: 0.18 }] };
        const zone = new PlayZone(readPlayRecipe(base)!, 3);
        zone.setPerson(1, 5, 0, 5, 0);
        run(zone, 300);
        const plan = (change: object) => zone.plan(readPlayRecipe({ ...base, ...change })!);
        assert.strictEqual(plan({}), "same");
        // Rules, feel and things at the end of the list change in place.
        assert.strictEqual(plan({ gravity: 3 }), "live");
        assert.strictEqual(plan({ seconds: 90, title: "New name", score: "side-count", hit: { reach: 1, power: 5, lift: 0.5 } }), "live");
        assert.strictEqual(plan({ things: [{ kind: "ball", count: 60, size: 0.18, bounce: 0.9, weight: 2, color: 4 }] }), "live");
        assert.strictEqual(plan({ things: [{ kind: "ball", count: 100, size: 0.18 }] }), "live");
        assert.strictEqual(plan({ things: [{ kind: "ball", count: 20, size: 0.18 }] }), "live");
        assert.strictEqual(
            plan({
                things: [
                    { kind: "ball", count: 60, size: 0.18 },
                    { kind: "box", count: 10, size: 0.3 },
                ],
            }),
            "live"
        );
        assert.strictEqual(plan({ arena: { halfX: 12, halfZ: 12 } }), "live");
        // A different size or kind, or an arena that no longer holds everyone, needs the start of the round.
        assert.strictEqual(plan({ things: [{ kind: "ball", count: 60, size: 0.3 }] }), "reset");
        assert.strictEqual(plan({ things: [{ kind: "box", count: 60, size: 0.18 }] }), "reset");
        assert.strictEqual(plan({ arena: { halfX: 3, halfZ: 3 } }), "reset");
        zone.free();
    });

    it("changes in place even when things rest against the walls", () => {
        // Enough balls in a small arena that some are pressed into every wall.
        const base = { seconds: 30, arena: { halfX: 3, halfZ: 3 }, things: [{ kind: "ball", count: 150, size: 0.18 }] };
        const zone = new PlayZone(readPlayRecipe(base)!, 3);
        run(zone, 500);
        let againstWall = 0;
        for (let i = 0; i < zone.count; i++) if (Math.abs(zone.poses[i * 7]) > 3 - 0.18 - 0.01) againstWall++;
        assert.ok(againstWall > 3, `${againstWall} balls touch a side wall`);
        assert.strictEqual(zone.plan(readPlayRecipe({ ...base, gravity: 2.5 })!), "live");
        zone.free();
    });

    it("refuses a net through someone standing on the line", () => {
        const base = { seconds: 30, things: [{ kind: "ball", count: 1, size: 0.2 }] };
        const zone = new PlayZone(readPlayRecipe(base)!, 1);
        zone.setPerson(1, 0.1, 0, 0, 0);
        run(zone, 120);
        const net = readPlayRecipe({ ...base, arena: { net: 1.5 } })!;
        assert.strictEqual(zone.plan(net), "reset");
        zone.setPerson(1, 3, 0, 0, 0);
        // The ball came to rest away from the line, so only the person was in the way.
        assert.strictEqual(Math.abs(zone.poses[0]) > 0.3 ? zone.plan(net) : "live", "live");
        zone.free();
    });

    it("changes a running game in place: nothing moves, and the new rules hold", () => {
        const base = { seconds: 30, things: [{ kind: "ball", count: 40, size: 0.18 }] };
        const zone = new PlayZone(readPlayRecipe(base)!, 3);
        run(zone, 400);
        const before = Array.from(zone.poses),
            tick = zone.tick;
        const next = readPlayRecipe({ ...base, gravity: 2, seconds: 60, things: [{ kind: "ball", count: 55, size: 0.18, bounce: 0.9 }] })!;
        assert.strictEqual(zone.plan(next), "live");
        zone.apply(next);
        assert.strictEqual(zone.tick, tick, "the clock carries on");
        assert.strictEqual(zone.count, 55);
        assert.deepStrictEqual(Array.from(zone.poses.subarray(0, 40 * 7)), before, "what was there stayed put");
        assert.ok(zone.poses[40 * 7 + 1] > 1.5, "the new ones start in the air");
        // Under a fifth of the gravity a new ball falls much less far in half a second.
        const top = zone.poses[40 * 7 + 1];
        run(zone, 30);
        const fell = top - zone.poses[40 * 7 + 1];
        assert.ok(fell > 0.05 && fell < 0.6, `it fell ${fell}`);
        // Taking things away again leaves the rest alone.
        const fewer = readPlayRecipe({ ...base, gravity: 2, things: [{ kind: "ball", count: 10, size: 0.18 }] })!;
        const kept = Array.from(zone.poses.subarray(0, 10 * 7));
        zone.apply(fewer);
        assert.strictEqual(zone.count, 10);
        assert.deepStrictEqual(Array.from(zone.poses), kept);
        run(zone, 10);
        zone.free();
    });

    it("plays the round backwards to its start, where a new game picks up without a jump", () => {
        const recipe = readPlayRecipe({ seconds: 60, things: [{ kind: "ball", count: 30, size: 0.18 }] })!;
        const zone = new PlayZone(recipe, 11);
        const start = Array.from(zone.poses);
        for (let i = 0; i < 300; i++) {
            zone.setPerson(1, -6 + i * 0.03, 0, 0, Math.PI / 2);
            zone.step();
        }
        const rested = zone.poses[1];
        const samples = zone.beginRewind();
        assert.ok(samples >= 50, `${samples} samples for five seconds`);
        const tick = zone.tick;
        zone.step();
        assert.strictEqual(zone.tick, tick, "the game stands still while it rewinds");
        assert.strictEqual(zone.hit(1), 0);
        // Heights climb back up and the person walks back to where they came in.
        let moments = 0,
            lastHeight = rested,
            person = 3;
        for (let moment = zone.rewindFrames(4); moment; moment = zone.rewindFrames(4)) {
            moments++;
            assert.ok(moment.frames.every((frame) => frame.byteLength <= 1200));
            if (moment.people.length) {
                assert.ok(moment.people[0].x <= person + 1e-6, "the person only goes back");
                person = moment.people[0].x;
            }
            lastHeight = zone.poses[1];
        }
        assert.ok(moments >= 12 && moments <= 14, `${moments} moments at a stride of four`);
        assert.ok(lastHeight > rested + 1, "the ball is back up in the air");
        assert.deepStrictEqual(Array.from(zone.poses), start, "it ends exactly where the round began");
        assert.strictEqual(zone.rewindFrames(), null);
        // A different recipe with the same things, started from the same seed, begins right there.
        const again = new PlayZone(readPlayRecipe({ seconds: 60, gravity: 4, things: [{ kind: "ball", count: 30, size: 0.18, bounce: 1 }] })!, 11);
        assert.deepStrictEqual(Array.from(again.poses), start);
        zone.free();
        again.free();
    });

    it("keeps a history that still reaches the start of a long round", () => {
        const zone = new PlayZone(readPlayRecipe({ seconds: 180, things: [{ kind: "ball", count: 2, size: 0.2 }] })!, 5);
        const start = Array.from(zone.poses);
        run(zone, 60 * 150);
        const samples = zone.beginRewind();
        assert.ok(samples <= 601, `${samples} samples after two and a half minutes`);
        let last: number[] = [];
        for (let moment = zone.rewindFrames(20); moment; moment = zone.rewindFrames(20)) last = Array.from(zone.poses);
        assert.deepStrictEqual(last, start);
        zone.free();
    });

    it("turns people away once it is full", () => {
        const zone = new PlayZone(ballPit(), 1);
        for (let id = 1; id <= PLAY_LIMITS.people; id++) assert.ok(zone.setPerson(id, 0, 0, 0, 0));
        assert.strictEqual(zone.setPerson(999, 0, 0, 0, 0), false);
        zone.removePerson(1);
        assert.ok(zone.setPerson(999, 0, 0, 0, 0));
        assert.strictEqual(decodePeople(zone.peopleFrame())!.people.length, PLAY_LIMITS.people);
        zone.free();
    });
});
