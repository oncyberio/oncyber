/** @jest-environment jsdom */
import {
    createExperienceHistory,
    goToPreviousExperience,
    trackExperienceNavigation,
} from "./experienceNavigation";
import { requestLobbyDestinationBack } from "./lobbyDestinationBridge";
jest.mock("./lobbyDestinationBridge", () => ({
    requestLobbyDestinationBack: jest.fn(() => false),
}));
afterEach(() => jest.restoreAllMocks());
test("actual history keys distinguish revisit, Back/Forward and replacement", () => {
    const history = createExperienceHistory();
    history.visit("/one", "a");
    expect(history.canGoBack()).toBe(false);
    history.visit("/two", "b");
    history.visit("/two?camera=third", "b");
    history.visit("/one", "a");
    expect(history.canGoBack()).toBe(false);
    history.visit("/two?camera=third", "b");
    expect(history.canGoBack()).toBe(true);
    history.visit("/one", "c");
    expect(history.canGoBack()).toBe(true);
});
test("back delegates to an entered lobby parent before its home fallback", () => {
    const fallback = jest.fn();
    (requestLobbyDestinationBack as jest.Mock).mockReturnValueOnce(true);
    goToPreviousExperience(fallback);
    expect(fallback).not.toHaveBeenCalled();
    (requestLobbyDestinationBack as jest.Mock).mockReturnValueOnce(false);
    goToPreviousExperience(fallback);
    expect(fallback).toHaveBeenCalledTimes(1);
});
test("route tracking uses browser Back for a previous native space and detaches its listener", () => {
    const on = jest.fn(),
        off = jest.fn();
    window.history.replaceState({ key: "gallery-a" }, "", "/one");
    const stop = trackExperienceNavigation({
        events: { on, off },
        replace: jest.fn(),
    });
    window.history.replaceState({ key: "gallery-b" }, "", "/two");
    on.mock.calls[0][1]();
    const back = jest
        .spyOn(window.history, "back")
        .mockImplementation(() => {});
    const fallback = jest.fn();
    goToPreviousExperience(fallback);
    expect(back).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
    stop();
    expect(off).toHaveBeenCalledWith(
        "routeChangeComplete",
        on.mock.calls[0][1]
    );
});

test("portal replacements keep a previous space without treating coordinates as a new space", () => {
    const history = createExperienceHistory();
    history.visit("/pod?coords=0x2x0", "pod-entry");
    history.visit("/pod?coords=1x2x3", "pod-entry");
    expect(history.previous()).toBeNull();
    history.visit("/gallery?from=pod", "pod-entry");
    expect(history.previous()).toEqual({
        href: "/pod?coords=1x2x3",
        replace: true,
    });
    history.beginBack();
    history.visit("/pod?coords=1x2x3", "pod-entry");
    expect(history.previous()).toBeNull();
});

test("visiting a former space through another portal still retains the space just left", () => {
    const history = createExperienceHistory();
    history.visit("/pod", "a");
    history.visit("/gallery", "a");
    history.visit("/pod", "a");
    expect(history.previous()).toEqual({ href: "/gallery", replace: true });
});

