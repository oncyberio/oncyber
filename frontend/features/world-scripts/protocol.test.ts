import { cleanOp, cleanOps, cleanColor, WORLD_SCRIPT_LIMITS } from "./protocol";

describe("world script requests", () => {
    it("keeps a clean add and fills in the shape", () => {
        expect(
            cleanOp({
                op: "add",
                id: "npc-1",
                props: { position: [1, 2, 3], color: "red", glow: true },
            })
        ).toEqual({
            op: "add",
            id: "npc-1",
            props: {
                position: [1, 2, 3],
                color: "#ff3b30",
                glow: true,
                shape: "box",
            },
        });
    });

    it("refuses ids that could be markup or paths", () => {
        expect(
            cleanOp({ op: "add", id: "<img onerror=x>", props: {} })
        ).toBeNull();
        expect(cleanOp({ op: "remove", id: "../../x" })).toBeNull();
        expect(
            cleanOp({ op: "set", id: "x".repeat(41), props: {} })
        ).toBeNull();
    });

    it("clamps numbers and drops what isn't a number", () => {
        const op: any = cleanOp({
            op: "set",
            id: "a",
            props: {
                position: [1e9, -1e9, NaN],
                scale: 0,
                opacity: 4,
                size: { x: 1, y: 2, z: 3 },
            },
        });
        expect(op.props.position).toBeUndefined();
        expect(op.props.scale).toEqual([0.001, 0.001, 0.001]);
        expect(op.props.opacity).toBe(1);
        expect(op.props.size).toEqual([1, 2, 3]);
        const far: any = cleanOp({
            op: "set",
            id: "a",
            props: { position: [1e9, 0, 0] },
        });
        expect(far.props.position).toEqual([
            WORLD_SCRIPT_LIMITS.maxCoordinate,
            0,
            0,
        ]);
    });

    it("never lets a set change the shape", () => {
        const op: any = cleanOp({
            op: "set",
            id: "a",
            props: { shape: "sphere" },
        });
        expect(op.props.shape).toBeUndefined();
    });

    it("accepts only known colours, sounds and corners", () => {
        expect(cleanColor("#ABC")).toBe("#abc");
        expect(cleanColor("url(javascript:x)")).toBeUndefined();
        expect(cleanOp({ op: "sound", name: "../../etc" })).toBeNull();
        expect(
            cleanOp({ op: "hud", key: "s", text: "hi", corner: "middle" })
        ).toMatchObject({ corner: "top-left" });
    });

    it("cuts text and strips control characters", () => {
        const op: any = cleanOp({
            op: "toast",
            text: "a\u0000b" + "c".repeat(500),
            seconds: 999,
        });
        expect(op.text.startsWith("ab")).toBe(true);
        expect(op.text.length).toBe(WORLD_SCRIPT_LIMITS.maxTextLength);
        expect(op.seconds).toBe(WORLD_SCRIPT_LIMITS.maxSeconds);
    });

    it("refuses unknown requests and caps a batch", () => {
        expect(cleanOp({ op: "eval", code: "x" })).toBeNull();
        const many = Array.from(
            { length: WORLD_SCRIPT_LIMITS.maxOpsPerTick + 10 },
            () => ({ op: "hud-clear" })
        );
        const { ops, dropped } = cleanOps([...many, { op: "nope" }]);
        expect(ops).toHaveLength(WORLD_SCRIPT_LIMITS.maxOpsPerTick);
        expect(dropped).toBe(11);
        expect(cleanOps("not a list")).toEqual({ ops: [], dropped: 0 });
    });
});
