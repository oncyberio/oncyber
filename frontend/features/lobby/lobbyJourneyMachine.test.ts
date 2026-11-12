import {
    EMPTY_LOBBY_JOURNEY,
    initialLobbyJourney,
    isLobbyReturnDrawn,
    lobbyJourneyTransition as step,
    lobbyJourneyView,
    type LobbyJourneyEvent,
    type LobbyJourneySnapshot,
} from "./lobbyJourneyMachine";
import {
    LOBBY_DESTINATION_PROTOCOL,
    type LobbyDestinationMessage,
} from "./lobbyJourneyProtocol";
import { TRAVEL_DISSOLVE_AT_MS } from "./worldTravelTiming";

const space = { id: "one", title: "One", href: "/one" };
const error = { code: "x", message: "Nope", canOpenNormally: true };
const none = { entry: false, stage: false, reveal: false };

const prepare = (
    leaveImmediately: boolean,
    reducedMotion = false
): LobbyJourneyEvent => ({
    type: "prepare",
    selected: space,
    attempt: "a1",
    frameUrl: "https://lobby.test/one?__lobbyAttempt=a1",
    startedAt: 1000,
    reducedMotion,
    leaveImmediately,
});
const message = (
    type: LobbyDestinationMessage["type"],
    extra: Partial<LobbyDestinationMessage> = {},
    requested = none
): LobbyJourneyEvent => ({
    type: "message",
    message: {
        protocol: LOBBY_DESTINATION_PROTOCOL,
        attempt: "a1",
        type,
        ...extra,
    },
    requested,
    now: 5000,
    reducedMotion: false,
});
const run = (...events: LobbyJourneyEvent[]) =>
    events.reduce(step, EMPTY_LOBBY_JOURNEY);

/** A solo trip up to the moment the destination is on screen. */
const solo: LobbyJourneyEvent[] = [
    prepare(true),
    { type: "frame-mounted", attempt: "a1", url: "https://lobby.test/one" },
    { type: "charge" },
    message("prepared", { reveal: "native" }),
    message("entered", {}, { ...none, entry: true }),
    { type: "stage-requested" },
    message("reveal-ready", {}, { ...none, stage: true }),
    message("revealed", {}, { ...none, reveal: true }),
];

test("a solo trip walks loading, entering, revealing and entered in order", () => {
    const phases = solo.map(
        (_event, index) => run(...solo.slice(0, index + 1)).phase
    );
    expect(phases).toEqual([
        "loading",
        "loading",
        "loading",
        "entering",
        "entering",
        "entering",
        "revealing",
        "entered",
    ]);
    const arrived = run(...solo);
    expect(arrived).toMatchObject({
        travel: null,
        admitted: true,
        revealMode: "native",
        progress: 1,
    });
});

test("solo travel holds the frame until the avatar is seated; group travel loads at once", () => {
    const departing = run(prepare(true));
    expect(departing.frameUrl).toBeNull();
    expect(departing.travel).toEqual({
        phase: "isolate",
        startedAt: 1000,
        reducedMotion: false,
        dissolveStartedAt: 1000 + TRAVEL_DISSOLVE_AT_MS,
    });
    const waiting = run(prepare(false));
    expect(waiting.frameUrl).toBe("https://lobby.test/one?__lobbyAttempt=a1");
    expect(waiting.travel).toBeNull();
    // Reduced motion skips the camera isolation, so nothing needs protecting.
    const reduced = run(prepare(true, true));
    expect(reduced.frameUrl).not.toBeNull();
    expect(reduced.travel).toMatchObject({
        phase: "charge",
        dissolveStartedAt: 1000,
    });
});

test("a prepared group destination waits in ready until entry is explicit", () => {
    const ready = run(prepare(false), message("prepared"));
    expect(ready).toMatchObject({ phase: "ready", revealMode: "immediate" });
    const entering = step(ready, {
        type: "enter",
        startedAt: 2000,
        reducedMotion: false,
    });
    expect(entering).toMatchObject({
        phase: "entering",
        admitted: false,
        travel: { phase: "isolate", startedAt: 2000 },
    });
    // A repeated gesture cannot restart the departure.
    expect(
        step(entering, { type: "enter", startedAt: 3000, reducedMotion: false })
    ).toBe(entering);
});

test("destination messages are ignored unless the host asked for that step", () => {
    const entering = run(prepare(true), message("prepared"));
    expect(step(entering, message("entered"))).toBe(entering);
    const admitted = step(
        entering,
        message("entered", {}, { ...none, entry: true })
    );
    // Not staged yet: the destination cannot announce itself ready to reveal.
    expect(
        step(admitted, message("reveal-ready", {}, { ...none, stage: true }))
    ).toBe(admitted);
    const staging = step(admitted, { type: "stage-requested" });
    expect(step(staging, message("reveal-ready"))).toBe(staging);
    const revealing = step(
        staging,
        message("reveal-ready", {}, { ...none, stage: true })
    );
    expect(revealing).toMatchObject({
        phase: "revealing",
        stagingReveal: false,
        travel: { phase: "reveal" },
    });
    expect(step(revealing, message("revealed"))).toBe(revealing);
});

