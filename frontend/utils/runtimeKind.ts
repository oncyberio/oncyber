import { isEmbeddedRuntime } from "@features/content-host/runtime";

/** Native Oncyber galleries: no runtime, or the explicit "cyber" kind. */
export function isNativeRuntime(runtime: { kind?: string } | null | undefined) {
    return !runtime?.kind || runtime.kind === "cyber";
}

/**
 * Runtimes this build can open. Older records may carry kinds that are not
 * served here; those get an "unavailable" page instead of the native engine.
 */
export function isSupportedRuntime(
    runtime: { kind?: string } | null | undefined
) {
    return isNativeRuntime(runtime) || isEmbeddedRuntime(runtime);
}
