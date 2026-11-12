/** @jest-environment jsdom */
import { LOBBY_DESTINATION_PROTOCOL } from "@features/lobby/lobbyJourneyProtocol";

const originalParent = Object.getOwnPropertyDescriptor(window, "parent");
const originalPlay = HTMLMediaElement.prototype.play;
const originalMatchMedia = Object.getOwnPropertyDescriptor(
    window,
    "matchMedia"
);
let parent: any;
let windowListeners: jest.SpyInstance;
let documentListeners: jest.SpyInstance;
let attempt = "12345678-1234-4234-8234-123456789abc";
let module: typeof import("./lobbyDestinationBridge");
const flush = async () => {
    for (let index = 0; index < 6; index++) await Promise.resolve();
};
function command(
    type = "enter",
    overrides = {},
    options: MessageEventInit = {}
) {
    window.dispatchEvent(
        new MessageEvent("message", {
            source: parent,
            origin: window.location.origin,
            data: {
                protocol: LOBBY_DESTINATION_PROTOCOL,
                attempt,
                type,
                ...overrides,
            },
            ...options,
        })
    );
}
beforeEach(() => {
    jest.resetModules();
    parent = {
        location: { origin: window.location.origin },
        postMessage: jest.fn(),
    };
    Object.defineProperty(window, "parent", {
        configurable: true,
        value: parent,
    });
    window.history.replaceState({}, "", `/space?__lobbyAttempt=${attempt}`);
    HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
    windowListeners = jest.spyOn(window, "addEventListener");
    documentListeners = jest.spyOn(document, "addEventListener");
    module = require("./lobbyDestinationBridge");
});
afterEach(() => {
    for (const [name, listener, options] of windowListeners.mock.calls)
        window.removeEventListener(name, listener, options);
    for (const [name, listener, options] of documentListeners.mock.calls)
        document.removeEventListener(name, listener, options);
    windowListeners.mockRestore();
    documentListeners.mockRestore();
    Object.defineProperty(window, "parent", originalParent);
    HTMLMediaElement.prototype.play = originalPlay;
    if (originalMatchMedia)
        Object.defineProperty(window, "matchMedia", originalMatchMedia);
    else delete window.matchMedia;
    document.documentElement.inert = false;
    window.history.replaceState({}, "", "/");
});
test("preparation is inert and silent; only the real parent can commit a rendered destination", async () => {
    const listener = { getMasterVolume: () => 0.7, setMasterVolume: jest.fn() };
    module.holdLobbyDestinationAudio(listener);
    module.holdLobbyDestinationAudio(listener);
    expect(listener.setMasterVolume).toHaveBeenCalledTimes(1);
    expect(listener.setMasterVolume).toHaveBeenCalledWith(0);
    expect(document.documentElement.inert).toBe(true);
    const key = new KeyboardEvent("keydown", { key: "w", cancelable: true });
    window.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);
    const audio = document.createElement("audio");
    await audio.play();
    expect(audio.muted).toBe(true);
    let resolve: () => void;
    const enter = jest.fn(
        () =>
            new Promise<void>((done) => {
                resolve = done;
            })
    );
    module.registerLobbyDestinationEntry(enter, jest.fn());
    expect(parent.postMessage).not.toHaveBeenCalled();
    module.lobbyDestinationPrepared();
    expect(parent.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "prepared", attempt }),
        window.location.origin
    );
    command("enter", {}, { origin: "https://other.example" });
    command("enter", { attempt: "old-attempt" });
    command("enter", {}, { source: window });
    expect(enter).not.toHaveBeenCalled();
    command();
    command();
    expect(enter).toHaveBeenCalledTimes(1);
    expect(document.documentElement.inert).toBe(true);
    expect(module.isLobbyDestinationEntering()).toBe(true);
    resolve();
    await flush();
    expect(document.documentElement.inert).toBe(false);
    expect(audio.muted).toBe(false);
    expect(listener.setMasterVolume).toHaveBeenLastCalledWith(0.7);
    expect(parent.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "entered" }),
        window.location.origin
    );
});
test("failed admission leaves preparation silent and sends a real error", async () => {
    const dispose = jest.fn();
    module.registerLobbyDestinationEntry(async () => {
        throw new Error("Room full");
    }, dispose);
    module.lobbyDestinationPrepared();
    command();
    await flush();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(document.documentElement.inert).toBe(true);
    expect(parent.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
            type: "error",
            error: {
                code: "admission-failed",
                message: "Room full",
                canOpenNormally: true,
            },
        }),
        window.location.origin
    );
});
test("cancelled admission cannot acknowledge late success or release hidden audio", async () => {
    let resolve: () => void;
    const dispose = jest.fn();
    module.registerLobbyDestinationEntry(
        () =>
            new Promise<void>((done) => {
                resolve = done;
            }),
        dispose
    );
    module.lobbyDestinationPrepared();
    command();
    command("dispose");
    resolve();
    await flush();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(document.documentElement.inert).toBe(true);
    expect(
        parent.postMessage.mock.calls.some(
            ([value]) => value.type === "entered"
        )
    ).toBe(false);
});

