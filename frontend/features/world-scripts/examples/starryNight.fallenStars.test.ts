import fs from "fs";
import path from "path";
import { WORLD_SCRIPT_LIMITS } from "../basics";
import { cleanOps } from "../protocol";
import { runScript } from "../scriptSandbox.jest";

const SOURCE = fs.readFileSync(
    path.join(__dirname, "starryNight.fallenStars.js"),
    "utf-8"
);

const of = (ops: any[], op: string) => ops.filter((item) => item.op === op);
const hud = (ops: any[], key: string) =>
    of(ops, "hud")
        .filter((item) => item.key === key)
        .pop()?.text;

/** What was added under ids like this, as { id, ...props }. */
const added = (ops: any[], ids: RegExp) =>
    of(ops, "add")
        .filter((item) => ids.test(item.id))
        .map((item) => ({ id: item.id, ...item.props }));
const stars = (ops: any[]) => added(ops, /^star-\d+$/);

describe("Starry Night's script, Fallen stars", () => {
    test("fits in a saved script and asks only for what the host takes", () => {
        expect(Buffer.byteLength(SOURCE)).toBeLessThan(
            WORLD_SCRIPT_LIMITS.maxSourceBytes
        );
        const script = runScript(SOURCE);
        expect(script.errors()).toEqual([]);
        const asked = script.ops();
        const checked = cleanOps(asked);
        expect(checked.dropped).toBe(0);
        expect(checked.ops).toHaveLength(asked.length);
    });

    test("starts with seven stars, seven dark lanterns and the goal", () => {
        const script = runScript(SOURCE);
        const ops = script.ops();
        expect(stars(ops)).toHaveLength(7);
        const lamps = added(ops, /^lantern-\d+\.lamp$/);
        expect(lamps).toHaveLength(7);
        expect(lamps.every((lamp) => !lamp.glow)).toBe(true);
        expect(hud(ops, "score")).toBe("Stars 0/7");
        expect(hud(ops, "goal")).toMatch(/Catch them/);
    });

    test("walking up to a star catches it and lights the next lantern", () => {
        const script = runScript(SOURCE);
        const [first] = stars(script.ops());
        // Far away: nothing is caught.
        expect(hud(script.tick(), "score")).toBeUndefined();
        const [x, y, z] = first.position;
        const ops = script.tick(1 / 60, [x, y - 1.25, z]);
        expect(script.errors()).toEqual([]);
        expect(hud(ops, "score")).toBe("Stars 1/7");
        const set = (id: string) =>
            of(ops, "set").find((item) => item.id === id)?.props;
        expect(set("star-0")).toMatchObject({ visible: false });
        expect(set("lantern-0.lamp")).toMatchObject({ glow: true });
        expect(of(ops, "sound")[0]).toMatchObject({ name: "coin" });
    });

    test("a star on the road is not caught from the floor below", () => {
        const script = runScript(SOURCE);
        const [x, y, z] = stars(script.ops())[0].position;
        script.tick(1 / 60, [x, y - 8, z]);
        expect(hud(script.ops(), "score")).toBe("Stars 0/7");
    });

    test("all seven light the way, and R scatters them again", () => {
        const script = runScript(SOURCE);
        let last: any[] = [];
        for (const star of stars(script.ops())) {
            const [x, y, z] = star.position;
            last = script.tick(1 / 60, [x, y - 1.25, z]);
        }
        expect(hud(last, "score")).toBe("Stars 7/7");
        expect(hud(last, "goal")).toMatch(/The way is lit/);
        expect(of(last, "banner")[0]).toMatchObject({
            text: "The way is lit",
        });
        script.send({ t: "key", down: true, key: "r", code: "KeyR" });
        script.tick();
        expect(script.posted.some((message) => message.t === "restart")).toBe(
            true
        );
    });
});
