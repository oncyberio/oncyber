import { RuntimeSession, compactJSON, runScenario, type Scenario, type GameFactory, type RuntimeOptions, type Json } from "./index.ts";

/** UI is an opaque-origin sandbox. This channel does not carry host chat, credentials or permissions. */
export function browserUI(frame: HTMLIFrameElement, session: () => RuntimeSession | undefined) {
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("referrerpolicy", "no-referrer");
    frame.setAttribute("allow", "");
    const channel = crypto.randomUUID();
    let connected = false, disposed = false;
    const waiting = new Set<(error?: Error) => void>();
    const hello = () => frame.contentWindow?.postMessage({ type: "oncyber:ui-init", channel }, "*");
    const receive = (event: MessageEvent) => {
        if (event.source !== frame.contentWindow || event.data?.channel !== channel) return;
        if (event.data?.type === "oncyber:ui-ready") {
            connected = true;
            for (const resolve of [...waiting]) resolve();
            return;
        }
        if (!["oncyber:action", "oncyber:delta"].includes(event.data?.type)) return;
        try {
            const message = compactJSON(event.data, 2048) as any;
            if (message.type === "oncyber:delta") session()?.delta(message.action, message.value);
            else session()?.action(message.action, message.value ?? 1);
        } catch { /* Malformed or undeclared actions cannot reach gameplay. */ }
    };
    frame.addEventListener("load", hello);
    window.addEventListener("message", receive);
    return {
        ready(timeoutMs = 10000): Promise<void> {
            if (disposed) return Promise.reject(new Error("UI_BRIDGE_DISPOSED"));
            if (connected) return Promise.resolve();
            return new Promise((resolve, reject) => {
                const finish = (error?: Error) => {
                    clearTimeout(timer); waiting.delete(finish);
                    if (error) reject(error); else resolve();
                };
                const timer = setTimeout(() => finish(new Error("UI_BRIDGE_NOT_READY")), timeoutMs);
                waiting.add(finish);
                // Also handles an already loaded frame attached before the host adapter.
                hello();
            });
        },
        publish(value: Json) { frame.contentWindow?.postMessage({ type: "oncyber:state", channel, value: compactJSON(value) }, "*"); },
        dispose() {
            disposed = true;
            for (const reject of [...waiting]) reject(new Error("UI_BRIDGE_DISPOSED"));
            window.removeEventListener("message", receive); frame.removeEventListener("load", hello);
        },
    };
}
/** Small UI-side client, also usable with a WebView's separately supplied transport. */
export function connectUI(onState: (value: Json) => void) {
    let channel: string | undefined;
    const native = (window as any).ReactNativeWebView;
    const send = (message: object) => {
        if (native) native.postMessage(JSON.stringify(message)); else parent.postMessage(message, "*");
    };
    const receive = (event: MessageEvent) => {
        if (!native && event.source !== parent) return;
        let message;
        try { message = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
        if (message?.type === "oncyber:ui-init" && typeof message.channel === "string") {
            channel = message.channel;
            send({ type: "oncyber:ui-ready", channel });
        }
        if (channel && message?.channel === channel && message?.type === "oncyber:state") onState(compactJSON(message.value));
    };
    window.addEventListener("message", receive);
    if (native) document.addEventListener("message", receive as EventListener);
    return {
        delta(action: string, value: number) { if (channel) send({ type: "oncyber:delta", channel, action, value }); },
        action(action: string, value = 1) { if (channel) {
            const message = { type: "oncyber:action", channel, action, value };
            send(message);
        } },
        dispose() { window.removeEventListener("message", receive); document.removeEventListener("message", receive as EventListener); },
    };
}
export function bindBrowserInput(session: RuntimeSession, manifest: RuntimeOptions["manifest"]) {
    const keys = new Map<string, string[]>();
    for (const [action, binding] of Object.entries(manifest.input)) for (const key of binding.keyboard ?? [])
        keys.set(key, [...(keys.get(key) ?? []), action]);
    const key = (event: KeyboardEvent) => {
        if (event.target instanceof HTMLElement && (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))) return;
        const actions = keys.get(event.code);
        if (!actions?.length || session.phase !== "entered") return;
        event.preventDefault();
        for (const action of actions) session.action(action, event.type === "keydown" ? 1 : 0);
    };
    const blur = () => session.clearInput();
    window.addEventListener("keydown", key); window.addEventListener("keyup", key); window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("keyup", key); window.removeEventListener("blur", blur); };
}
/** Browser adapter requests WebGPU explicitly; WebGL fallback is not a portable qualification. */
export async function createBrowserSession(factory: GameFactory, options: Omit<RuntimeOptions, "graphics" | "sendUI"> & {
    canvas: HTMLCanvasElement; ui: HTMLIFrameElement; onError(error: Error): void;
}) {
    const gpu = (navigator as any).gpu;
    if (!gpu) throw new Error("WEBGPU_UNAVAILABLE");
    const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) throw new Error("WEBGPU_ADAPTER_UNAVAILABLE");
    const device = await adapter.requestDevice();
    let session: RuntimeSession | undefined, alive = true, validating = false, held = false, frameId = 0, last = performance.now();
    const bridge = browserUI(options.ui, () => validating ? undefined : session);
    const graphicsErrors: string[] = [];
    const graphics = { canvas: options.canvas, device, context: options.canvas.getContext("webgpu" as any),
        width: options.canvas.clientWidth, height: options.canvas.clientHeight, pixelRatio: Math.min(devicePixelRatio, 2),
        decodeImage: (bytes: ArrayBuffer, mimeType: string) =>
            createImageBitmap(new Blob([bytes], { type: mimeType }), { premultiplyAlpha: "none", colorSpaceConversion: "none" }) };
    session = new RuntimeSession(factory, { ...options, graphics, sendUI: bridge.publish, now: () => performance.now() });
    const inputCleanup = bindBrowserInput(session, options.manifest);
    const error = (reason: any) => {
        if (!alive) return;
        const message = reason?.error?.message ?? reason?.message ?? "GPU_DEVICE_LOST";
        graphicsErrors.push(message); options.onError(new Error(message));
    };
    device.addEventListener("uncapturederror", error);
    void device.lost.then(error);
    const frame = (now: number) => {
        if (!alive) return;
        graphics.width = options.canvas.clientWidth; graphics.height = options.canvas.clientHeight;
        if (!validating && !held) try { session!.tick((now - last) / 1000); } catch (e) { error(e); }
        last = now; frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    const visibility = () => {
        last = performance.now();
        const operation = document.hidden && session!.phase === "entered" ? session!.suspend() :
            !document.hidden && session!.phase === "suspended" ? session!.restore() : undefined;
        operation?.catch(error);
    };
    document.addEventListener("visibilitychange", visibility);
    return { session, device, graphics,
        /** Stops the host clock, for checks that tick the session themselves. */
        hold(paused: boolean) { held = paused; last = performance.now(); },
        async validate(scenario: Scenario) {
            if (validating || !alive) throw new Error("VALIDATION_UNAVAILABLE");
            validating = true;
            try {
                await bridge.ready();
                await runScenario(session!, scenario, () => new Promise<void>((resolve, reject) =>
                    requestAnimationFrame(() => alive ? resolve() : reject(new Error("VALIDATION_CANCELLED")))));
                await device.queue.onSubmittedWorkDone();
                if (graphicsErrors.length) throw new Error(graphicsErrors.join("; "));
                return session!.inspect();
            } finally { validating = false; last = performance.now(); }
        },
        async dispose() {
            alive = false; cancelAnimationFrame(frameId); inputCleanup(); bridge.dispose();
            document.removeEventListener("visibilitychange", visibility); device.removeEventListener("uncapturederror", error);
            try { await session!.dispose(); } finally { device.destroy(); }
        },
    };
}