test("a prepared scene cannot signal readiness or enter until its runtime entry handler exists", async () => {
    module.lobbyDestinationPrepared();
    command();
    expect(parent.postMessage).not.toHaveBeenCalled();
    expect(module.isLobbyDestinationEntering()).toBe(false);
    const enter = jest.fn().mockResolvedValue(undefined);
    module.registerLobbyDestinationEntry(enter, jest.fn());
    expect(parent.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "prepared" }),
        window.location.origin
    );
    command();
    await flush();
    expect(enter).toHaveBeenCalledTimes(1);
    expect(module.isLobbyDestinationPreparing()).toBe(false);
});

test("cinematic admission keeps media and controls held until its parent finishes the reveal", async () => {
    const listener = { getMasterVolume: () => 0.6, setMasterVolume: jest.fn() };
    module.holdLobbyDestinationAudio(listener);
    module.registerLobbyDestinationEntry(async () => {}, jest.fn());
    module.lobbyDestinationPrepared();
    command("reveal");
    expect(document.documentElement.inert).toBe(true);
    command("enter", { awaitReveal: true });
    await flush();
    expect(parent.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "entered" }),
        window.location.origin
    );
    expect(document.documentElement.inert).toBe(true);
    expect(listener.setMasterVolume).toHaveBeenLastCalledWith(0);
    command("reveal", { attempt: "old" });
    expect(document.documentElement.inert).toBe(true);
    command("reveal");
    await flush();
    expect(document.documentElement.inert).toBe(false);
    expect(listener.setMasterVolume).toHaveBeenLastCalledWith(0.6);
    command("reveal");
    expect(listener.setMasterVolume).toHaveBeenCalledTimes(2);
});

