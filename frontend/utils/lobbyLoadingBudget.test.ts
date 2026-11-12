import {
    createLobbyLoadingScheduler,
    readLobbyLoadingBudget,
    LOBBY_LOADING_BLACK_MS,
    LOBBY_LOADING_OPENING_MS,
    LOBBY_LOADING_SEATED_MS,
    type LobbyLoadingBudget,
    type LobbyLoadingWindow,
} from "./lobbyLoadingBudget";
import {
    TRAVEL_BLACK_AT_MS,
    TRAVEL_DEPARTURE_MS,
    TRAVEL_ISOLATE_MS,
} from "@features/lobby/worldTravelTiming";

const ATTEMPT = "12345678-1234-1234-1234-123456789abc";
const EPOCH = 1_000_000;
function frame(
    attrs: Record<string, string> = {},
    parent?: LobbyLoadingWindow
) {
    const top =
        parent ||
        ({
            location: { origin: "https://oncyber.test" },
        } as LobbyLoadingWindow);
    if (!parent) top.parent = top;
    return {
        parent: top,
        location: { origin: "https://oncyber.test" },
        frameElement: { getAttribute: (name: string) => attrs[name] ?? null },
    } as LobbyLoadingWindow;
}
function policy(attrs: Record<string, string> = {}, now = EPOCH) {
    return readLobbyLoadingBudget(
        frame({
            "data-lobby-loading-attempt": ATTEMPT,
            "data-lobby-loading-phase": "opening",
            "data-lobby-loading-start": String(EPOCH),
            ...attrs,
        }),
        now
    );
}
const microtasks = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
};
// Between isolation and blackout; scheduling tests release the heavy hold.
function harness(initial = { ...policy({}, EPOCH + 700), heavyWaitUntil: 0 }) {
    let clock = 0;
    let budget = initial;
    let hidden = false;
    let serial = 0;
    const frames = new Map<number, () => void>();
    const timers = new Map<number, { run: () => void; at: number }>();
    const scheduler = createLobbyLoadingScheduler({
        readBudget: () => budget,
        now: () => clock,
        epochNow: () => EPOCH + clock,
        hidden: () => hidden,
        requestFrame(run) {
            const id = ++serial;
            frames.set(id, run);
            return () => frames.delete(id);
        },
        delay(run, milliseconds) {
            const id = ++serial;
            timers.set(id, { run, at: clock + milliseconds });
            return () => timers.delete(id);
        },
    });
    const runTimers = async () => {
        // Run separate due tasks, including the microtasks between each task.
        for (let iteration = 0; iteration < 30; iteration++) {
            const next = [...timers].find(([, timer]) => timer.at <= clock);
            if (!next) break;
            const [id, timer] = next;
            timers.delete(id);
            timer.run();
            await microtasks();
        }
    };
    return {
        ...scheduler,
        frames,
        timers,
        setBudget: (next: LobbyLoadingBudget) => {
            budget = next;
        },
        setHidden: (next: boolean) => {
            hidden = next;
        },
        consume: (milliseconds: number) => {
            clock += milliseconds;
        },
        async advance(milliseconds: number) {
            clock += milliseconds;
            await runTimers();
        },
        async paint() {
            for (const [id, run] of [...frames]) {
                frames.delete(id);
                run();
            }
            await microtasks();
        },
        runTimers,
    };
}

test("covered preparation runs at full speed once the departure has finished on black", () => {
    // The pack stores clip durations as 32-bit floats.
    expect(LOBBY_LOADING_SEATED_MS).toBeCloseTo(TRAVEL_DEPARTURE_MS, 2);
    // Black, but the attack and crouch-down still play: bounded.
    expect(policy({}, EPOCH + LOBBY_LOADING_SEATED_MS - 1).budgetMs).toBe(4);
    expect(policy({}, EPOCH + LOBBY_LOADING_SEATED_MS)).toMatchObject({
        enabled: true,
        waitUntil: 0,
        budgetMs: Infinity,
    });
    expect(
        policy(
            { "data-lobby-loading-phase": "preparing" },
            EPOCH + LOBBY_LOADING_SEATED_MS
        ).budgetMs
    ).toBe(Infinity);
    // The reveal is on screen again: bounded.
    expect(
        policy(
            { "data-lobby-loading-phase": "revealing" },
            EPOCH + LOBBY_LOADING_SEATED_MS
        ).budgetMs
    ).toBe(1.5);
});

test("at full speed, ordinary work is granted at once and forced steps still get their own painted frame", async () => {
    const scheduler = harness(policy({}, EPOCH + LOBBY_LOADING_SEATED_MS));
    const order: string[] = [];
    // A long slice that would exhaust any bounded allowance.
    scheduler.consume(50);
    await scheduler.yieldWork().then(() => order.push("small"));
    expect(order).toEqual(["small"]);
    const forced = scheduler
        .yieldWork({ force: true })
        .then(() => order.push("forced"));
    await scheduler.runTimers();
    expect(order).toEqual(["small"]);
    await scheduler.paint();
    await scheduler.advance(0);
    await forced;
    expect(order).toEqual(["small", "forced"]);
});

