/** @jest-environment jsdom */
import {
    readWorldRevealFitHint,
    rememberWorldRevealFitHint,
} from "./worldRevealFitHints";
const settings = {
    cellSize: 0.5,
    radius: 18,
    coverage: "all" as const,
    maxTriangles: 90000,
};
const storageKey = "oncyber:world-reveal-fit:v2";
beforeEach(() => window.sessionStorage.clear());
afterEach(() => jest.restoreAllMocks());

test("a successful arrival fit becomes the next departure's first trial without retaining geometry", () => {
    const scene = {};
    expect(readWorldRevealFitHint(scene, settings)).toBe(0.5);
    rememberWorldRevealFitHint(scene, settings, {
        cellSize: 2,
        budgetLimited: false,
    });
    expect(readWorldRevealFitHint(scene, settings)).toBe(2);
    rememberWorldRevealFitHint(scene, settings, {
        cellSize: 4,
        budgetLimited: true,
    });
    expect(readWorldRevealFitHint(scene, settings)).toBe(2);
    expect(readWorldRevealFitHint({}, settings)).toBe(0.5);
    expect(window.sessionStorage.length).toBe(0);
});

test("same-tab revisits reuse bounded numeric hints while changed fit limits invalidate them", () => {
    rememberWorldRevealFitHint(
        {},
        settings,
        { cellSize: 2, budgetLimited: false },
        "/wanimal-blue"
    );
    const replacementScene = {};
    expect(
        readWorldRevealFitHint(replacementScene, settings, "/wanimal-blue")
    ).toBe(2);
    expect(readWorldRevealFitHint({}, settings, "/other-space")).toBe(0.5);
    expect(
        readWorldRevealFitHint(
            replacementScene,
            { ...settings, maxTriangles: 45000 },
            "/wanimal-blue"
        )
    ).toBe(0.5);
    expect(
        readWorldRevealFitHint(
            replacementScene,
            { ...settings, radius: 10 },
            "/wanimal-blue"
        )
    ).toBe(0.5);
    const saved = JSON.parse(window.sessionStorage.getItem(storageKey));
    expect(saved).toEqual([
        expect.objectContaining({ destination: "/wanimal-blue", cellSize: 2 }),
    ]);
    expect(Object.keys(saved[0]).sort()).toEqual([
        "cellSize",
        "destination",
        "signature",
        "updatedAt",
    ]);
});

test("storage failures cannot interrupt a reveal or lose its live-scene hint", () => {
    const scene = {};
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("storage disabled");
    });
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("storage disabled");
    });
    expect(readWorldRevealFitHint(scene, settings, "/space")).toBe(0.5);
    expect(() =>
        rememberWorldRevealFitHint(
            scene,
            settings,
            { cellSize: 2, budgetLimited: false },
            "/space"
        )
    ).not.toThrow();
    expect(readWorldRevealFitHint(scene, settings, "/space")).toBe(2);
});

test("persistent hint storage stays bounded and expires across visits", () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(100000000);
    for (let index = 0; index < 40; index++)
        rememberWorldRevealFitHint(
            {},
            settings,
            { cellSize: 2, budgetLimited: false },
            `/space-${index}`
        );
    expect(JSON.parse(window.sessionStorage.getItem(storageKey))).toHaveLength(
        24
    );
    expect(readWorldRevealFitHint({}, settings, "/space-0")).toBe(0.5);
    expect(readWorldRevealFitHint({}, settings, "/space-39")).toBe(2);
    now.mockReturnValue(100000000 + 7 * 60 * 60 * 1000);
    expect(readWorldRevealFitHint({}, settings, "/space-39")).toBe(0.5);
});

test("corrupt storage and invalid or incomplete fit results cannot change tile resolution", () => {
    const scene = {};
    for (const value of [
        "{",
        "{}",
        JSON.stringify([{ destination: "/space", cellSize: Infinity }]),
        "x".repeat(17000),
    ]) {
        window.sessionStorage.setItem(storageKey, value);
        expect(readWorldRevealFitHint(scene, settings, "/space")).toBe(0.5);
    }
    for (const cellSize of [NaN, Infinity, 0.1, 9])
        rememberWorldRevealFitHint(scene, settings, {
            cellSize,
            budgetLimited: false,
        });
    rememberWorldRevealFitHint(scene, settings, {
        cellSize: 2,
        budgetLimited: true,
    });
    expect(readWorldRevealFitHint(scene, settings)).toBe(0.5);
});

test("refinement quality changes invalidate coarse fit hints", () => {
    const scene = {};
    const refined = {
        ...settings,
        refinement: { minCellSize: 0.5, maxCellSize: 8 },
    };
    rememberWorldRevealFitHint(
        scene,
        refined,
        { cellSize: 2, budgetLimited: false },
        "/wanimal-blue"
    );
    expect(readWorldRevealFitHint({}, refined, "/wanimal-blue")).toBe(2);
    expect(
        readWorldRevealFitHint(
            scene,
            { ...refined, refinement: { minCellSize: 1, maxCellSize: 8 } },
            "/wanimal-blue"
        )
    ).toBe(0.5);
    expect(
        readWorldRevealFitHint(
            scene,
            { ...refined, refinement: { minCellSize: 0.5, maxCellSize: 4 } },
            "/wanimal-blue"
        )
    ).toBe(0.5);
});

test("coarse fits from the previous image-shell partition policy are not reused", () => {
    rememberWorldRevealFitHint(
        {},
        settings,
        { cellSize: 8, budgetLimited: false },
        "/crypto-trap-house"
    );
    const current = JSON.parse(window.sessionStorage.getItem(storageKey));
    const oldSignature = JSON.stringify(
        JSON.parse(current[0].signature).slice(1)
    );
    window.sessionStorage.setItem(
        "oncyber:world-reveal-fit:v1",
        JSON.stringify([{ ...current[0], signature: oldSignature }])
    );
    window.sessionStorage.removeItem(storageKey);
    expect(readWorldRevealFitHint({}, settings, "/crypto-trap-house")).toBe(
        0.5
    );
    window.sessionStorage.setItem(
        storageKey,
        JSON.stringify([{ ...current[0], signature: oldSignature }])
    );
    expect(readWorldRevealFitHint({}, settings, "/crypto-trap-house")).toBe(
        0.5
    );
});

test("rigid prop policy changes invalidate a coarse fit without keying it to camera movement", () => {
    const scene = {};
    const detailed = {
        ...settings,
        refinement: {
            minCellSize: 0.25,
            maxCellSize: 4,
            focus: { x: 0, y: 1, z: 2 },
        },
        rigidProps: {
            minTriangles: 5000,
            maxExtent: 5,
            maxSources: 64,
            maxTriangles: 400000,
        },
    };
    rememberWorldRevealFitHint(scene, detailed, {
        cellSize: 2,
        budgetLimited: false,
    });
    expect(
        readWorldRevealFitHint(scene, {
            ...detailed,
            refinement: { ...detailed.refinement, focus: { x: 5, y: 2, z: 1 } },
        })
    ).toBe(2);
    expect(
        readWorldRevealFitHint(scene, {
            ...detailed,
            rigidProps: { ...detailed.rigidProps, maxExtent: 3 },
        })
    ).toBe(0.5);
});