test("native renderer reveal holds keyboard and audio until explicit completion", async () => {
    let finish: () => void;
    const reveal = jest.fn(
        () =>
            new Promise<void>((resolve) => {
                finish = resolve;
            })
    );
    const enter = jest.fn().mockResolvedValue(undefined);
    const listener = { getMasterVolume: () => 0.7, setMasterVolume: jest.fn() };
    module.holdLobbyDestinationAudio(listener);
    module.registerLobbyDestinationEntry(enter, jest.fn(), { reveal });
    module.lobbyDestinationPrepared();
    expect(parent.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "prepared", reveal: "native" }),
        window.location.origin
    );
    const travelView = {
        cameraOffset: { x: 1, y: 2, z: 3 },
        cameraTargetOffset: { x: 0, y: 1, z: 0 },
        avatarRotation: 0.5,
        avatarLift: 0.4,
        fov: 65,
    };
    command("enter", { awaitReveal: true, travelView });
    await flush();
    expect(enter).toHaveBeenCalledWith({ travelView, reducedMotion: false });
    command("reveal", { reducedMotion: true });
    command("reveal");
    expect(reveal).toHaveBeenCalledTimes(1);
    expect(reveal).toHaveBeenCalledWith({ travelView, reducedMotion: true });
    const key = new KeyboardEvent("keydown", { key: "w", cancelable: true });
    window.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);
    expect(document.documentElement.inert).toBe(true);
    expect(listener.setMasterVolume).toHaveBeenLastCalledWith(0);
    expect(
        parent.postMessage.mock.calls.some(
            ([value]) => value.type === "revealed"
        )
    ).toBe(false);
    finish();
    await flush();
    expect(document.documentElement.inert).toBe(false);
    expect(listener.setMasterVolume).toHaveBeenLastCalledWith(0.7);
    expect(parent.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "revealed", attempt }),
        window.location.origin
    );
    const released = new KeyboardEvent("keydown", {
        key: "w",
        cancelable: true,
    });
    window.dispatchEvent(released);
    expect(released.defaultPrevented).toBe(false);
    command("reveal");
    await flush();
    expect(
        parent.postMessage.mock.calls.filter(
            ([value]) => value.type === "revealed"
        )
    ).toHaveLength(1);
});
test("cancelling a native reveal ignores late renderer completion", async () => {
    let finish: () => void;
    const dispose = jest.fn();
    module.registerLobbyDestinationEntry(async () => {}, dispose, {
        reveal: () =>
            new Promise<void>((resolve) => {
                finish = resolve;
            }),
    });
    module.lobbyDestinationPrepared();
    command("enter", { awaitReveal: true });
    await flush();
    command("reveal");
    command("dispose");
    command("dispose");
    finish();
    await flush();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(document.documentElement.inert).toBe(true);
    expect(
        parent.postMessage.mock.calls.some(
            ([value]) => value.type === "revealed"
        )
    ).toBe(false);
});
test("renderer failure reports an entrance failure without releasing controls", async () => {
    const dispose = jest.fn();
    module.registerLobbyDestinationEntry(async () => {}, dispose, {
        reveal: async () => {
            throw new Error("Context lost");
        },
    });
    module.lobbyDestinationPrepared();
    command("enter", { awaitReveal: true });
    await flush();
    command("reveal");
    await flush();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(document.documentElement.inert).toBe(true);
    expect(parent.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
            type: "error",
            error: expect.objectContaining({ code: "reveal-failed" }),
        }),
        window.location.origin
    );
});
test("an unmounted renderer cannot acknowledge late reveal success", async () => {
    let finish: () => void;
    const unregister = module.registerLobbyDestinationEntry(
        async () => {},
        jest.fn(),
        {
            reveal: () =>
                new Promise<void>((resolve) => {
                    finish = resolve;
                }),
        }
    );
    module.lobbyDestinationPrepared();
    command("enter", { awaitReveal: true });
    await flush();
    command("reveal");
    unregister();
    finish();
    await flush();
    expect(document.documentElement.inert).toBe(true);
    expect(
        parent.postMessage.mock.calls.some(
            ([value]) => value.type === "revealed"
        )
    ).toBe(false);
});
test("malformed camera data is omitted from native entry", async () => {
    const enter = jest.fn().mockResolvedValue(undefined);
    module.registerLobbyDestinationEntry(enter, jest.fn());
    module.lobbyDestinationPrepared();
    command("enter", {
        awaitReveal: true,
        travelView: { cameraOffset: { x: Infinity, y: 0, z: 0 } },
    });
    await flush();
    expect(enter).toHaveBeenCalledWith({ reducedMotion: false });
});

