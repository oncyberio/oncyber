import assert from "assert";
import { decodeBodies, decodePeople, readPlayRecipe } from "../protocol/play-zone";
import { loadPlayPhysics } from "../src/world/play";
import { PLAY_ASK_COOLDOWN_MS, PlayAuthority } from "../src/world/playAuthority";

const pit = (count = 30) => ({ title: "Ball pit", seconds: 30, things: [{ kind: "ball", count, size: 0.18 }] });

/** Records everything an authority sends. */
function room(options: ConstructorParameters<typeof PlayAuthority>[1] = {}) {
    const controls: Array<{ to: number | "all"; type: string; data: any }> = [];
    const frames: Array<{ to: number | "all"; except: number[]; bytes: Uint8Array[] }> = [];
    const authority = new PlayAuthority(
        {
            control: (type, data) => controls.push({ to: "all", type, data }),
            controlTo: (id, type, data) => controls.push({ to: id, type, data }),
            frames: (bytes, except) => frames.push({ to: "all", except: [...except], bytes }),
            framesTo: (id, bytes) => frames.push({ to: id, except: [], bytes }),
        },
        options
    );
    const of = (type: string) => controls.filter((control) => control.type === type);
    const run = (steps: number) => {
        for (let i = 0; i < steps; i++) authority.step();
    };
    return { authority, controls, frames, of, run };
}
const things = (bytes: Uint8Array[]) => {
    const poses = new Float32Array(400 * 7);
    return bytes.reduce((n, frame) => n + (decodeBodies(frame, poses)?.indices.length || 0), 0);
};

