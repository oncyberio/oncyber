/**
 * A space's world script, where the world is: runs it once the native world
 * is showing and draws what it shows on screen (HUD lines, toasts, a
 * banner). In the space's own page it also runs the AI sidebar's requests
 * (./controller). In a framed world the sidebar and the account are the
 * page's (./PageWorldScripts), and this layer does what the page asks
 * (./runtimeRelay). Renders nothing and runs nothing unless
 * NEXT_PUBLIC_WORLD_SCRIPTS is on.
 */
import { useEffect } from "react";
import dynamic from "next/dynamic";
import styled from "styled-components";
import { worldDocument } from "@features/worlds/worldDocument";
import { baseTokens, lobbyTokens } from "@styles/tokens";
import type { HudCorner, WorldScriptRecord } from "./protocol";
import { createController } from "./controller";
import { createLocalRuntime, type WorldScriptRuntime } from "./runtime";
import { followSavedScript } from "./liveScript";
import { serveRuntime } from "./runtimeRelay";
import type { WorldStyle } from "./style";
import {
    getWorldScripts,
    offersAiSidebar,
    pageEvents,
    rememberSaved,
    resetWorldScripts,
    savedScript,
    setWorldScripts,
    setWorldScriptsController,
    useWorldScripts,
    useWorldScriptScreen,
    WORLD_SCRIPTS_ENABLED,
} from "./store";
import { useScriptAccess } from "./useScriptAccess";

const AiSidebar = dynamic(() => import("./AiSidebar"), { ssr: false });

type LayerExperience = {
    id: string;
    worldScripts?: WorldScriptRecord[];
    worldStyle?: WorldStyle;
    info?: { headline?: string };
    exhibitId?: string;
    /** Who may change its scripts: nobody else is asked about (./access). */
    owner?: string;
    editors?: string[];
};

export default function WorldScriptLayer({
    experience,
}: {
    experience: LayerExperience | null;
}) {
    if (!WORLD_SCRIPTS_ENABLED || !experience?.id) return null;
    return <Layer key={experience.id} experience={experience} />;
}

