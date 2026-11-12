import React, { useEffect, useRef, useState } from "react";
import { createLobbyScene } from "./createLobbyScene";
import { resolveLobbyAvatar } from "./avatarSelection";
import type { LobbySceneErrorKind, LobbySceneProps } from "./sceneTypes";

export type LobbyRendererPreference =
    | "auto"
    | "webgpu"
    | "webgl2"
    | "webgl2-modern";
type Scene = React.ComponentType<LobbySceneProps>;
const scenes = new Map<string, Promise<Scene>>();

function loadScene(mode: LobbyRendererPreference): Promise<Scene> {
    // One renderer: WebGPU, or the same WebGPURenderer on its WebGL2 backend.
    const key = mode === "auto" || mode === "webgpu" ? "webgpu" : "webgl2";
    let pending = scenes.get(key);
    if (!pending) {
        pending = import("./webgpu/backend").then(({ createWebGPUBackend }) =>
            createLobbyScene(createWebGPUBackend(key === "webgl2"))
        );
        scenes.set(key, pending);
        pending.catch(() => scenes.delete(key));
    }
    return pending;
}

/** Selects a backend without importing the gallery engine. */
export default function LobbyRenderer({
    renderer = "auto",
    ...props
}: LobbySceneProps & { renderer?: LobbyRendererPreference }) {
    const [loaded, setLoaded] = useState<{ mode: string; Scene: Scene }>(null);
    const [fallback, setFallback] = useState(false);
    const latest = useRef(props);
    latest.current = props;
    const mode = fallback ? "webgl2" : renderer;
    useEffect(() => {
        let alive = true;
        void loadScene(mode)
            .then((component) => {
                if (alive) setLoaded({ mode, Scene: component });
            })
            .catch(() => {
                if (!alive) return;
                if (renderer === "auto" && !fallback) setFallback(true);
                else
                    latest.current.onError(
                        "The 3D lobby renderer could not load. Please try entering again.",
                        "renderer"
                    );
            });
        return () => {
            alive = false;
        };
    }, [mode]);
    const onError = (message: string, kind: LobbySceneErrorKind) => {
        // Only a renderer or device failure is worth a second start on the
        // WebGL2 backend. A failed file (an avatar) would fail there too.
        if (kind === "renderer" && renderer === "auto" && !fallback)
            setFallback(true);
        else latest.current.onError(message, kind);
    };
    const Scene = loaded?.mode === mode ? loaded.Scene : null;
    return Scene ? <Scene key={mode} {...props} onError={onError} /> : null;
}

/** Warm the same VRM implementation that will be used when entering the lobby. */
export async function preloadLobbyRendererAvatar(
    identity: Parameters<
        typeof import("./webgpu/avatarAdapter").preloadLobbyAvatar
    >[0]
) {
    const source =
        typeof identity === "string"
            ? { url: identity }
            : await resolveLobbyAvatar(identity);
    const { preloadLobbyAvatar } = await import("./webgpu/avatarAdapter");
    await preloadLobbyAvatar(source.url);
}