test("native camera staging acknowledges its rendered frame before reveal can start", async () => {
    let staged: () => void;
    const prepareReveal = jest.fn(
        () =>
            new Promise<void>((resolve) => {
                staged = resolve;
            })
    );
    const reveal = jest.fn().mockResolvedValue(undefined);
    module.registerLobbyDestinationEntry(async () => {}, jest.fn(), {
        prepareReveal,
        reveal,
    });
    module.lobbyDestinationPrepared();
    command("enter", { awaitReveal: true });
    await flush();
    command("reveal");
    expect(reveal).not.toHaveBeenCalled();
    const travelView = {
        cameraOffset: { x: 4, y: 5, z: 6 },
        cameraTargetOffset: { x: 0, y: 1, z: 0 },
        avatarRotation: 0.8,
        avatarLift: 0.2,
        fov: 60,
    };
    command("stage-reveal", { travelView });
    command("stage-reveal", { travelView });
    expect(prepareReveal).toHaveBeenCalledTimes(1);
    expect(prepareReveal).toHaveBeenCalledWith({
        reducedMotion: false,
        travelView,
    });
    expect(
        parent.postMessage.mock.calls.some(
            ([value]) => value.type === "reveal-ready"
        )
    ).toBe(false);
    command("reveal");
    expect(reveal).not.toHaveBeenCalled();
    staged();
    await flush();
    expect(parent.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "reveal-ready" }),
        window.location.origin
    );
    expect(document.documentElement.inert).toBe(true);
    command("reveal");
    await flush();
    expect(reveal).toHaveBeenCalledWith({ reducedMotion: false, travelView });
    expect(document.documentElement.inert).toBe(false);
});
test("cancelled staging never exposes a late prepared frame", async () => {
    let staged: () => void;
    module.registerLobbyDestinationEntry(async () => {}, jest.fn(), {
        prepareReveal: () =>
            new Promise<void>((resolve) => {
                staged = resolve;
            }),
        reveal: async () => {},
    });
    module.lobbyDestinationPrepared();
    command("enter", { awaitReveal: true });
    await flush();
    command("stage-reveal");
    command("dispose");
    staged();
    await flush();
    expect(document.documentElement.inert).toBe(true);
    expect(
        parent.postMessage.mock.calls.some(
            ([value]) => value.type === "reveal-ready"
        )
    ).toBe(false);
});

test("late rejection from an unmounted reveal cannot fail a replacement renderer", async () => {
    let reject: (error: Error) => void;
    const unregister = module.registerLobbyDestinationEntry(
        async () => {},
        jest.fn(),
        {
            reveal: () =>
                new Promise<void>((_resolve, fail) => {
                    reject = fail;
                }),
        }
    );
    module.lobbyDestinationPrepared();
    command("enter", { awaitReveal: true });
    await flush();
    command("reveal");
    unregister();
    const disposeReplacement = jest.fn();
    module.registerLobbyDestinationEntry(async () => {}, disposeReplacement);
    reject(new Error("old renderer disposed"));
    await flush();
    expect(disposeReplacement).not.toHaveBeenCalled();
    expect(
        parent.postMessage.mock.calls.some(([value]) => value.type === "error")
    ).toBe(false);
    expect(document.documentElement.inert).toBe(true);
});

test("the shared back arrow can return only after a successful parent-owned entry", async () => {
    expect(module.requestLobbyDestinationBack()).toBe(false);
    module.registerLobbyDestinationEntry(async () => {}, jest.fn());
    module.lobbyDestinationPrepared();
    expect(module.requestLobbyDestinationBack()).toBe(false);
    command();
    await flush();
    expect(module.requestLobbyDestinationBack()).toBe(true);
    expect(parent.postMessage).toHaveBeenLastCalledWith(
        {
            protocol: LOBBY_DESTINATION_PROTOCOL,
            attempt,
            type: "back",
        },
        window.location.origin
    );
    command("dispose");
    expect(module.requestLobbyDestinationBack()).toBe(false);
});