describe("native departures before previous-space navigation", () => {
    let navigation: typeof import("./experienceNavigation");
    let cleanup: Array<() => void>;
    const matchMediaDescriptor = Object.getOwnPropertyDescriptor(
        window,
        "matchMedia"
    );
    const flush = async () => {
        for (let index = 0; index < 8; index++) await Promise.resolve();
    };
    beforeEach(() => {
        jest.resetModules();
        navigation = require("./experienceNavigation");
        cleanup = [];
        Object.defineProperty(window, "matchMedia", {
            configurable: true,
            value: jest.fn(() => ({ matches: true })),
        });
    });
    afterEach(() => {
        cleanup.reverse().forEach((release) => release());
        if (matchMediaDescriptor)
            Object.defineProperty(window, "matchMedia", matchMediaDescriptor);
        else delete window.matchMedia;
    });
    function previousSpace(
        replace = true,
        replaceRoute = jest.fn().mockResolvedValue(true)
    ) {
        const on = jest.fn();
        window.history.replaceState({ key: "first" }, "", "/first");
        cleanup.push(
            navigation.trackExperienceNavigation({
                replace: replaceRoute,
                events: { on, off: jest.fn() },
            })
        );
        window.history.replaceState(
            { key: replace ? "first" : "second" },
            "",
            "/second"
        );
        const record = on.mock.calls[0][1];
        record();
        return { record, replaceRoute, on };
    }
    test.each([false, true])(
        "previous-space Back waits for one live reduced-motion departure (replacement %s)",
        async (replace) => {
            const { replaceRoute } = previousSpace(replace);
            const back = jest
                .spyOn(window.history, "back")
                .mockImplementation(() => {});
            let finish: () => void;
            const depart = jest.fn(
                () =>
                    new Promise<void>((resolve) => {
                        finish = resolve;
                    })
            );
            cleanup.push(navigation.registerExperienceDeparture(depart));
            const fallback = jest.fn();
            navigation.goToPreviousExperience(fallback);
            navigation.goToPreviousExperience(fallback);
            expect(depart).toHaveBeenCalledTimes(1);
            expect(depart).toHaveBeenCalledWith({ reducedMotion: true });
            expect(replaceRoute).not.toHaveBeenCalled();
            expect(back).not.toHaveBeenCalled();
            finish();
            await flush();
            if (replace) expect(replaceRoute).toHaveBeenCalledWith("/first");
            else expect(back).toHaveBeenCalledTimes(1);
            expect(fallback).not.toHaveBeenCalled();
        }
    );
    test("route completion releases the guard for another portal Back in the same renderer", async () => {
        const { replaceRoute, record } = previousSpace();
        const depart = jest.fn().mockResolvedValue(undefined);
        const restore = jest.fn();
        cleanup.push(navigation.registerExperienceDeparture(depart, restore));
        navigation.goToPreviousExperience(jest.fn());
        await flush();
        expect(restore).not.toHaveBeenCalled();
        window.history.replaceState({ key: "first" }, "", "/first");
        record();
        expect(restore).toHaveBeenCalledTimes(1);
        window.history.replaceState({ key: "first" }, "", "/third");
        record();
        navigation.goToPreviousExperience(jest.fn());
        await flush();
        expect(depart).toHaveBeenCalledTimes(2);
        expect(replaceRoute).toHaveBeenCalledTimes(2);
        expect(replaceRoute).toHaveBeenLastCalledWith("/first");
    });
    test("unregistering a renderer cancels late departure navigation", async () => {
        const { replaceRoute } = previousSpace();
        let finish: () => void;
        const unregister = navigation.registerExperienceDeparture(
            () =>
                new Promise<void>((resolve) => {
                    finish = resolve;
                })
        );
        cleanup.push(unregister);
        navigation.goToPreviousExperience(jest.fn());
        unregister();
        finish();
        await flush();
        expect(replaceRoute).not.toHaveBeenCalled();
    });
    test("failed departure restores and navigates, while a rejected route can be retried", async () => {
        const replaceRoute = jest
            .fn()
            .mockRejectedValueOnce(new Error("route failed"))
            .mockResolvedValue(true);
        previousSpace(true, replaceRoute);
        const restore = jest.fn(() => {
            throw new Error("cleanup failed");
        });
        const depart = jest.fn().mockRejectedValue(new Error("context lost"));
        cleanup.push(navigation.registerExperienceDeparture(depart, restore));
        navigation.goToPreviousExperience(jest.fn());
        await flush();
        expect(restore).toHaveBeenCalledTimes(1);
        expect(replaceRoute).toHaveBeenCalledTimes(1);
        navigation.goToPreviousExperience(jest.fn());
        await flush();
        expect(restore).toHaveBeenCalledTimes(2);
        expect(replaceRoute).toHaveBeenCalledTimes(2);
    });
    test.each(["rejection", "cancelled"])(
        "a successful dissolve restores when route navigation ends with %s",
        async (outcome) => {
            const replaceRoute =
                outcome === "rejection"
                    ? jest
                          .fn()
                          .mockRejectedValueOnce(new Error("route failed"))
                          .mockResolvedValue(true)
                    : jest
                          .fn()
                          .mockResolvedValueOnce(false)
                          .mockResolvedValue(true);
            previousSpace(true, replaceRoute);
            const restore = jest.fn();
            const depart = jest.fn().mockResolvedValue(undefined);
            cleanup.push(
                navigation.registerExperienceDeparture(depart, restore)
            );
            navigation.goToPreviousExperience(jest.fn());
            await flush();
            expect(restore).toHaveBeenCalledTimes(1);
            navigation.goToPreviousExperience(jest.fn());
            await flush();
            expect(depart).toHaveBeenCalledTimes(2);
            expect(replaceRoute).toHaveBeenCalledTimes(2);
        }
    );
    test("browser-history route errors restore the source and allow another Back", async () => {
        const { on } = previousSpace(false);
        const back = jest
            .spyOn(window.history, "back")
            .mockImplementation(() => {});
        const restore = jest.fn();
        const depart = jest.fn().mockResolvedValue(undefined);
        cleanup.push(navigation.registerExperienceDeparture(depart, restore));
        navigation.goToPreviousExperience(jest.fn());
        await flush();
        on.mock.calls.find(([name]) => name === "routeChangeError")[1]();
        expect(restore).toHaveBeenCalledTimes(1);
        navigation.goToPreviousExperience(jest.fn());
        await flush();
        expect(depart).toHaveBeenCalledTimes(2);
        expect(back).toHaveBeenCalledTimes(2);
    });
    test("same-origin referrer Back also waits for native departure", async () => {
        jest.spyOn(document, "referrer", "get").mockReturnValue(
            `${window.location.origin}/earlier`
        );
        jest.spyOn(window.history, "length", "get").mockReturnValue(2);
        const back = jest
            .spyOn(window.history, "back")
            .mockImplementation(() => {});
        let finish: () => void;
        cleanup.push(
            navigation.registerExperienceDeparture(
                () =>
                    new Promise<void>((resolve) => {
                        finish = resolve;
                    })
            )
        );
        navigation.goToPreviousExperience(jest.fn());
        expect(back).not.toHaveBeenCalled();
        finish();
        await flush();
        expect(back).toHaveBeenCalledTimes(1);
    });
});

test("a coordinate-only shallow completion cannot cancel a pending departure", async () => {
    window.history.replaceState(
        { key: "coordinate-trip" },
        "",
        "/position-source"
    );
    const on = jest.fn();
    const stop = trackExperienceNavigation({
        replace: jest.fn(),
        events: { on, off: jest.fn() },
    });
    const nav = require("./experienceNavigation");
    let finish;
    const restore = jest.fn();
    const unregister = nav.registerExperienceDeparture(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            }),
        restore
    );
    const navigate = jest.fn().mockResolvedValue(true);
    nav.goToExperience("/position-target", navigate);
    window.history.replaceState(
        { key: "coordinate-trip" },
        "",
        "/position-source?coords=1x2x3x0"
    );
    on.mock.calls[0][1]();
    expect(restore).not.toHaveBeenCalled();
    finish();
    for (let i = 0; i < 6; i++) await Promise.resolve();
    expect(navigate).toHaveBeenCalledWith("/position-target");
    unregister();
    stop();
});