test("opening uses epoch time across documents and ramps after isolation and blackout", () => {
    expect(policy({}, EPOCH + 200)).toMatchObject({
        waitUntil: EPOCH + 600,
        elapsedMs: 200,
        budgetMs: 1.5,
    });
    expect(policy({}, EPOCH + 600)).toMatchObject({
        waitUntil: 0,
        heavyWaitUntil: EPOCH + LOBBY_LOADING_SEATED_MS,
        budgetMs: 1.5,
    });
    // Black: 4 ms slices, forced work still held until the avatar is seated.
    expect(policy({}, EPOCH + LOBBY_LOADING_BLACK_MS)).toMatchObject({
        waitUntil: 0,
        heavyWaitUntil: EPOCH + LOBBY_LOADING_SEATED_MS,
        budgetMs: 4,
    });
    // Seated: covered preparation runs at full speed.
    expect(policy({}, EPOCH + LOBBY_LOADING_SEATED_MS)).toMatchObject({
        waitUntil: 0,
        heavyWaitUntil: 0,
        budgetMs: Infinity,
    });
    expect(
        policy({ "data-lobby-loading-phase": "revealing" }, EPOCH + 8000)
            .budgetMs
    ).toBe(1.5);
    expect(policy({ "data-lobby-loading-phase": "active" }).enabled).toBe(
        false
    );
});

test("group preparation has a bounded budget; reduced motion is black and runs at full speed, without an opening hold", () => {
    expect(
        policy({
            "data-lobby-loading-phase": "preparing",
            "data-lobby-loading-start": "",
        })
    ).toMatchObject({ enabled: true, waitUntil: 0, budgetMs: 4 });
    expect(
        policy({ "data-lobby-loading-reduced-motion": "true" })
    ).toMatchObject({ enabled: true, waitUntil: 0, budgetMs: Infinity });
    expect(
        policy({
            "data-lobby-loading-reduced-motion": "true",
            "data-lobby-loading-phase": "revealing",
        }).budgetMs
    ).toBe(4);
});

test("reads the owning same-origin ancestor for nested game frames", () => {
    const owner = frame({
        "data-lobby-loading-attempt": ATTEMPT,
        "data-lobby-loading-phase": "preparing",
    });
    expect(readLobbyLoadingBudget(frame({}, owner), EPOCH)).toMatchObject({
        attempt: ATTEMPT,
        budgetMs: 4,
    });
    expect(
        readLobbyLoadingBudget(
            frame({}, frame({}, frame({}, frame({}, owner)))),
            EPOCH
        ).enabled
    ).toBe(false);
});

test("ordinary visits, invalid metadata and cross-origin ancestors bypass scheduling", () => {
    expect(readLobbyLoadingBudget(null).enabled).toBe(false);
    expect(readLobbyLoadingBudget(frame({})).enabled).toBe(false);
    for (const attrs of [
        { "data-lobby-loading-attempt": "bad" },
        { "data-lobby-loading-phase": "unknown" },
        { "data-lobby-loading-start": "NaN" },
        { "data-lobby-loading-start": String(EPOCH + 99999) },
        { "data-lobby-loading-reduced-motion": "maybe" },
    ])
        expect(policy(attrs).enabled).toBe(false);
    const other = frame();
    other.parent.location.origin = "https://other.test";
    expect(readLobbyLoadingBudget(other).enabled).toBe(false);
    const denied = frame();
    Object.defineProperty(denied, "frameElement", {
        get() {
            throw new Error("SecurityError");
        },
    });
    expect(readLobbyLoadingBudget(denied).enabled).toBe(false);
});

test("direct visits bypass even forced and hidden checkpoints", async () => {
    const env = harness(readLobbyLoadingBudget(null));
    env.setHidden(true);
    await env.yieldWork({ force: true });
    expect(env.frames.size + env.timers.size).toBe(0);
});

test("opening waits until 600 ms and a post-paint task before starting work", async () => {
    const env = harness(policy());
    let ran = false;
    const work = env.yieldWork().then(() => {
        ran = true;
    });
    await microtasks();
    expect(env.frames.size).toBe(0);
    await env.advance(599);
    expect(ran).toBe(false);
    env.setBudget(policy({}, EPOCH + 600));
    await env.advance(1);
    await env.paint();
    expect(ran).toBe(false);
    await env.runTimers();
    await work;
    expect(ran).toBe(true);
});

test("the seated hold mirrors the authored travel departure", () => {
    expect(LOBBY_LOADING_SEATED_MS).toBeCloseTo(TRAVEL_DEPARTURE_MS, 3);
});