test.each([false, true])(
    "Back waits for one departure and uses the live reduced-motion setting %s",
    async (reducedMotion) => {
        let finish: () => void;
        const depart = jest.fn(
            () =>
                new Promise<void>((resolve) => {
                    finish = resolve;
                })
        );
        Object.defineProperty(window, "matchMedia", {
            configurable: true,
            value: jest.fn(() => ({ matches: reducedMotion })),
        });
        module.registerLobbyDestinationEntry(async () => {}, jest.fn(), {
            depart,
        });
        expect(module.requestLobbyDestinationBack()).toBe(false);
        module.lobbyDestinationPrepared();
        command("enter", { reducedMotion: !reducedMotion });
        await flush();
        parent.postMessage.mockClear();
        expect(module.requestLobbyDestinationBack()).toBe(true);
        expect(module.requestLobbyDestinationBack()).toBe(true);
        expect(depart).toHaveBeenCalledTimes(1);
        expect(depart).toHaveBeenCalledWith({ reducedMotion });
        expect(module.isLobbyDestinationPreparing()).toBe(false);
        expect(parent.postMessage).not.toHaveBeenCalled();
        finish();
        await flush();
        expect(parent.postMessage).toHaveBeenCalledTimes(1);
        expect(parent.postMessage).toHaveBeenCalledWith(
            { protocol: LOBBY_DESTINATION_PROTOCOL, attempt, type: "back" },
            window.location.origin
        );
        expect(module.requestLobbyDestinationBack()).toBe(true);
        expect(depart).toHaveBeenCalledTimes(1);
        expect(parent.postMessage).toHaveBeenCalledTimes(1);
    }
);

test("parent disposal cancels pending Back without a late return", async () => {
    let finish: () => void;
    const dispose = jest.fn();
    module.registerLobbyDestinationEntry(async () => {}, dispose, {
        depart: () =>
            new Promise<void>((resolve) => {
                finish = resolve;
            }),
    });
    module.lobbyDestinationPrepared();
    command();
    await flush();
    parent.postMessage.mockClear();
    module.requestLobbyDestinationBack();
    command("dispose");
    finish();
    await flush();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(parent.postMessage).not.toHaveBeenCalled();
    expect(module.requestLobbyDestinationBack()).toBe(false);
});

test("unregistering an old departure suppresses rejection without disposing its replacement", async () => {
    let reject: (error: Error) => void;
    const enter = async () => {};
    const unregister = module.registerLobbyDestinationEntry(enter, jest.fn(), {
        depart: () =>
            new Promise<void>((_, fail) => {
                reject = fail;
            }),
    });
    module.lobbyDestinationPrepared();
    command();
    await flush();
    module.requestLobbyDestinationBack();
    const replacementDispose = jest.fn();
    const replacementDepart = jest.fn().mockResolvedValue(undefined);
    module.registerLobbyDestinationEntry(enter, replacementDispose, {
        depart: replacementDepart,
    });
    unregister();
    parent.postMessage.mockClear();
    reject(new Error("old renderer gone"));
    await flush();
    expect(replacementDispose).not.toHaveBeenCalled();
    expect(parent.postMessage).not.toHaveBeenCalled();
    module.requestLobbyDestinationBack();
    await flush();
    expect(replacementDepart).toHaveBeenCalledTimes(1);
    expect(parent.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "back" }),
        window.location.origin
    );
});

test.each([false, true])(
    "a failed departure cleans up and still returns even if cleanup throws (%s)",
    async (cleanupThrows) => {
        const dispose = jest.fn(() => {
            if (cleanupThrows) throw new Error("cleanup failed");
        });
        module.registerLobbyDestinationEntry(async () => {}, dispose, {
            depart: async () => {
                throw new Error("context lost");
            },
        });
        module.lobbyDestinationPrepared();
        command();
        await flush();
        parent.postMessage.mockClear();
        expect(module.requestLobbyDestinationBack()).toBe(true);
        await flush();
        expect(dispose).toHaveBeenCalledTimes(1);
        expect(parent.postMessage).toHaveBeenCalledTimes(1);
        expect(parent.postMessage).toHaveBeenLastCalledWith(
            expect.objectContaining({ type: "back" }),
            window.location.origin
        );
    }
);

