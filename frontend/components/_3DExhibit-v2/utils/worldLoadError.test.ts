/** @jest-environment jsdom */
import {
    atStage,
    describeWorldLoadError,
    formatWorldErrorDetails,
    WorldLoadStage,
    WorldLoadStageError,
    worldErrorDetails,
} from "./worldLoadError";
import { WORLD_ERROR_COPY } from "./constants";

// The values of ERROR_CODES in three/constants.js, which jest cannot load.
const codes = {
    INVALID_MODEL: 1,
    INVALID_TRANSFORM: 2,
    INVALID_JSON_CINEMATIC: 3,
    INVALID_VRM_COUNT_MESH: 4,
    INVALID_VRM_BONES: 5,
    INVALID_VRM_FILE: 6,
    VRM_GENERAL_ERROR: 7,
    VRM_MESHES_OVERCOUNT_ERROR: 8,
};
const named = (name: string, message: string) =>
    Object.assign(new Error(message), { name });
const tagged = (stage: WorldLoadStage, cause: unknown) =>
    new WorldLoadStageError(stage, cause);

// What each load failure the classic world path can produce reads as.
test.each([
    [
        "no destination (getDestination returned nothing)",
        Object.assign(new Error("no-destination"), {
            kind: "destination-unavailable",
        }),
        {},
        "destination-unavailable",
        "This world didn’t load",
        "Check your connection and try again.",
    ],
    [
        "the visitor is offline, whatever was thrown",
        tagged(
            "world-model",
            new Error("Failed to parse glft file of the room")
        ),
        { online: false },
        "connection",
        "The connection dropped",
        "Check that you’re online, then try again.",
    ],
    [
        "a request that never reached the server",
        new TypeError("Failed to fetch"),
        { stage: "cinematic" },
        "connection",
        "The connection dropped",
        "Check that you’re online, then try again.",
    ],
    [
        "Safari's failed request",
        new TypeError("Load failed"),
        {},
        "connection",
        "The connection dropped",
        "Check that you’re online, then try again.",
    ],
    [
        "the room model could not be downloaded or parsed",
        tagged(
            "world-model",
            new Error("Failed to parse glft file of the room")
        ),
        {},
        "world-model",
        "This world’s 3D model didn’t load",
        "Try again in a moment, or tell the world’s creator if it keeps happening.",
    ],
    [
        "a texture worker rejected with a bare string",
        tagged("world-model", "not found"),
        {},
        "world-model",
        "This world’s 3D model didn’t load",
        "Try again in a moment, or tell the world’s creator if it keeps happening.",
    ],
    [
        "an uploaded model the optimiser rejects (plain object with a code)",
        tagged("world-model", { code: 1, value: new Error("bad root") }),
        {},
        "world-model",
        "This world’s 3D model didn’t load",
        "Try again in a moment, or tell the world’s creator if it keeps happening.",
    ],
    [
        "an avatar file that is not a VRM",
        tagged("avatar", { code: 6 }),
        {},
        "avatar",
        "Your avatar didn’t load",
        "Try again, or choose a different avatar in your settings.",
    ],
    [
        "an avatar that fails while the room is fine",
        tagged(
            "avatar",
            new Error("THREE.GLTFLoader: JSON content not found.")
        ),
        {},
        "avatar",
        "Your avatar didn’t load",
        "Try again, or choose a different avatar in your settings.",
    ],
    [
        "no WebGPU adapter and no WebGL fallback",
        new Error("THREE.WebGPUBackend: Unable to create WebGPU adapter."),
        { stage: "engine" },
        "graphics",
        "3D graphics couldn’t start",
        "Close other tabs that use 3D, then try again or use another browser.",
    ],
    [
        "the engine failing to start for any other reason",
        new TypeError(
            "Cannot read properties of null (reading 'getExtension')"
        ),
        { stage: "engine" },
        "graphics",
        "3D graphics couldn’t start",
        "Close other tabs that use 3D, then try again or use another browser.",
    ],
    [
        "a lost graphics device while the scene is built",
        new Error("WebGL context lost"),
        { stage: "scene" },
        "graphics",
        "3D graphics couldn’t start",
        "Close other tabs that use 3D, then try again or use another browser.",
    ],
    [
        "a buffer too large for this device",
        tagged("world-model", new RangeError("Array buffer allocation failed")),
        {},
        "memory",
        "This device ran out of memory",
        "Close other tabs and apps, then try again.",
    ],
    [
        "an out-of-memory message from the GPU",
        new Error("GL_OUT_OF_MEMORY"),
        { stage: "scene" },
        "memory",
        "This device ran out of memory",
        "Close other tabs and apps, then try again.",
    ],
    [
        "a cinematic response that is not JSON",
        new SyntaxError(
            "Unexpected token '<', \"<!DOCTYPE \" is not valid JSON"
        ),
        { stage: "cinematic" },
        "load-failed",
        "This world didn’t open",
        "Try again in a moment.",
    ],
    [
        "a cinematic file the engine rejects",
        { code: 3 },
        { stage: "scene" },
        "load-failed",
        "This world didn’t open",
        "Try again in a moment.",
    ],
    [
        "anything else while the scene is assembled",
        new Error("Cannot read properties of undefined (reading 'x')"),
        { stage: "scene" },
        "load-failed",
        "This world didn’t open",
        "Try again in a moment.",
    ],
    [
        "nothing at all",
        undefined,
        {},
        "load-failed",
        "This world didn’t open",
        "Try again in a moment.",
    ],
])("%s", (_name, thrown, context, kind, title, message) => {
    const failure = describeWorldLoadError(thrown, { ...context, codes });
    expect(failure.kind).toBe(kind);
    expect(failure.title).toBe(title);
    expect(failure.message).toBe(message);
    expect(WORLD_ERROR_COPY[failure.kind]).toEqual({ title, message });
});