test("events that do not apply return the same snapshot", () => {
    const loading = run(prepare(false));
    const ignored: LobbyJourneyEvent[] = [
        { type: "enter", startedAt: 1, reducedMotion: false },
        { type: "frame-mounted", attempt: "other", url: "https://x.test" },
        { type: "frame-mounted", attempt: "a1", url: "https://x.test" },
        { type: "charge" },
        { type: "return-ready", startedAt: 1000 },
        message("entered", {}, { ...none, entry: true }),
        message("revealed", {}, { ...none, reveal: true }),
        message("back"),
        message("progress", { progress: Number.NaN }),
    ];
    for (const event of ignored) expect(step(loading, event)).toBe(loading);
    expect(step(EMPTY_LOBBY_JOURNEY, { type: "cancel" })).toBe(
        EMPTY_LOBBY_JOURNEY
    );
    expect(step(EMPTY_LOBBY_JOURNEY, message("error", { error }))).toBe(
        EMPTY_LOBBY_JOURNEY
    );
});

test("progress only moves forward and never claims completion", () => {
    let journey = run(prepare(false), message("progress", { progress: 0.4 }));
    expect(journey.progress).toBe(0.4);
    const unchanged = step(journey, message("progress", { progress: 0.2 }));
    expect(unchanged).toBe(journey);
    journey = step(journey, message("progress", { progress: 5 }));
    expect(journey.progress).toBe(0.99);
});

test("failure keeps the selection for a retry and drops the frame", () => {
    for (const events of [
        [prepare(true)],
        [prepare(false), message("prepared")],
        solo.slice(0, 7),
    ]) {
        const failed = step(run(...events), { type: "fail", error });
        expect(failed).toMatchObject({
            phase: "error",
            selected: space,
            frameUrl: null,
            attempt: null,
            travel: null,
            admitted: false,
            stagingReveal: false,
            error,
        });
    }
    const reported = step(run(prepare(true)), message("error"));
    expect(reported.error).toEqual({
        code: "load-failed",
        message: "This world could not load. Try another world.",
        canOpenNormally: false,
    });
    // A destination the visitor is already inside cannot fail the journey.
    const arrived = run(...solo);
    expect(step(arrived, message("error", { error }))).toBe(arrived);
});

test("an unsupported destination records why without creating an attempt", () => {
    expect(
        step(run(prepare(true)), {
            type: "unsupported",
            selected: space,
            error,
        })
    ).toEqual({
        ...EMPTY_LOBBY_JOURNEY,
        phase: "error",
        selected: space,
        error,
    });
});

test("back starts a return that ends only after its own frame was drawn", () => {
    const returning = step(run(...solo), message("back"));
    expect(returning).toMatchObject({
        phase: "returning",
        returnReady: false,
        travel: { phase: "return", startedAt: 5000, reducedMotion: false },
    });
    expect(isLobbyReturnDrawn(returning, 5000)).toBe(false);
    // A stale acknowledgement from an earlier return changes nothing.
    expect(step(returning, { type: "return-ready", startedAt: 1 })).toBe(
        returning
    );
    const drawn = step(returning, { type: "return-ready", startedAt: 5000 });
    expect(drawn.returnReady).toBe(true);
    expect(step(drawn, { type: "return-ready", startedAt: 5000 })).toBe(drawn);
    expect(isLobbyReturnDrawn(drawn, 5000)).toBe(true);
    expect(isLobbyReturnDrawn(drawn, 1)).toBe(false);
    expect(step(drawn, { type: "cancel" })).toBe(EMPTY_LOBBY_JOURNEY);
});

test("a return from a top-level world starts in the returning phase", () => {
    expect(initialLobbyJourney(null)).toBe(EMPTY_LOBBY_JOURNEY);
    expect(
        initialLobbyJourney({ startedAt: 7, reducedMotion: true })
    ).toMatchObject({
        phase: "returning",
        returnReady: false,
        travel: { phase: "return", startedAt: 7, reducedMotion: true },
    });
});

test("the view answers the lobby's questions for every phase", () => {
    const view = (snapshot: Partial<LobbyJourneySnapshot>) =>
        lobbyJourneyView({ ...EMPTY_LOBBY_JOURNEY, ...snapshot });
    const quiet = {
        entered: false,
        returning: false,
        revealing: false,
        preparingReturn: false,
        travelling: false,
    };
    expect(view({})).toEqual(quiet);
    expect(view({ phase: "ready" })).toEqual(quiet);
    expect(view({ phase: "error" })).toEqual(quiet);
    // Preparing for a group does not leave the lobby floor.
    expect(view(run(prepare(false)))).toEqual(quiet);
    expect(view(run(prepare(true)))).toEqual({ ...quiet, travelling: true });
    expect(view({ phase: "entering" })).toEqual({ ...quiet, travelling: true });
    expect(view({ phase: "revealing" })).toEqual({
        ...quiet,
        revealing: true,
        travelling: true,
    });
    expect(view({ phase: "entered" })).toEqual({ ...quiet, entered: true });
    expect(view({ phase: "returning" })).toEqual({
        ...quiet,
        returning: true,
        preparingReturn: true,
        travelling: true,
    });
    expect(view({ phase: "returning", returnReady: true })).toEqual({
        ...quiet,
        returning: true,
        travelling: true,
    });
});
