import { yieldLobbyLoadingWork } from "@utils/lobbyLoadingBudget";
import { markNativeStartup } from "@utils/nativeStartupDiagnostics";
import { failLobbyDestination } from "@utils/lobbyDestinationBridge";
import { finishSpaceEntrance } from "@utils/spaceEntrance";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { isWebGLAvailable, getWebGLDiagnostics } from "@utils/webgl";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";

import WebGLNotSupported from "./WebGLNotSupported";
import { lobbyErrorMessage } from "@features/lobby/lobbyErrors";

// The real engine. next/dynamic with ssr:false only runs the import — and thus
// only boots renderer.js (which throws without WebGL) — when this component is
// actually rendered. So gating the render on a WebGL check means the engine
// never loads on unsupported devices, and the "Error creating WebGL context"
// crash can't happen.
markNativeStartup("gate-module");
const DisplayScene = dynamic(
    async () => {
        // Module evaluation creates the native renderer. Keep it out of the
        // lobby's jump animation; iframe navigation already started normally.
        // The chunks are prefetched meanwhile, so only evaluation waits.
        await yieldLobbyLoadingWork({ force: true });
        markNativeStartup("display-import-start");
        // webpackPrefetch: the browser downloads this chunk while the page
        // starts (low priority) but runs nothing; this import, after the
        // WebGL probe, evaluates it. Its own two engine chunks are preloaded
        // as soon as it is requested (three/api.js, three/states.js), so the
        // three downloads overlap instead of following one another.
        return import(/* webpackPrefetch: true */ "./DisplayScene").then(
            (module) => {
                markNativeStartup("display-import-ready");
                return module;
            },
            (error) => {
                markNativeStartup("display-import-error");
                throw error;
            }
        );
    },
    { ssr: false }
);

export default function Exhibit3DGate(props: any) {
    // null = not yet checked (SSR + first client render, to avoid a hydration
    // mismatch). The probe needs the DOM, so it runs in an effect.
    const [supported, setSupported] = useState<boolean | null>(null);

    useEffect(() => {
        markNativeStartup("gate-effect");
        const lifetime = new AbortController();
        void (async () => {
            await yieldLobbyLoadingWork({
                signal: lifetime.signal,
                force: true,
            });
            if (lifetime.signal.aborted) return;
            const ok = isWebGLAvailable();
            markNativeStartup("webgl-probe-ready");
            setSupported(ok);
            if (!ok) {
                finishSpaceEntrance();
                failLobbyDestination(
                    "This device could not start the 3D world.",
                    "webgl"
                );
                amplitude_logAnalyticsEvent(
                    "webgl_unsupported",
                    getWebGLDiagnostics()
                );
            }
        })().catch((error) => {
            if (lifetime.signal.aborted) return;
            finishSpaceEntrance();
            failLobbyDestination(
                lobbyErrorMessage(
                    error,
                    "This world couldn't start its 3D view."
                ),
                "webgl"
            );
        });
        return () => lifetime.abort();
    }, []);

    if (supported === null) return null;
    if (!supported) return <WebGLNotSupported />;

    return <DisplayScene {...props} />;
}