test("every kind has a short title and one plain sentence, with no codes", () => {
    for (const { title, message } of Object.values(WORLD_ERROR_COPY)) {
        expect(title.length).toBeLessThanOrEqual(40);
        expect(message).toMatch(/^[A-Z][^.]*\.$/);
        expect(`${title} ${message}`).not.toMatch(/error|code/i);
    }
});

test("atStage tags a failure with its step once, keeping what was thrown", async () => {
    const cause = { code: 7 };
    const error = await atStage("avatar", () =>
        atStage("scene", () => Promise.reject(cause))
    ).catch((value) => value);
    expect(error).toBeInstanceOf(WorldLoadStageError);
    expect(error.stage).toBe("scene");
    expect(error.cause).toBe(cause);
    await expect(atStage("scene", async () => 3)).resolves.toBe(3);
});

test("details name the error, code, step, world, time, browser and graphics", () => {
    const details = worldErrorDetails(
        tagged(
            "world-model",
            Object.assign(
                new Error(
                    'THREE.GLTFLoader: Failed to load buffer "https://cdn.test/room.bin?token=secret#k".'
                ),
                { code: 1 }
            )
        ),
        {
            address: "https://oncyber.test/spaces/gallery?invite=abc",
            now: new Date("2026-11-10T12:00:00Z"),
            browser: "TestBrowser/1.0",
            graphics: "webgpu",
        }
    );
    expect(formatWorldErrorDetails(details)).toBe(
        [
            'Error: Error: THREE.GLTFLoader: Failed to load buffer "https://cdn.test/room.bin".',
            "Code: 1",
            "Step: world-model",
            "World: https://oncyber.test/spaces/gallery",
            "Time: 2026-11-10T12:00:00.000Z",
            "Browser: TestBrowser/1.0",
            "Graphics: webgpu",
        ].join("\n")
    );
    expect(JSON.stringify(details)).not.toMatch(/secret|invite|token/);
});

test("details of a bare string or an empty rejection still read", () => {
    const text = formatWorldErrorDetails(
        worldErrorDetails("not found", {
            address: "https://oncyber.test/x",
            browser: "B",
            now: new Date(0),
        })
    );
    expect(text.split("\n")[0]).toBe("Error: Message: not found");
    expect(
        formatWorldErrorDetails(
            worldErrorDetails(undefined, {
                address: "",
                browser: "",
                now: new Date(0),
            })
        )
    ).toBe("Error: Error: No message\nTime: 1970-01-01T00:00:00.000Z");
});

test("details default to the page address without its query, and this browser", () => {
    window.history.replaceState({}, "", "/spaces/gallery?token=abc");
    const details = worldErrorDetails(named("AbortError", "x"));
    expect(details.address).toBe(`${window.location.origin}/spaces/gallery`);
    expect(details.browser).toBe(navigator.userAgent);
    expect(details.name).toBe("AbortError");
});

describe("an engine error that wraps the original", () => {
    const wrapped = (cause: unknown) =>
        tagged(
            "world-model",
            new Error("Failed to parse glft file of the room", { cause })
        );

    test("reads as what the original was", () => {
        const offline = describeWorldLoadError(
            wrapped(new TypeError("Failed to fetch")),
            { codes }
        );
        expect(offline.kind).toBe("connection");
        const memory = describeWorldLoadError(
            wrapped(new RangeError("Array buffer allocation failed")),
            { codes }
        );
        expect(memory.kind).toBe("memory");
        const download = describeWorldLoadError(
            wrapped(new Error("Failed to download the room (HTTP 404)")),
            { codes }
        );
        expect(download.kind).toBe("world-model");
    });

    test("copies both messages into the details", () => {
        const details = worldErrorDetails(
            wrapped(new Error("Failed to download the room (HTTP 404)")),
            { now: new Date(0), browser: "test", address: "x" }
        );
        expect(details.message).toBe(
            "Failed to parse glft file of the room ← Failed to download the room (HTTP 404)"
        );
    });
});
