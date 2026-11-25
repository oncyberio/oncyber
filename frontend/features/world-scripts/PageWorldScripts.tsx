/**
 * World scripts on the page around a framed world: who may change the
 * space's script, the AI sidebar and its requests to the model, and the
 * save. All of that needs the account, which the page holds and the world
 * never does. The script itself runs in the world; this reaches it through
 * messages (./runtimeRelay).
 */
import { useEffect, type MutableRefObject } from "react";
import dynamic from "next/dynamic";
import { createController } from "./controller";
import { createRemoteRuntime, type RemoteRuntime } from "./runtimeRelay";
import type { WorldScriptRecord } from "./protocol";
import type { WorldStyle } from "./style";
import {
    offersAiSidebar,
    pageEvents,
    resetWorldScripts,
    savedScript,
    setWorldScripts,
    setWorldScriptsController,
    useWorldScripts,
} from "./store";
import { useScriptAccess } from "./useScriptAccess";

const AiSidebar = dynamic(() => import("./AiSidebar"), { ssr: false });

export interface PageScriptSpace {
    id: string;
    worldScripts?: WorldScriptRecord[];
    worldStyle?: WorldStyle;
    info?: { headline?: string };
    exhibitId?: string;
}

export default function PageWorldScripts({
    space,
    send,
    heard,
}: {
    space: PageScriptSpace;
    /** One message to the world in the frame. */
    send(kind: string, data: object): void;
    /** Set here: where the frame's `script-` messages go. */
    heard: MutableRefObject<RemoteRuntime | null>;
}) {
    const state = useWorldScripts();
    useScriptAccess(space.id);

    useEffect(() => {
        const saved = savedScript(space);
        setWorldScripts({
            experienceId: space.id,
            script: saved.script,
            source: saved.source,
            style: saved.style,
        });
        const runtime = createRemoteRuntime(space.id, send, pageEvents());
        heard.current = runtime;
        const controller = createController(space, runtime);
        setWorldScriptsController(controller);
        return () => {
            heard.current = null;
            controller.dispose();
            setWorldScriptsController(null);
            runtime.dispose();
            resetWorldScripts();
        };
    }, [space.id]);

    // The world closes what would sit under the sidebar.
    const open = state.panelOpen && offersAiSidebar(state);
    useEffect(() => {
        send("script-panel", { space: space.id, open });
    }, [open, space.id]);

    return open ? <AiSidebar /> : null;
}
