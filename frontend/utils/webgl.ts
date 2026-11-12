// Main-thread WebGL capability probe. The 3D engine creates a WebGLRenderer at
// module-load time (components/_3DExhibit-v2/three/renderer.js), which THROWS
// "Error creating WebGL context" on devices/browsers without a usable WebGL
// context (low-end Android, Linux GPU driver blocklists, hardware-accel off,
// in-app webviews). That throw white-screens the page. We probe here BEFORE the
// engine module is imported so we can show a graceful fallback instead.

export function isWebGLAvailable(): boolean {
    if (typeof window === "undefined" || typeof document === "undefined") {
        // SSR — assume available; the client re-checks before booting the engine.
        return true;
    }

    try {
        const canvas = document.createElement("canvas");
        const gl =
            canvas.getContext("webgl2") ||
            canvas.getContext("webgl") ||
            (canvas.getContext("experimental-webgl") as unknown as
                | WebGLRenderingContext
                | null);

        return !!gl;
    } catch {
        return false;
    }
}

// Context for the `webgl_unsupported` analytics event — which WebGL versions are
// missing, and (when any context can be made) the GPU/driver strings, so we can
// see the device clusters behind the failures.
export function getWebGLDiagnostics(): Record<string, any> {
    const out: Record<string, any> = {
        webgl2: false,
        webgl1: false,
        renderer: null,
        vendor: null,
    };

    if (typeof document === "undefined") return out;

    try {
        const canvas = document.createElement("canvas");
        const gl2 = canvas.getContext("webgl2");
        out.webgl2 = !!gl2;

        const gl = (gl2 ||
            canvas.getContext("webgl") ||
            canvas.getContext(
                "experimental-webgl"
            )) as WebGLRenderingContext | null;

        out.webgl1 = !!gl;

        if (gl) {
            const dbg = gl.getExtension("WEBGL_debug_renderer_info");
            if (dbg) {
                out.renderer = gl.getParameter(
                    (dbg as any).UNMASKED_RENDERER_WEBGL
                );
                out.vendor = gl.getParameter(
                    (dbg as any).UNMASKED_VENDOR_WEBGL
                );
            }
        }
    } catch (e) {
        out.error = String(e);
    }

    return out;
}