function Layer({ experience }: { experience: LayerExperience }) {
    const state = useWorldScripts();
    const shown = useWorldScriptScreen();
    // In a frame, who may change the script is the page's to ask: the
    // session is there.
    useScriptAccess(worldDocument() ? null : experience);

    useEffect(() => {
        const saved = savedScript(experience);
        setWorldScripts({
            experienceId: experience.id,
            script: saved.script,
            source: saved.source,
            style: saved.style,
        });
        const page = worldDocument();
        let runtime: WorldScriptRuntime | null = null;
        // What runs here now, whoever started it (this layer, the sidebar,
        // the page around a framed world): a save is followed from it.
        const ran = { source: saved.source };
        const tracked = (made: WorldScriptRuntime): WorldScriptRuntime => ({
            ...made,
            async run(source, mode, style) {
                const result = await made.run(source, mode, style);
                if (result.ok) ran.source = source;
                return result;
            },
            stop() {
                made.stop();
                ran.source = "";
            },
        });
        // While the space is open it follows its saved script: a push from
        // a terminal, or another editor's change, lands without a reload
        // (./liveScript.ts).
        const follow = () =>
            followSavedScript(
                experience.id,
                {
                    source: saved.source,
                    style: saved.style,
                    savedAt: Number(saved.script?.updatedAt) || 0,
                },
                runtime,
                (landed) => {
                    const script = landed.source
                        ? {
                              id: "script",
                              name: "World script",
                              enabled: true,
                              ...(getWorldScripts().script || {}),
                              source: landed.source,
                              updatedAt: landed.savedAt,
                          }
                        : null;
                    rememberSaved(
                        experience.id,
                        script ? [script] : [],
                        landed.style
                    );
                    setWorldScripts({
                        script,
                        source: landed.source,
                        ...(landed.style ? { style: landed.style } : {}),
                    });
                },
                undefined,
                () => ran.source
            );
        if (page) {
            // The page drives this world's runtime and hears what it says.
            const served = serveRuntime(
                experience.id,
                page,
                () => runtime,
                (open) => setWorldScripts({ panelOpen: open })
            );
            runtime = tracked(
                createLocalRuntime(saved, {
                    ...served.events,
                    onStatus(status) {
                        setWorldScripts({ status });
                        served.events.onStatus(status);
                    },
                })
            );
            const unfollow = follow();
            return () => {
                unfollow();
                served.dispose();
                runtime?.dispose();
                resetWorldScripts();
            };
        }
        runtime = tracked(createLocalRuntime(saved, pageEvents()));
        const unfollow = follow();
        const controller = createController(experience, runtime);
        setWorldScriptsController(controller);
        // For trying scripts from the console while developing.
        if (process.env.NODE_ENV === "development")
            (window as any).oncyberWorldScripts = controller;
        return () => {
            unfollow();
            controller.dispose();
            setWorldScriptsController(null);
            runtime?.dispose();
            resetWorldScripts();
        };
    }, [experience.id]);

    const corners: HudCorner[] = ["top", "top-left", "top-right", "bottom"];
    const hud = Object.entries(shown.hud);
    const sidebar =
        state.panelOpen && offersAiSidebar(state) && !worldDocument() ? (
            <AiSidebar />
        ) : null;
    if (!hud.length && !shown.toasts.length && !shown.banner) return sidebar;
    return (
        <>
            {sidebar}
            <Overlay aria-live="polite">
                {corners.map((corner) => {
                    const lines = hud.filter(
                        ([, line]) => line.corner === corner
                    );
                    if (!lines.length) return null;
                    return (
                        <Corner key={corner} data-corner={corner}>
                            {lines.map(([key, line]) => (
                                <HudLine key={key}>{line.text}</HudLine>
                            ))}
                        </Corner>
                    );
                })}
                {shown.banner && <Banner>{shown.banner.text}</Banner>}
                {shown.toasts.length > 0 && (
                    <Toasts>
                        {shown.toasts.map((toast) => (
                            <Toast key={toast.id}>{toast.text}</Toast>
                        ))}
                    </Toasts>
                )}
            </Overlay>
        </>
    );
}

const Overlay = styled.div`
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 900;
    font-family: ${baseTokens.font.sans};
    color: ${lobbyTokens.color.ink};
    text-shadow: ${lobbyTokens.glass.textShadow};
`;

const Corner = styled.div`
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-width: min(420px, calc(100vw - 32px));
    &[data-corner="top"] {
        top: 76px;
        left: 50%;
        transform: translateX(-50%);
        align-items: center;
        text-align: center;
    }
    /* The movement hint sits where the top line does until it is dismissed. */
    body:has(.interaction-helper) &[data-corner="top"] {
        top: 128px;
    }
    &[data-corner="top-left"] {
        top: 76px;
        left: 16px;
    }
    &[data-corner="top-right"] {
        top: 76px;
        right: 16px;
        align-items: flex-end;
        text-align: right;
    }
    &[data-corner="bottom"] {
        bottom: 104px;
        left: 50%;
        transform: translateX(-50%);
        align-items: center;
        text-align: center;
    }
`;

const HudLine = styled.div`
    padding: 6px 12px;
    border-radius: ${baseTokens.radius.control}px;
    background: ${lobbyTokens.glass.tint};
    border: 1px solid ${baseTokens.color.line.subtle};
    font-size: ${baseTokens.font.size.body}px;
    font-weight: ${baseTokens.font.weight.medium};
    white-space: pre-wrap;
`;

const Banner = styled.div`
    position: absolute;
    top: 38%;
    left: 50%;
    transform: translate(-50%, -50%);
    max-width: calc(100vw - 32px);
    font-size: clamp(32px, 7vw, 72px);
    font-weight: ${baseTokens.font.weight.bold};
    letter-spacing: -0.02em;
    text-align: center;
    text-shadow: ${lobbyTokens.speech.textShadow};
`;

const Toasts = styled.div`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, 40px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
`;

const Toast = styled(HudLine)``;
