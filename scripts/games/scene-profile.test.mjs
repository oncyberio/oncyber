// node --test scripts/games/scene-profile.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import {
    FIELD,
    SCENE_BUDGETS,
    describeScene,
    sceneDraws,
    sceneProfile,
    servedLog,
} from "./scene-profile.mjs";

const MIB = 1024 * 1024;
const spread = (usual, heavy = usual, peak = heavy) => ({ usual, heavy, peak });
/** A probe reading of a frame that draws `triangles` to the screen. */
const drawn = (triangles, more = {}) => ({
    apis: ["webgl2"],
    frames: 200,
    triangles: spread(triangles),
    calls: spread(40),
    passes: [{ screen: true, triangles, calls: 40 }],
    textures: {
        count: 12,
        bytes: 20 * MIB,
        largest: { width: 2048, height: 2048 },
    },
    canvas: { width: 1280, height: 720, layoutWidth: 1280, layoutHeight: 720 },
    pixelRatio: 1,
    unsized: 0,
    firstDrawAt: 900,
    timeOrigin: 0,
    ...more,
});
const small = [
    { path: "index.html", bytes: 2000 },
    { path: "assets/index.js", bytes: MIB },
];
const codes = (profile) => profile.warnings.map((warning) => warning.code);

test("a light build is within its budgets and says so", () => {
    const profile = sceneProfile({
        drawn: drawn(40_000),
        before: small,
        firstFrameMs: 1200,
    });
    assert.deepEqual(profile.warnings, []);
    assert.equal(profile.start.bytes, MIB + 2000);
    // 1 MiB at 9 Mbit/s is a little under a second.
    assert.equal(profile.start.downloadMs, 934);
    assert.equal(profile.start.estimatedMs, 1200 + 934);
    assert.equal(profile.frame.sceneDraws, 1);
    const lines = describeScene(profile);
    assert.match(lines[0], /1\.0 MiB in 2 files before the first frame/);
    assert.match(lines[1], /a frame draws 40,000 triangles/);
    assert.equal(lines.at(-1), "scene: within its budgets");
});

test("what arrives before the first frame is held to the first-frame budget", () => {
    const before = [
        ...small,
        { path: "assets/world.glb", bytes: 9 * MIB },
        { path: "assets/sky.ktx2", bytes: 3 * MIB },
    ];
    const profile = sceneProfile({
        drawn: drawn(40_000),
        before,
        firstFrameMs: 1200,
    });
    assert.deepEqual(codes(profile), ["SCENE_FIRST_FRAME_WAIT"]);
    const [{ message }] = profile.warnings;
    assert.match(message, /^13 MiB arrive before the first frame: about 12 s/);
    assert.match(
        message,
        /assets\/world\.glb \(9\.0 MiB\), assets\/sky\.ktx2 \(3\.0 MiB\), assets\/index\.js \(1\.0 MiB\)/
    );
    assert.match(message, new RegExp(`${FIELD.startedOfOpened} wait long`));
    // A game that set its own budget is held to that one.
    assert.deepEqual(
        codes(
            sceneProfile({
                drawn: drawn(40_000),
                before,
                firstFrameMs: 1200,
                budgetMs: 20000,
            })
        ),
        []
    );
});

test("triangles: the phone's budget, then the desktop's two", () => {
    const at = (triangles) =>
        sceneProfile({ drawn: drawn(triangles), before: small, firstFrameMs: 1 }) // prettier-ignore
            .warnings;
    assert.deepEqual(at(SCENE_BUDGETS.phoneTriangles), []);
    const phone = at(240_000);
    assert.equal(phone[0].code, "SCENE_TRIANGLES_PHONE");
    assert.match(phone[0].message, /draws 240,000 triangles/);
    assert.match(phone[0].message, /13\.8% of the time on phones, against 6%/);
    const desktop = at(900_000);
    assert.equal(desktop[0].code, "SCENE_TRIANGLES");
    assert.match(desktop[0].message, /over 700,000 .* 15\.3% of the time/);
    const heavy = at(2_000_000);
    assert.equal(heavy.length, 1);
    assert.match(heavy[0].message, /over 1,500,000 .* 29\.8% of the time/);
});

