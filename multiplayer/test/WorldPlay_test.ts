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
        const zone = new PlayZone(volleyball(), 2);
        run(zone, 180);
        const [x, , z] = zone.poses;
        // Stand just behind the ball, facing +x.
        assert.ok(zone.setPerson(1, x - 0.6, 0, z, Math.PI / 2));
        zone.step();
        assert.strictEqual(zone.hit(1), 1);
        assert.strictEqual(zone.hit(1), 0, "a second hit straight away");
        assert.strictEqual(zone.hit(99), 0, "someone who is not here");
        run(zone, 20);
        assert.ok(zone.poses[0] > x + 0.5, "it went forward");
        assert.ok(zone.poses[1] > 1, "and up");
        zone.free();
    });

    it("scores a hit ball for the side it did not land on, then serves it again", () => {
        const zone = new PlayZone(volleyball(), 2);
        run(zone, 180);
        assert.deepStrictEqual(zone.score(), [0, 0], "the first drop scores nothing");
        // Hit the ball towards +x, hard enough to clear the net from anywhere on side A.
        const [x, , z] = zone.poses;
        zone.setPerson(1, x - 0.6, 0, z, Math.PI / 2);
        zone.step();
        zone.hit(1);
        zone.removePerson(1);
        let landed: number | null = null;
        for (let i = 0; i < 600 && landed === null; i++) {
            zone.step();
            if (zone.score()[0] + zone.score()[1]) landed = zone.poses[0];
        }
        assert.ok(landed !== null && landed > 0, `it landed on side B: ${landed}`);
        assert.deepStrictEqual(zone.score(), [1, 0]);
        // A second later it hangs above the court again, on the side that lost the point.
        run(zone, 62);
        assert.ok(zone.poses[1] > 2.5 && zone.poses[0] > 0, `served at ${zone.poses[0]}, ${zone.poses[1]}`);
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
