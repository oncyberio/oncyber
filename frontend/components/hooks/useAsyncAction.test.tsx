/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import {
    AsyncAction,
    AsyncActionStatus,
    useAsyncAction,
} from "./useAsyncAction";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let hook: AsyncAction<any[], any>;
let logged: jest.SpyInstance;

function Probe({ action }: { action: (...args: any[]) => unknown }) {
    hook = useAsyncAction(action);
    return <span>{hook.status}</span>;
}
const mount = (action: (...args: any[]) => unknown) =>
    act(() => root.render(<Probe action={action} />));
/** What a visitor would see: the status as it was last rendered. */
const shown = () => container.textContent;

/** A promise the test settles by hand. */
function deferred<T = unknown>() {
    let resolve: (value: T) => void;
    let reject: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    logged = jest.spyOn(console, "error").mockImplementation(() => {});
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

const boom = new Error("boom");

test.each<
    [string, AsyncActionStatus, (...args: any[]) => unknown, unknown, unknown]
>([
    ["an action that resolves", "done", async () => "ok", "ok", null],
    ["an action that is not async", "done", () => 7, 7, null],
    ["an early return", "done", async () => {}, undefined, null],
    [
        "an action that rejects",
        "failed",
        async () => {
            throw boom;
        },
        undefined,
        boom,
    ],
    [
        "an action that throws before it returns a promise",
        "failed",
        () => {
            throw boom;
        },
        undefined,
        boom,
    ],
    [
        "a rejection that is not an Error",
        "failed",
        () => Promise.reject("offline"),
        undefined,
        "offline",
    ],
])("%s ends %s", async (_name, status, action, result, error) => {
    mount(action);
    expect(hook).toMatchObject({ status: "idle", error: null });

    let resolved: unknown = "not settled";
    await act(async () => {
        // Never rejects, whatever the action does.
        resolved = await hook.run();
    });

    expect(resolved).toBe(result);
    expect(hook.status).toBe(status);
    expect(hook.error).toBe(error);
    expect(shown()).toBe(status);
    // A failure is never invisible to whoever reads the console.
    expect(logged).toHaveBeenCalledTimes(status === "failed" ? 1 : 0);
});

it("is pending from the call until the action settles", async () => {
    const work = deferred<string>();
    mount(() => work.promise);
    let run: Promise<unknown>;
    await act(async () => {
        run = hook.run();
    });
    expect(shown()).toBe("pending");

    await act(async () => work.resolve("ok"));
    expect(shown()).toBe("done");
    expect(await run).toBe("ok");
});

it("hands its arguments to the action from the latest render", async () => {
    const first = jest.fn();
    const latest = jest.fn(async (a: number, b: number) => a + b);
    mount(first);
    const { run, reset } = hook;
    mount(latest);
    // Stable, so they can be passed down or listed as dependencies.
    expect(hook.run).toBe(run);
    expect(hook.reset).toBe(reset);

    let sum: unknown;
    await act(async () => {
        sum = await run(2, 3);
    });
    expect(sum).toBe(5);
    expect(first).not.toHaveBeenCalled();
});

it("clears the last failure when it runs again", async () => {
    const work = deferred();
    const action = jest
        .fn()
        .mockRejectedValueOnce(boom)
        .mockReturnValueOnce(work.promise);
    mount(action);
    await act(async () => {
        await hook.run();
    });
    expect(hook).toMatchObject({ status: "failed", error: boom });

    await act(async () => {
        hook.run();
    });
    expect(hook).toMatchObject({ status: "pending", error: null });
    await act(async () => work.resolve(null));
    expect(hook).toMatchObject({ status: "done", error: null });
});

// Two runs overlap. Only the second one counts, however the first one ends
// and whichever of them finishes first.
type End = "resolve" | "reject";
test.each<[string, End, End, "first" | "second", AsyncActionStatus[]]>([
    [
        "a first run that resolves late",
        "resolve",
        "resolve",
        "second",
        ["done", "done"],
    ],
    [
        "a first run that fails late",
        "reject",
        "resolve",
        "second",
        ["done", "done"],
    ],
    [
        "a first run that resolves after the second failed",
        "resolve",
        "reject",
        "second",
        ["failed", "failed"],
    ],
    [
        "a first run that resolves while the second is running",
        "resolve",
        "resolve",
        "first",
        ["pending", "done"],
    ],
    [
        "a first run that fails while the second is running",
        "reject",
        "reject",
        "first",
        ["pending", "failed"],
    ],
])("ignores %s", async (_name, firstEnd, secondEnd, settlesFirst, expected) => {
    const works = [deferred(), deferred()];
    let calls = 0;
    mount(() => works[calls++].promise);
    await act(async () => {
        hook.run();
        hook.run();
    });
    expect(shown()).toBe("pending");

    const settle = {
        first: () => works[0][firstEnd](boom),
        second: () => works[1][secondEnd](boom),
    };
    const order =
        settlesFirst === "first"
            ? (["first", "second"] as const)
            : (["second", "first"] as const);
    const seen: string[] = [];
    for (const which of order) {
        await act(async () => settle[which]());
        seen.push(shown());
    }
    expect(seen).toEqual(expected);
    // The ignored outcome did not leave its error behind either.
    expect(hook.error).toBe(expected[1] === "failed" ? boom : null);
});

it("forgets a run that was reset", async () => {
    const work = deferred();
    mount(() => work.promise);
    await act(async () => {
        hook.run();
    });
    act(() => hook.reset());
    expect(shown()).toBe("idle");

    await act(async () => work.reject(boom));
    expect(hook).toMatchObject({ status: "idle", error: null });
});

it("goes back to idle from a failure on reset", async () => {
    mount(() => Promise.reject(boom));
    await act(async () => {
        await hook.run();
    });
    act(() => hook.reset());
    expect(hook).toMatchObject({ status: "idle", error: null });
});

it.each<[string, End]>([
    ["resolves", "resolve"],
    ["rejects", "reject"],
])(
    "settles quietly when the action %s after the component is gone",
    async (_name, end) => {
        const work = deferred();
        mount(() => work.promise);
        let run: Promise<unknown>;
        await act(async () => {
            run = hook.run();
        });
        const stale = hook;
        act(() => root.render(null));

        await act(async () => work[end]("late"));
        // Still resolves for whoever awaited it, and still never rejects.
        expect(await run).toBe(end === "resolve" ? "late" : undefined);
        // The last thing the component rendered is all it ever shows.
        expect(stale.status).toBe("pending");
        expect(container.textContent).toBe("");
    }
);
