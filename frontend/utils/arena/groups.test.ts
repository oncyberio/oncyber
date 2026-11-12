/** @jest-environment jsdom */
import arena from "./index";
const mockConsume = jest.fn();
jest.mock("colyseus.js", () => ({ Client: jest.fn(() => ({ consumeSeatReservation: (...args) => mockConsume(...args) })) }));
jest.mock("../voiceChat", () => ({ __esModule: true, default: { get: () => ({}) } }));
jest.mock("@api/social/_api", () => ({ __esModule: true, default: {} }), { virtual: true });
jest.mock("@env", () => ({}));
const originalFetch = global.fetch;
const trip = "travel-one-123456789";
const user = () => ({ label: "canonical-space", currentSpace: "canonical-space", username: "Guest name", lobbyGroupCohort: trip } as any);
beforeEach(() => {
    jest.clearAllMocks();
    arena.room = undefined;
    mockConsume.mockResolvedValue({ id: "same-native-room" });
    global.fetch = jest.fn();
});
afterEach(() => { global.fetch = originalFetch; arena.room = undefined; });
const response = (value) => (global.fetch as jest.Mock).mockResolvedValue({ json: async () => value });
test("cohort match must be acknowledged before the native seat can be consumed", async () => {
    response({ success: true, reservation: { room: "ordinary-instance" } });
    await expect(arena.joinMatch("cyber", user(), new AbortController())).rejects.toThrow("Group arrivals are not available in this world yet.");
    expect(mockConsume).not.toHaveBeenCalled();
    expect(arena.room).toBeUndefined();
});
test("confirmed cohort keeps canonical admission context and consumes the shared reservation", async () => {
    const reservation = { room: "group-instance" };
    response({ success: true, lobbyGroupCohort: trip, reservation });
    await expect(arena.joinMatch("cyber", user(), new AbortController())).resolves.toEqual({ id: "same-native-room" });
    expect(mockConsume).toHaveBeenCalledWith(reservation);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toMatchObject({ label: "canonical-space", currentSpace: "canonical-space", lobbyGroupCohort: trip });
});
test("ordinary admission stays compatible and group admission failures remain failures", async () => {
    response({ success: true, reservation: { room: "ordinary-instance" } });
    await arena.joinMatch("cyber", { ...user(), lobbyGroupCohort: undefined }, new AbortController());
    expect(mockConsume).toHaveBeenCalledTimes(1);
    arena.room = undefined;
    response({ success: false, message: "This space is full" });
    await expect(arena.joinMatch("cyber", user(), new AbortController())).rejects.toThrow("This space is full");
    expect(mockConsume).toHaveBeenCalledTimes(1);
});


test("a cancelled reservation closes only its late seat without replacing a newer room", async () => {
    response({ success: true, reservation: { room: "late" } });
    let finish: (value: any) => void;
    mockConsume.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const controller = new AbortController();
    const pending = arena.joinMatch("cyber", { ...user(), lobbyGroupCohort: undefined }, controller);
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(mockConsume).toHaveBeenCalledTimes(1);
    controller.abort();
    const newer = { id: "newer", leave: jest.fn() } as any;
    arena.room = newer;
    const late = { id: "late", leave: jest.fn(async () => {}) };
    finish(late);
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(late.leave).toHaveBeenCalledWith(true);
    expect(arena.room).toBe(newer);
    expect(newer.leave).not.toHaveBeenCalled();
});

test("an already cancelled request cannot leave the current room", async () => {
    const current = { leave: jest.fn() } as any;
    arena.room = current;
    const controller = new AbortController();
    controller.abort();
    await expect(arena.joinMatch("cyber", user(), controller)).rejects.toMatchObject({ name: "AbortError" });
    expect(current.leave).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
});
