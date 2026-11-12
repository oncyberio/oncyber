/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
import { UserContext } from "@components/context/UserContext";
import { getUserDestinations } from "@utils/saveToDb";
import { deferred } from "@utils/js";
import { RoomsContextState, RoomsProvider, useRooms } from "./useRooms";

const act = (React as any).act;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({}),
}));
jest.mock("@utils/saveToDb", () => ({ getUserDestinations: jest.fn() }));
jest.mock(
    "@dapp/cyberRooms",
    () => ({
        checkServerError: (response) => {
            if (!response.success)
                throw new Error(response.message || "Server error");
        },
        preprocessDestination: (room) => room,
    }),
    { virtual: true }
);
jest.mock("@dapp/ReservoirMarketplace", () => ({}), { virtual: true });
jest.mock("@api/destinations/_api", () => ({}), { virtual: true });
jest.mock("@env", () => ({ nodeEnv: {} }));
jest.mock("@utils/analytics", () => ({}));
jest.mock("../../utils", () => ({}));
jest.mock("@utils/auth/proxyWallets", () => ({}));
jest.mock("@components/Dialogs", () => ({}));
jest.mock("@features/studio/utils", () => ({}));
jest.mock("next/router", () => ({ useRouter: () => ({ query: {} }) }));

const fetchUploads = getUserDestinations as jest.Mock;
const alice = {
    user: { id: "alice" },
    token: "alice-session",
    userData: {},
    isAnonymous: false,
};
const bob = { ...alice, user: { id: "bob" }, token: "bob-session" };
const room = (id: string) => ({
    _id: id,
    slug: id,
    chain: "ethereum",
    tag: ["uploaded"],
});
const response = (...ids: string[]) => ({ success: true, data: ids.map(room) });
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
let state: RoomsContextState;
function ReadRooms() {
    state = useRooms();
    return <div>{state.rooms.map((room) => room._id).join(",")}</div>;
}
function render(account: any = alice) {
    act(() =>
        root.render(
            <UserContext.Provider value={account}>
                <RoomsProvider context="uploader">
                    <ReadRooms />
                </RoomsProvider>
            </UserContext.Provider>
        )
    );
}
const resolve = async (request: ReturnType<typeof deferred>, value: any) => {
    await act(async () => request.resolve(value));
};
beforeEach(() => {
    fetchUploads.mockReset();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(window, "alert").mockImplementation(() => {});
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

it.each(["previous", "current"])(
    "keeps only the current account's uploads when %s request resolves first",
    async (first) => {
        const previous = deferred<any>(),
            current = deferred<any>();
        fetchUploads
            .mockReturnValueOnce(previous.promise)
            .mockReturnValueOnce(current.promise);
        render(alice);
        expect(fetchUploads).toHaveBeenLastCalledWith("alice-session", "alice");
        render(bob);
        expect(fetchUploads).toHaveBeenLastCalledWith("bob-session", "bob");
        expect(state.rooms).toEqual([]);
        expect(state.isLoadinUploads).toBe(true);
        if (first === "previous") {
            await resolve(previous, response("alice-private"));
            expect(state.rooms).toEqual([]);
            expect(state.isLoadinUploads).toBe(true);
            await resolve(current, response("bob-private"));
        } else {
            await resolve(current, response("bob-private"));
            await resolve(previous, response("alice-private"));
        }
        expect(container.textContent).toBe("bob-private");
        expect(state.isLoadinUploads).toBe(false);
        expect(state.loadingError).toBeNull();
    }
);

it("clears existing uploads immediately when switching accounts", async () => {
    const first = deferred<any>(),
        second = deferred<any>();
    fetchUploads
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
    render(alice);
    await resolve(first, response("alice-private"));
    expect(container.textContent).toBe("alice-private");
    render(bob);
    expect(container.textContent).toBe("");
    expect(state.isLoadinUploads).toBe(true);
    await resolve(second, response("bob-private"));
    expect(container.textContent).toBe("bob-private");
});

it.each([
    ["signed out", { ...alice, user: null, token: null }],
    ["missing session", { ...alice, token: null }],
    ["anonymous", { ...alice, isAnonymous: true }],
])(
    "clears uploads and discards an in-flight refresh when becoming %s",
    async (_, account) => {
        const initial = deferred<any>(),
            refresh = deferred<any>();
        fetchUploads
            .mockReturnValueOnce(initial.promise)
            .mockReturnValueOnce(refresh.promise);
        render(alice);
        await resolve(initial, response("alice-private"));
        let refreshing: Promise<unknown>;
        act(() => {
            refreshing = state.refetchRooms();
        });
        render(account);
        expect(state.rooms).toEqual([]);
        expect(state.isLoadinUploads).toBe(false);
        expect(fetchUploads).toHaveBeenCalledTimes(2);
        await resolve(refresh, response("alice-stale"));
        await refreshing;
        expect(state.rooms).toEqual([]);
        expect(state.loadingError).toBeNull();
    }
);

it.each(["network", "server"])(
    "exposes a %s fetch failure inline and recovers on retry",
    async (failure) => {
        const failed = deferred<any>(),
            retry = deferred<any>();
        fetchUploads
            .mockReturnValueOnce(failed.promise)
            .mockReturnValueOnce(retry.promise);
        render();
        await act(async () => {
            if (failure === "network") failed.reject(new Error("Offline"));
            else failed.resolve({ success: false, message: "Unavailable" });
        });
        expect(state.isLoadinUploads).toBe(false);
        expect(state.loadingError).toBe(
            "Couldn’t load your destinations. Please try again."
        );
        expect(window.alert).not.toHaveBeenCalled();
        let retrying: Promise<unknown>;
        act(() => {
            retrying = state.refetchRooms();
        });
        expect(state.isLoadinUploads).toBe(true);
        expect(state.loadingError).toBeNull();
        await resolve(retry, response("recovered"));
        await retrying;
        expect(container.textContent).toBe("recovered");
        expect(state.isLoadinUploads).toBe(false);
        expect(state.loadingError).toBeNull();
    }
);

it("replaces the account collection on refresh so removed uploads stay removed", async () => {
    const initial = deferred<any>(),
        refresh = deferred<any>();
    fetchUploads
        .mockReturnValueOnce(initial.promise)
        .mockReturnValueOnce(refresh.promise);
    render();
    await resolve(initial, response("keep", "deleted"));
    expect(container.textContent).toBe("keep,deleted");
    let refreshing: Promise<unknown>;
    act(() => {
        refreshing = state.refetchRooms();
    });
    expect(container.textContent).toBe("keep,deleted");
    await resolve(refresh, response("keep", "added"));
    await refreshing;
    expect(container.textContent).toBe("keep,added");
    expect(state.isLoadinUploads).toBe(false);
});

it("does not report errors from the previous account after the current account loads", async () => {
    const previous = deferred<any>(),
        current = deferred<any>();
    fetchUploads
        .mockReturnValueOnce(previous.promise)
        .mockReturnValueOnce(current.promise);
    render(alice);
    render(bob);
    await resolve(current, response("bob-private"));
    await act(async () =>
        previous.reject(new Error("Old account request failed"))
    );
    expect(container.textContent).toBe("bob-private");
    expect(state.loadingError).toBeNull();
    expect(state.isLoadinUploads).toBe(false);
});