test("the budget is held against a heavy frame, not the usual one", () => {
    const profile = sceneProfile({
        drawn: drawn(0, { triangles: spread(60_000, 180_000, 400_000) }),
        before: small,
        firstFrameMs: 1,
    });
    assert.deepEqual(codes(profile), ["SCENE_TRIANGLES_PHONE"]);
    assert.match(profile.warnings[0].message, /draws 180,000 triangles/);
});

test("a scene drawn more than once a frame is named, a screen effect is not", () => {
    assert.equal(sceneDraws([]), 0);
    assert.equal(
        sceneDraws([
            { screen: false, triangles: 30_000, calls: 20 },
            { screen: true, triangles: 2, calls: 1 },
        ]),
        1
    );
    // Too small for a second pass to matter.
    assert.equal(
        sceneDraws([
            { screen: false, triangles: 400, calls: 4 },
            { screen: true, triangles: 400, calls: 4 },
        ]),
        1
    );
    const passes = [
        { screen: false, triangles: 28_000, calls: 30 },
        { screen: false, triangles: 30_000, calls: 30 },
        { screen: true, triangles: 30_002, calls: 31 },
    ];
    assert.equal(sceneDraws(passes), 3);
    const profile = sceneProfile({
        drawn: drawn(88_002, { passes }),
        before: small,
        firstFrameMs: 1,
    });
    assert.deepEqual(codes(profile), ["SCENE_DRAWN_AGAIN"]);
    assert.match(profile.warnings[0].message, /draws the scene 3 times/);
    assert.match(profile.warnings[0].message, /30,002 triangles to the screen/);
    assert.match(profile.warnings[0].message, /20\.8% .* against 4\.5%/);
});

test("the phone's canvas is held to two pixels per point", () => {
    const phone = (width, height) =>
        sceneProfile({
            drawn: drawn(1000),
            phone: drawn(1000, {
                canvas: { width, height, layoutWidth: 390, layoutHeight: 844 },
                pixelRatio: 3,
            }),
            before: small,
            firstFrameMs: 1,
        });
    assert.deepEqual(codes(phone(780, 1688)), []);
    assert.equal(phone(780, 1688).phoneCanvas.pixelRatio, 2);
    const over = phone(1170, 2532);
    assert.deepEqual(codes(over), ["SCENE_PIXELS_PHONE"]);
    assert.match(
        over.warnings[0].message,
        /1170 x 2532 for a 390 x 844 view: 3 pixels per point, 2\.3 times/
    );
});

test("what could not be measured is said, not guessed", () => {
    const nothing = sceneProfile({
        drawn: drawn(0, { frames: 0 }),
        before: null,
        firstFrameMs: null,
    });
    assert.equal(nothing.start, null);
    assert.equal(nothing.frame, null);
    assert.deepEqual(nothing.warnings, []);
    assert.equal(nothing.notes.length, 2);
    assert.ok(!describeScene(nothing).includes("scene: within its budgets"));

    const indirect = sceneProfile({
        drawn: drawn(5000, { unsized: 3 }),
        before: small,
        firstFrameMs: 1,
    });
    assert.match(indirect.notes[0], /3 draw\(s\) could not be sized/);

    const lost = sceneProfile({
        drawn: drawn(5000, { frames: 3 }),
        before: small,
        firstFrameMs: 1,
    });
    assert.match(lost.notes[0], /only 3 frames drew anything/);
});

test("the served log: each file once, up to a moment", () => {
    let now = 100;
    const served = servedLog(() => now);
    served.add("index.html", 10);
    now = 200;
    served.add("a.js", 20);
    served.add("a.js", 20);
    now = 300;
    served.add("late.glb", 30);
    assert.deepEqual(served.before(250), [
        { path: "index.html", bytes: 10 },
        { path: "a.js", bytes: 20 },
    ]);
    assert.equal(served.before(50).length, 0);
});
