import assert from "node:assert/strict";
import test from "node:test";
import {
    LOBBY_HANDOFF,
    describeArrival,
    handoffFindings,
    lobbyArrivalView,
    lobbyCameraDistance,
    mapArrivalView,
} from "../src/arrival.ts";
import {
    botFindings,
    botKey,
    declaredInput,
    exposeInspect,
    factsDiff,
    factsMatch,
    INSPECT_GLOBAL,
} from "../src/bot.ts";
import {
    BRIEF_SECTIONS,
    briefFindings,
    briefInspectKeys,
    partyFindings,
} from "../src/brief.ts";

const codes = (findings) => findings.map((f) => f.code);

test("the lobby camera is about 5 m in front and 2 m up, further for a party", () => {
    assert.equal(lobbyCameraDistance(1).toFixed(2), "5.04");
    assert.equal(lobbyCameraDistance(4).toFixed(2), "6.36");
    assert.equal(lobbyCameraDistance(20), lobbyCameraDistance(7));
    const view = lobbyArrivalView({ yaw: 0.6 });
    assert.equal(view.cameraOffset.y, 2);
    assert.equal(view.fov, 58);
    assert.equal(
        lobbyArrivalView({ pageWidth: 400 }).fov,
        LOBBY_HANDOFF.narrowFov
    );
    assert.ok(
        Math.abs(Math.hypot(view.cameraOffset.x, view.cameraOffset.z) - 5.04) <
            1e-9
    );
});

test("a mapped view puts the camera where the game wants it, scaled to its avatar", () => {
    const view = lobbyArrivalView({ yaw: 0.6, avatarHeight: 1.7 });
    const mapped = mapArrivalView(view, { cameraYaw: 0, avatarHeight: 3.4 });
    assert.ok(Math.abs(mapped.cameraOffset.x) < 1e-9);
    assert.ok(Math.abs(mapped.cameraOffset.z - 10.08) < 1e-9);
    assert.equal(mapped.cameraOffset.y, 4);
    assert.equal(mapped.fov, 58);
    const side = mapArrivalView(view, { cameraYaw: Math.PI / 2 });
    assert.ok(
        Math.abs(side.cameraOffset.x - 5.04) < 1e-9 &&
            Math.abs(side.cameraOffset.z) < 1e-9
    );
});

test("a matching arrival has no findings; each mismatch has its own", () => {
    const view = lobbyArrivalView({ yaw: 1.2 });
    const mapped = mapArrivalView(view, { avatarHeight: 1.75 });
    const scene = {
        camera: {
            x: 3 + mapped.cameraOffset.x,
            y: mapped.cameraOffset.y,
            z: 9 + mapped.cameraOffset.z,
        },
        fov: mapped.fov,
        avatar: { x: 3, y: 0, z: 9 },
        avatarForward: { x: 0, z: 1 },
        avatarHeight: 1.75,
        crouched: true,
        handsEmpty: true,
    };
    assert.deepEqual(handoffFindings(view, describeArrival(scene)), []);
    assert.deepEqual(codes(handoffFindings(view, null)), ["HANDOFF_FACTS"]);
    assert.deepEqual(codes(handoffFindings(view, { distance: "far" })), [
        "HANDOFF_FACTS",
        "HANDOFF_FACTS",
        "HANDOFF_FACTS",
        "HANDOFF_FACTS",
    ]);
    const wrong = describeArrival({
        ...scene,
        camera: { x: 3, y: 9.5, z: -18 },
        fov: 45,
        crouched: false,
        handsEmpty: false,
    });
    assert.deepEqual(codes(handoffFindings(view, wrong)), [
        "HANDOFF_DISTANCE",
        "HANDOFF_HEIGHT",
        "HANDOFF_FOV",
        "HANDOFF_FACING",
        "HANDOFF_CROUCH",
        "HANDOFF_HANDS",
    ]);
});

const input = {
    forward: { keyboard: ["KeyW"] },
    confirm: { keyboard: ["Space", "KeyJ"] },
    tap: { touch: "tap" },
    menu: { keyboard: ["Escape"] },
};
const bot = {
    version: 1,
    arrival: [
        { hold: "forward", ms: 500 },
        { press: "confirm" },
        { until: { screen: "match" } },
    ],
    play: [
        {
            repeat: [{ press: "confirm" }, { wait: 300 }],
            until: { screen: "results" },
            timeoutMs: 1000,
        },
    ],
    leave: [{ press: "confirm" }],
};

test("a bot may only use input the game declared with a keyboard binding", () => {
    assert.equal(botKey(input, "forward"), "KeyW");
    assert.equal(botKey(input, "tap"), null);
    assert.equal(botKey(input, "toString"), null);
    assert.deepEqual(declaredInput({ runtime: { input } }), input);
    assert.deepEqual(declaredInput({ input }), input);
    assert.deepEqual(botFindings(bot, input), []);
    // A step may pick another of the action's bindings, never a key the
    // page keeps for itself.
    assert.equal(botKey(input, "confirm"), "Space");
    assert.equal(botKey(input, "confirm", "KeyJ"), "KeyJ");
    assert.equal(botKey(input, "confirm", "KeyK"), null);
    assert.equal(botKey(input, "menu"), null);
    assert.deepEqual(
        botFindings(
            { ...bot, leave: [{ press: "confirm", key: "KeyJ" }] },
            input
        ),
        []
    );
    assert.deepEqual(
        codes(
            botFindings(
                { ...bot, leave: [{ press: "confirm", key: "Enter" }] },
                input
            )
        ),
        ["BOT_UNDECLARED_INPUT"]
    );
    assert.deepEqual(
        codes(botFindings({ ...bot, leave: [{ press: "menu" }] }, input)),
        ["BOT_UNDECLARED_INPUT"]
    );
    assert.deepEqual(
        codes(botFindings({ ...bot, play: [{ press: "fire" }] }, input)),
        ["BOT_UNDECLARED_INPUT"]
    );
    assert.deepEqual(
        codes(botFindings({ ...bot, play: [{ press: "tap" }] }, input)),
        ["BOT_UNDECLARED_INPUT"]
    );
});

