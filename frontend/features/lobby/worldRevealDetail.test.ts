import { getWorldRevealDetail } from "./worldRevealDetail";

test("detail uses an owned snapshot of the camera, including native getter-only vectors", () => {
    let x = 2;
    const camera = {
        get x() {
            return x;
        },
        get y() {
            return 1.8;
        },
        get z() {
            return 4;
        },
    };
    const policy = getWorldRevealDetail(
        camera,
        { x: 0, y: 0, z: -1 },
        { x: 0, y: 0, z: 0 }
    );
    x = 900;
    expect(policy).toMatchObject({
        minCellSize: 0.25,
        maxCellSize: 4,
        focus: { x: 2, y: 1.8, z: 4 },
        forward: { x: 0, y: 0, z: -1 },
    });
});

test.each([NaN, Infinity, 1000])(
    "an invalid or stale spawn camera (%s) keeps detail at the player",
    (x) => {
        const policy = getWorldRevealDetail(
            { x, y: 2, z: 0 },
            { x: 0, y: 0, z: -1 },
            { x: 3, y: 0, z: 4 }
        );
        expect(policy.focus).toEqual({ x: 3, y: 0, z: 4 });
    }
);