test("forced work waits for the seated avatar before taking a frame", async () => {
    const env = harness(policy());
    let ran = false;
    const work = env.yieldWork({ force: true }).then(() => {
        ran = true;
    });
    env.setBudget(policy({}, EPOCH + 600));
    await env.advance(600);
    await env.paint();
    await env.runTimers();
    expect(ran).toBe(false);
    env.setBudget(policy({}, EPOCH + LOBBY_LOADING_BLACK_MS));
    await env.advance(LOBBY_LOADING_BLACK_MS - 600);
    await env.paint();
    await env.runTimers();
    expect(ran).toBe(false);
    env.setBudget(policy({}, EPOCH + LOBBY_LOADING_SEATED_MS));
    await env.advance(LOBBY_LOADING_SEATED_MS - LOBBY_LOADING_BLACK_MS + 1);
    await env.paint();
    await env.runTimers();
    await work;
    expect(ran).toBe(true);
});

test("concurrent forced heavy continuations each receive a separate painted frame", async () => {
    const env = harness();
    const ran: string[] = [];
    const a = env.yieldWork({ force: true }).then(() => {
        ran.push("a");
        env.consume(8);
    });
    const b = env.yieldWork({ force: true }).then(() => {
        ran.push("b");
    });
    await microtasks();
    expect(env.frames.size).toBe(1);
    await env.paint();
    await env.runTimers();
    await a;
    expect(ran).toEqual(["a"]);
    expect(env.frames.size).toBe(1);
    await env.paint();
    await env.runTimers();
    await b;
    expect(ran).toEqual(["a", "b"]);
});

test("shared accounting lets cheap consumers share a slice but defers after heavy work", async () => {
    const env = harness();
    const ran: number[] = [];
    const jobs = [0, 1, 2].map((id) =>
        env.yieldWork().then(() => {
            ran.push(id);
            env.consume(id === 1 ? 4 : 0.5);
        })
    );
    await microtasks();
    await env.runTimers();
    expect(ran).toEqual([0, 1]);
    expect(env.frames.size).toBe(1);
    await env.paint();
    await env.runTimers();
    await Promise.all(jobs);
    expect(ran).toEqual([0, 1, 2]);
});

test("cancelling one queued consumer preserves others and cancelling all clears callbacks", async () => {
    const env = harness();
    const controller = new AbortController();
    const a = env.yieldWork({ force: true, signal: controller.signal });
    const rejection = expect(a).rejects.toMatchObject({ name: "AbortError" });
    let ran = false;
    const b = env.yieldWork({ force: true }).then(() => {
        ran = true;
    });
    await microtasks();
    controller.abort();
    await rejection;
    await env.paint();
    await env.runTimers();
    await b;
    expect(ran).toBe(true);
    const last = new AbortController();
    const pending = env.yieldWork({ force: true, signal: last.signal });
    const cancelled = expect(pending).rejects.toMatchObject({
        name: "AbortError",
    });
    await microtasks();
    last.abort();
    await cancelled;
    expect(env.frames.size + env.timers.size).toBe(0);
    await expect(env.yieldWork({ signal: last.signal })).rejects.toMatchObject({
        name: "AbortError",
    });
});

test("hidden preparation remains cancellable and resumes when policy becomes active", async () => {
    const env = harness();
    env.setHidden(true);
    let ran = false;
    const pending = env.yieldWork({ force: true }).then(() => {
        ran = true;
    });
    await microtasks();
    expect(env.frames.size).toBe(0);
    await env.advance(100);
    expect(ran).toBe(false);
    env.setBudget(policy({ "data-lobby-loading-phase": "active" }));
    await env.advance(100);
    await pending;
    expect(ran).toBe(true);
    expect(env.frames.size + env.timers.size).toBe(0);
});

test("nested async checkpoint wrappers complete their CPU work before the next consumer is granted", async () => {
    const env = harness();
    const ran: number[] = [];
    const wrapper = async () => {
        await env.yieldWork();
    };
    const jobs = [1, 2].map(async (id) => {
        await wrapper();
        ran.push(id);
        env.consume(6);
    });
    await microtasks();
    expect(ran).toEqual([1]);
    await env.runTimers();
    expect(ran).toEqual([1]);
    expect(env.frames.size).toBe(1);
    await env.paint();
    await env.runTimers();
    await Promise.all(jobs);
    expect(ran).toEqual([1, 2]);
});

test("a new consumer arriving after a grant still waits for its accounting task", async () => {
    const env = harness();
    await env.yieldWork();
    const controller = new AbortController();
    let ran = false;
    const pending = env.yieldWork({ signal: controller.signal }).then(() => {
        ran = true;
    });
    await microtasks();
    expect(ran).toBe(false);
    env.consume(6);
    await env.runTimers();
    expect(ran).toBe(false);
    await env.paint();
    await env.runTimers();
    await pending;
    expect(ran).toBe(true);
});

// The budget also runs inside nested game frames, so it cannot import the
// lobby's animation modules and repeats their numbers. Keep them in step.
test("the loading windows mirror the lobby's travel choreography", () => {
    expect(LOBBY_LOADING_OPENING_MS).toBe(TRAVEL_ISOLATE_MS);
    expect(LOBBY_LOADING_BLACK_MS).toBeCloseTo(TRAVEL_BLACK_AT_MS, 6);
});
