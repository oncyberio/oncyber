import {
    createGameDeparture,
    DEPARTURE_ACK_MS,
    DEPARTURE_WAIT_MS,
    lobbyReturnView,
} from "./gameDeparture";

const view = {
    cameraOffset: { x: 0, y: 2.3, z: 4.8 },
    cameraTargetOffset: { x: 0, y: 1.25, z: 0 },
    avatarRotation: Math.PI,
    avatarHeight: 1.75,
    fov: 50,
};

function page(ready = true) {
    const sent: Array<{ kind: string; data?: object }> = [];
    const departure = createGameDeparture({
        post: (kind, data) => sent.push({ kind, data }),
        ready: () => ready,
    });
    return { departure, sent };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("the game's view becomes the lobby's return view: planted, idle, third person", () => {
    expect(lobbyReturnView(view)).toEqual({
        ...view,
        avatarLift: 0,
        avatarTravelPose: "idle",
        cameraMode: "third-person",
    });
});

test("only the view's own fields cross, and malformed views are dropped", () => {
    const extra = lobbyReturnView({
        ...view,
        peers: [{ id: "x", name: "X", offset: { x: 0, y: 0, z: 0 } }],
        spawnOffset: { x: 1, y: 0, z: 1 },
        cameraMode: "first-person",
    });
    expect(extra).not.toHaveProperty("peers");
    expect(extra).not.toHaveProperty("spawnOffset");
    expect(extra.cameraMode).toBe("third-person");
    expect(lobbyReturnView(null)).toBeUndefined();
    expect(lobbyReturnView("view")).toBeUndefined();
    expect(lobbyReturnView({ ...view, fov: 400 })).toBeUndefined();
    expect(
        lobbyReturnView({ ...view, cameraOffset: { x: 0, y: 0, z: 1e9 } })
    ).toBeUndefined();
});

test("the page asks, waits for the game's view and hands it on", async () => {
    const { departure, sent } = page();
    const staged = departure.stage("self");
    expect(sent).toEqual([{ kind: "departure", data: { reason: "self" } }]);
    expect(departure.receive("pose", {})).toBe(false);
    expect(departure.receive("departure-ready", { view })).toBe(true);
    await expect(staged).resolves.toMatchObject({ fov: 50, avatarLift: 0 });
    // A second exit joins the first: the game is asked once.
    expect(departure.stage("party")).toBe(staged);
    expect(sent).toHaveLength(1);
});

test("a game that doesn't know the message is left almost at once", async () => {
    const { departure } = page();
    let settled = false;
    const staged = departure.stage().then((v) => ((settled = true), v));
    jest.advanceTimersByTime(DEPARTURE_ACK_MS - 1);
    await Promise.resolve();
    expect(settled).toBe(false);
    jest.advanceTimersByTime(1);
    await expect(staged).resolves.toBeUndefined();
});

test("a game that stages but never finishes is left after the same wait as arrival", async () => {
    const { departure } = page();
    let settled = false;
    const staged = departure.stage().then((v) => ((settled = true), v));
    expect(departure.receive("departure-staging", {})).toBe(true);
    jest.advanceTimersByTime(DEPARTURE_WAIT_MS - 1);
    await Promise.resolve();
    expect(settled).toBe(false);
    jest.advanceTimersByTime(1);
    await expect(staged).resolves.toBeUndefined();
    // A late answer changes nothing.
    expect(departure.receive("departure-ready", { view })).toBe(true);
});

test("a game with no usable view still lets the visitor leave", async () => {
    const { departure } = page();
    const staged = departure.stage("party");
    departure.receive("departure-ready", { view: null, problem: "x" });
    await expect(staged).resolves.toBeUndefined();
});

test("a game that never drew a frame is not asked", async () => {
    const { departure, sent } = page(false);
    await expect(departure.stage()).resolves.toBeUndefined();
    expect(sent).toEqual([]);
    expect(departure.started).toBe(false);
});