test("a bot that presses or proves nothing is refused", () => {
    assert.deepEqual(
        codes(botFindings({ ...bot, play: [{ wait: 100 }] }, input)),
        ["BOT_IDLE"]
    );
    assert.deepEqual(codes(botFindings({ ...bot, leave: [] }, input)), [
        "BOT_IDLE",
    ]);
    assert.deepEqual(botFindings({ ...bot, leave: [] }, input, "world"), []);
    assert.deepEqual(
        codes(
            botFindings(
                { ...bot, play: [{ press: "confirm" }], leave: [] },
                input,
                "world"
            )
        ),
        ["BOT_IDLE"]
    );
    assert.deepEqual(codes(botFindings({ version: 2 }, input)), [
        "BOT_INVALID",
    ]);
    assert.deepEqual(codes(botFindings({ ...bot, query: "a=1#x" }, input)), [
        "BOT_INVALID",
    ]);
    assert.deepEqual(
        codes(botFindings({ ...bot, play: [{ jump: 1 }] }, input)),
        ["BOT_INVALID"]
    );
    assert.deepEqual(
        codes(
            botFindings(
                {
                    ...bot,
                    play: [
                        {
                            repeat: [
                                { repeat: [{ press: "confirm" }], until: {} },
                            ],
                            until: {},
                        },
                    ],
                },
                input
            )
        ),
        ["BOT_INVALID"]
    );
});

test("facts are compared by value and exposed as plain data", () => {
    assert.ok(
        factsMatch({ screen: "match", position: [1, 2] }, { position: [1, 2] })
    );
    assert.ok(!factsMatch({ screen: "match" }, { screen: "results" }));
    assert.equal(
        factsDiff({ screen: "match" }, { screen: "results" }),
        'screen is "match", expected "results"'
    );
    // The loading and pausing helpers keep their reports on the same
    // object: exposing the facts leaves them there.
    globalThis[INSPECT_GLOBAL] = { loading: () => "kept" };
    exposeInspect(() => ({ screen: "arrival", position: [0, 0] }));
    assert.deepEqual(globalThis[INSPECT_GLOBAL].inspect(), {
        screen: "arrival",
        position: [0, 0],
    });
    assert.equal(globalThis[INSPECT_GLOBAL].loading(), "kept");
});

const brief = (inspect = "`screen`, `position`, `arrival.distance`, `score`") =>
    BRIEF_SECTIONS.map(
        (name) =>
            `## ${name}\n\n<!-- guidance TODO -->\n${
                name === "Inspect" ? inspect : "Filled in."
            }\n`
    ).join("\n");

test("a brief must exist, be filled in, and promise the standard facts", () => {
    assert.deepEqual(codes(briefFindings(null)), ["BRIEF_MISSING"]);
    assert.deepEqual(briefFindings(brief()), []);
    assert.deepEqual(briefInspectKeys(brief()), [
        "screen",
        "position",
        "arrival",
        "score",
    ]);
    assert.match(
        briefFindings(
            brief().replace(
                "## Devices\n\n<!-- guidance TODO -->\nFilled in.",
                "## Devices\n\nTODO"
            )
        )[0].message,
        /Devices/
    );
    assert.deepEqual(codes(briefFindings(brief("`screen`"))), [
        "BRIEF_INCOMPLETE",
        "BRIEF_INCOMPLETE",
    ]);
});

test("a game says what it offers every party size, and keeps a solo path", () => {
    // The contract's party block (docs/games/party.md).
    const every = [1, 2, 3, 4, 5, 6, 7, 8];
    const party = {
        sizes: [1, 8],
        formats: [
            { id: "singles", label: "1 v 1", sizes: [2] },
            { id: "bracket", label: "Knockout", sizes: [3, 4, 5, 6, 7, 8] },
            { id: "solo", label: "Solo vs CPU", sizes: every },
        ],
        solo: "solo",
        late: "Watches, or plays the CPU.",
        dropped: "The CPU takes their side.",
        extra: "Watches, or plays the CPU.",
    };
    assert.deepEqual(partyFindings(party), []);
    assert.deepEqual(codes(partyFindings(undefined)), ["PARTY_UNDECLARED"]);
    // No solo option, or one that some size is not offered.
    assert.deepEqual(codes(partyFindings({ ...party, solo: " " })), [
        "SOLO_PATH",
    ]);
    assert.deepEqual(
        codes(
            partyFindings({
                ...party,
                formats: [
                    party.formats[0],
                    party.formats[1],
                    { id: "solo", label: "Solo", sizes: [1] },
                ],
            })
        ),
        ["SOLO_PATH"]
    );
    // A size with nothing on offer, and a statement still to write.
    assert.deepEqual(
        codes(
            partyFindings({
                ...party,
                formats: [{ id: "solo", label: "Solo", sizes: [1, 2, 4] }],
                extra: "TODO",
            })
        ),
        ["PARTY_UNDECLARED", "SOLO_PATH", "PARTY_UNDECLARED"]
    );
    // The statement from before the contract (a sentence per size) is not one.
    assert.deepEqual(
        codes(partyFindings({ 1: "A match against the CPU.", 2: "1 v 1." })),
        ["PARTY_UNDECLARED", "SOLO_PATH", "PARTY_UNDECLARED"]
    );
});