describe("play authority", () => {
    before(() => loadPlayPhysics());

    it("starts a round for everyone and owes each person every thing once", () => {
        const { authority, of, frames, run } = room({ origin: { x: 40, z: -10 } });
        authority.join(1);
        authority.pose(1, 40, 0, -10, 0);
        assert.strictEqual(authority.start({ things: [] }), false);
        assert.ok(authority.start(pit()));
        const [game] = of("play-game");
        assert.deepStrictEqual([game.to, game.data.change, game.data.origin, game.data.recipe.title], ["all", "start", { x: 40, z: -10 }, "Ball pit"]);
        run(3);
        // The person who was there gets everything; the broadcast leaves them out that once.
        assert.deepStrictEqual([frames[0].to, things(frames[0].bytes)], [1, 30]);
        assert.deepStrictEqual([frames[1].to, frames[1].except], ["all", [1]]);
        run(3);
        assert.deepStrictEqual(frames[frames.length - 1].except, []);
        // Someone arriving mid-round is told the game and sent everything.
        authority.join(2);
        assert.deepStrictEqual(of("play-game").pop()!.to, 2);
        run(3);
        assert.ok(frames.some((frame) => frame.to === 2 && things(frame.bytes) === 30));
        authority.free();
    });

    it("counts only the people standing in the arena", () => {
        const { authority, run } = room({ origin: { x: 100, z: 100 } });
        authority.start(pit(5));
        authority.pose(1, 100, 0, 100, 0);
        authority.pose(2, 0, 0, 0, 0);
        run(3);
        const inside = decodePeople(authority.peopleFrame()!)!.people;
        // In the zone's own space, the person at its centre is at 0, 0.
        assert.deepStrictEqual(
            inside.map((person) => [person.id, person.x, person.z]),
            [[1, 0, 0]]
        );
        // Walking in joins; walking out leaves.
        authority.pose(2, 103, 0, 100, 0);
        authority.pose(1, 0, 0, 0, 0);
        run(1);
        assert.deepStrictEqual(
            decodePeople(authority.peopleFrame()!)!.people.map((person) => person.id),
            [2]
        );
        authority.free();
    });

    it("changes the round in place when it fits, and rewinds when it does not", () => {
        const { authority, of, frames, run } = room();
        authority.join(1);
        assert.strictEqual(authority.change(pit()), "start");
        run(240);
        assert.strictEqual(authority.change({ ...pit(), gravity: 2 }), "live");
        assert.strictEqual(of("play-game").pop()!.data.change, "live");
        assert.strictEqual(authority.change({ ...pit(), gravity: 2 }), "same");
        assert.strictEqual(authority.change("nonsense"), "invalid");
        // Bigger balls cannot take over where things lie.
        const bigger = { ...pit(), gravity: 2, things: [{ kind: "ball", count: 30, size: 0.4 }] };
        const tick = authority.zone!.tick,
            sent = frames.length;
        assert.strictEqual(authority.change(bigger), "reset");
        assert.deepStrictEqual(of("play-rewind").pop()!.data, { seconds: 2.5 });
        run(60);
        assert.strictEqual(authority.zone!.tick, tick, "the round stands still while it rewinds");
        assert.ok(frames.length > sent + 10, "and its history is sent, backwards");
        // A swing or a hit does nothing meanwhile.
        authority.act(1);
        assert.strictEqual(of("play-act").length, 0);
        run(200);
        const game = of("play-game").pop()!.data;
        assert.deepStrictEqual([game.change, game.recipe.things[0].size, authority.zone!.recipe.gravity], ["reset", 0.4, 2]);
        assert.ok(authority.zone!.tick < 200, "a new round is under way");
        authority.free();
    });

    it("ends the round on time and reports the score on the way", () => {
        const { authority, of, run } = room();
        authority.start({ ...pit(4), seconds: 5 });
        run(299);
        assert.ok(authority.zone);
        assert.ok(of("play-state").length >= 9);
        run(1);
        assert.strictEqual(authority.zone, null);
        assert.strictEqual(of("play-state").pop()!.data.done, true);
    });

    it("asks the model, applies its answer and says what happened", async () => {
        let clock = 1000;
        const asked: Array<[string, string | null]> = [];
        const { authority, of } = room({
            now: () => clock,
            ask: async (text, current) => {
                asked.push([text, current?.title ?? null]);
                clock += 2300;
                if (/smash/.test(text)) return { say: "A smash.", recipe: null, action: { name: "smash", seconds: 0.8, contact: 0.5, moments: [{ at: 0.5, ease: "in", rightHand: "target" }] }, servedBy: null };
                if (/broken/.test(text)) throw new Error("The model took too long.");
                return { say: "Moon gravity.", recipe: readPlayRecipe({ ...(current || pit()), gravity: 1.6 }), action: null, servedBy: null };
            },
        });
        authority.join(7);
        await authority.ask(7, "  a ball pit\n on the moon ");
        assert.deepStrictEqual(asked, [["a ball pit on the moon", null]]);
        assert.deepStrictEqual(
            of("play-ai").map((message) => [message.to, message.data.state, message.data.say]),
            [
                ["all", "thinking", ""],
                ["all", "done", "Moon gravity."],
            ]
        );
        assert.deepStrictEqual([of("play-ai")[1].data.change, of("play-ai")[1].data.seconds, authority.zone!.recipe.gravity], ["start", 2.3, 1.6]);

        // Too soon after the last one: only the person who asked is told.
        await authority.ask(7, "more");
        assert.deepStrictEqual([of("play-ai")[2].to, of("play-ai")[2].data.state, asked.length], [7, "failed", 1]);
        clock += PLAY_ASK_COOLDOWN_MS;
        await authority.ask(7, "a smash when I hit");
        assert.strictEqual(asked[1][1], "Ball pit", "the model is shown the game in play");
        assert.deepStrictEqual([authority.action!.name, of("play-action")[0].data.action.name, of("play-ai").pop()!.data.action], ["smash", "smash", true]);
        // Someone arriving later is told the move.
        authority.join(8);
        assert.ok(of("play-action").some((message) => message.to === 8));

        clock += PLAY_ASK_COOLDOWN_MS;
        await authority.ask(7, "something broken");
        assert.deepStrictEqual([of("play-ai").pop()!.data.state, of("play-ai").pop()!.data.say], ["failed", "The model took too long."]);
        await authority.ask(8, "   ");
        assert.strictEqual(of("play-ai").pop()!.data.say, "Type what you want after /ai.");
        authority.free();
    });

    it("refuses requests when the server has no model, and one at a time when it has", async () => {
        const none = room();
        await none.authority.ask(1, "more balls");
        assert.deepStrictEqual([none.of("play-ai")[0].to, none.of("play-ai")[0].data.say], [1, "This server has no model to ask."]);

        let release: () => void = () => {};
        const busy = room({ ask: () => new Promise((resolve) => (release = () => resolve({ say: "Done.", recipe: null, action: null, servedBy: null }))) });
        const first = busy.authority.ask(1, "more balls");
        await busy.authority.ask(2, "fewer balls");
        assert.deepStrictEqual([busy.of("play-ai")[1].to, busy.of("play-ai")[1].data.state], [2, "failed"]);
        release();
        await first;
        assert.strictEqual(busy.of("play-ai").pop()!.data.state, "done");
    });
});
