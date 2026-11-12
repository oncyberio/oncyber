/** @jest-environment jsdom */
import {
    NATIVE_CAMERA_PREFERENCE_EVENT,
    readNativeCameraPreference,
    rememberNativeCameraPreference,
} from "./nativeCameraPreference";
beforeEach(() => window.sessionStorage.clear());
test("an arrival's third-person choice survives the next destination's stale first-person profile", () => {
    rememberNativeCameraPreference("third_person");
    expect(readNativeCameraPreference("first_person")).toBe("third_person");
});
test("an explicit later first-person selection supersedes the arrival preference and announces it", () => {
    const changed = jest.fn();
    window.addEventListener(NATIVE_CAMERA_PREFERENCE_EVENT, changed);
    rememberNativeCameraPreference("third_person");
    rememberNativeCameraPreference("first_person");
    expect(readNativeCameraPreference("third_person")).toBe("first_person");
    expect(changed).toHaveBeenCalledTimes(2);
    window.removeEventListener(NATIVE_CAMERA_PREFERENCE_EVENT, changed);
});
test("malformed persisted values fall back to a valid account preference", () => {
    window.sessionStorage.setItem("oncyber:camera-preference", "invalid");
    expect(readNativeCameraPreference("third_person")).toBe("third_person");
    expect(readNativeCameraPreference("invalid")).toBe("first_person");
});