test.each([false, true])(
    "Back forwards only validated copied renderer framing (invalid: %s)",
    async (invalid) => {
        const view = {
            cameraOffset: { x: 1, y: 2.1, z: 1.5 },
            cameraTargetOffset: { x: 0.1, y: 1.6, z: -1 },
            avatarRotation: 0.7,
            avatarLift: 0,
            avatarHeight: 2.7,
            cameraMode: "third-person" as const,
            fov: invalid ? NaN : 71,
        };
        module.registerLobbyDestinationEntry(async () => {}, jest.fn(), {
            depart: async () => view,
        });
        module.lobbyDestinationPrepared();
        command();
        await flush();
        parent.postMessage.mockClear();
        module.requestLobbyDestinationBack();
        await flush();
        const message = parent.postMessage.mock.calls[0][0];
        expect(message.type).toBe("back");
        if (invalid) expect(message.travelView).toBeUndefined();
        else {
            expect(message.travelView).toEqual(view);
            expect(message.travelView).not.toBe(view);
            expect(message.travelView.cameraOffset).not.toBe(view.cameraOffset);
            view.cameraOffset.x = 99;
            expect(message.travelView.cameraOffset.x).toBe(1);
        }
    }
);

test("background work waits for reveal completion, not admission or staging", async () => {
    let finishReveal: () => void;
    const ready = jest.fn();
    module.registerLobbyDestinationEntry(async () => {}, jest.fn(), {
        prepareReveal: async () => {},
        reveal: () =>
            new Promise<void>((resolve) => {
                finishReveal = resolve;
            }),
    });
    const waiting = module.waitForLobbyDestinationEntry().then(ready);
    module.lobbyDestinationPrepared();
    command("enter", { awaitReveal: true });
    await flush();
    expect(ready).not.toHaveBeenCalled();
    command("stage-reveal");
    await flush();
    expect(ready).not.toHaveBeenCalled();
    command("reveal");
    await flush();
    expect(ready).not.toHaveBeenCalled();
    finishReveal();
    await waiting;
    expect(ready).toHaveBeenCalledTimes(1);
    await expect(
        module.waitForLobbyDestinationEntry()
    ).resolves.toBeUndefined();
});

test("legacy entry releases background work and direct visits do not wait", async () => {
    module.registerLobbyDestinationEntry(async () => {}, jest.fn());
    const waiting = module.waitForLobbyDestinationEntry();
    module.lobbyDestinationPrepared();
    command();
    await expect(waiting).resolves.toBeUndefined();
    jest.resetModules();
    Object.defineProperty(window, "parent", {
        configurable: true,
        value: window,
    });
    const direct = require("./lobbyDestinationBridge");
    await expect(
        direct.waitForLobbyDestinationEntry()
    ).resolves.toBeUndefined();
});

test("cancelling one background consumer removes its listener and preserves other consumers", async () => {
    const abort = new AbortController();
    const remove = jest.spyOn(abort.signal, "removeEventListener");
    const cancelled = module
        .waitForLobbyDestinationEntry(abort.signal)
        .catch((error) => error);
    const survivor = module.waitForLobbyDestinationEntry();
    abort.abort();
    expect(await cancelled).toMatchObject({ name: "AbortError" });
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    module.registerLobbyDestinationEntry(async () => {}, jest.fn());
    module.lobbyDestinationPrepared();
    command();
    await expect(survivor).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledTimes(1);
});

test.each(["dispose", "admission failure", "unregister"])(
    "%s releases deferred consumers with cancellation",
    async (failure) => {
        const unregister = module.registerLobbyDestinationEntry(async () => {
            if (failure === "admission failure")
                throw new Error("Access denied");
        }, jest.fn());
        const aborted = module
            .waitForLobbyDestinationEntry()
            .catch((error) => error);
        if (failure === "dispose") command("dispose");
        if (failure === "unregister") unregister();
        if (failure === "admission failure") {
            module.lobbyDestinationPrepared();
            command();
        }
        expect(await aborted).toMatchObject({ name: "AbortError" });
        if (failure !== "unregister")
            await expect(
                module.waitForLobbyDestinationEntry()
            ).rejects.toMatchObject({ name: "AbortError" });
    }
);

