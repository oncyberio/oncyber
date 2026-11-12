export type NativeCameraPreference = "first_person" | "third_person";
export const NATIVE_CAMERA_PREFERENCE_EVENT = "oncyber:camera-preference";
const KEY = "oncyber:camera-preference";
const valid = (value: unknown): value is NativeCameraPreference =>
    value === "first_person" || value === "third_person";
export function readNativeCameraPreference(
    fallback: unknown = "first_person"
): NativeCameraPreference {
    let stored: string;
    try {
        stored =
            typeof window === "undefined"
                ? undefined
                : window.sessionStorage.getItem(KEY);
    } catch {}
    return valid(stored) ? stored : valid(fallback) ? fallback : "first_person";
}
/** Keep the user's current view across same-tab native destinations. Explicit
 * settings changes still use the existing account persistence separately. */
export function rememberNativeCameraPreference(value: NativeCameraPreference) {
    if (!valid(value) || typeof window === "undefined") return;
    try {
        window.sessionStorage.setItem(KEY, value);
    } catch {}
    window.dispatchEvent(
        new CustomEvent(NATIVE_CAMERA_PREFERENCE_EVENT, { detail: value })
    );
}