test("an already aborted consumer never waits for entry", async () => {
    const abort = new AbortController();
    abort.abort();
    await expect(
        module.waitForLobbyDestinationEntry(abort.signal)
    ).rejects.toMatchObject({ name: "AbortError" });
});

test("portal rendering is admission-bound, validates poses and stops on dispose", async () => {
    const view = {
        cameraPosition: { x: 0, y: 2, z: 5 },
        cameraTarget: { x: 0, y: 1, z: 0 },
        playerPosition: { x: 0, y: 0, z: 2 },
        avatarRotation: 0,
        avatarHeight: 1.8,
        fov: 60,
        aspect: 1.5,
    };
    const previewPortal = jest.fn();
    const prepareReveal = jest.fn(async () => {});
    const unregister = module.registerLobbyDestinationEntry(
        jest.fn(async () => {}),
        jest.fn(),
        { previewPortal, prepareReveal }
    );
    const preview = window["__oncyberLobbyPortalPreview"];
    expect(preview.render(view)).toBe(false);
    module.lobbyDestinationPrepared();
    command("enter", { portalView: view, awaitReveal: true });
    await flush();
    expect(preview.render(view)).toBe(true);
    expect(previewPortal).toHaveBeenCalledWith(view);
    expect(preview.render({ ...view, fov: NaN })).toBe(false);
    expect(document.documentElement.inert).toBe(true);
    const crossing = { ...view, playerPosition: { x: 1, y: 0, z: -3 } };
    expect(preview.render(crossing)).toBe(true);
    command("stage-reveal");
    await flush();
    expect(prepareReveal).toHaveBeenCalledWith(
        expect.objectContaining({ portalView: crossing })
    );
    command("dispose");
    expect(preview.render(view)).toBe(false);
    unregister();
    expect(window["__oncyberLobbyPortalPreview"]).toBeUndefined();
});

test("an admitted live portal crosses once without another reveal stage or a final capture flash", async () => {
    const view = {
        cameraPosition: { x: 0, y: 2, z: 0.5 },
        cameraTarget: { x: 0, y: 1, z: -3 },
        playerPosition: { x: 0, y: 0, z: -3 },
        avatarRotation: 0,
        fov: 60,
        aspect: 1.5,
        movement: { keys: ["KeyW"], speed: 3, velocity: { x: 0, y: 0, z: -3 } },
    };
    let finish: () => void;
    const reveal = jest.fn(
        () =>
            new Promise<void>((resolve) => {
                finish = resolve;
            })
    );
    const prepareReveal = jest.fn();
    const previewPortal = jest.fn();
    module.registerLobbyDestinationEntry(
        jest.fn(async () => {}),
        jest.fn(),
        { reveal, prepareReveal, previewPortal }
    );
    module.lobbyDestinationPrepared();
    command("reveal", { portal: true });
    expect(reveal).not.toHaveBeenCalled();
    command("enter", { portalView: view, awaitReveal: true });
    await flush();
    const preview = window["__oncyberLobbyPortalPreview"];
    expect(preview.render({ ...view, movement: null })).toBe(false);
    expect(
        preview.render({
            ...view,
            movement: {
                ...view.movement,
                velocity: { x: Infinity, y: 0, z: 0 },
            },
        })
    ).toBe(false);
    expect(preview.render(view)).toBe(true);
    command("reveal", { portal: true });
    command("reveal", { portal: true });
    expect(reveal).toHaveBeenCalledTimes(1);
    expect(prepareReveal).not.toHaveBeenCalled();
    expect(reveal).toHaveBeenCalledWith(
        expect.objectContaining({ portalView: view })
    );
    expect(document.documentElement.inert).toBe(true);
    expect(preview.render(view)).toBe(true);
    finish();
    await flush();
    expect(document.documentElement.inert).toBe(false);
    expect(parent.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "revealed", attempt }),
        window.location.origin
    );
    expect(preview.render(view)).toBe(true);
    expect(previewPortal).toHaveBeenCalledTimes(1);
});
