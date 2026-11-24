/**
 * Runs a space's world script once the native world is showing, draws what
 * the script shows on screen (HUD lines, toasts, a banner), and runs the
 * AI sidebar's requests: write, try out of sight, fix what fails, swap in
 * live. Renders nothing and runs nothing unless NEXT_PUBLIC_WORLD_SCRIPTS
 * is on.
 */
import { useContext, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import styled from "styled-components";
import { UserContext } from "@components/context/UserContext";
import WorldScriptsApi from "@api/worldScripts/_api";
import { baseTokens, lobbyTokens } from "@styles/tokens";
import type { HudCorner, WorldScriptRecord } from "./protocol";
import { WORLD_SCRIPT_LIMITS, byteLength } from "./protocol";
import type { SwapMode } from "./host";
import { cleanStyle, NEUTRAL_STYLE, WorldStyle } from "./style";
import {
    addLog,
    say,
    updateEntry,
    getWorldScripts,
    resetWorldScripts,
    setWorldScripts,
    setWorldScriptsController,
    useWorldScripts,
    WORLD_SCRIPTS_ENABLED,
} from "./store";

const AiSidebar = dynamic(() => import("./AiSidebar"), { ssr: false });

/** How many times the model may fix a script that did not run. */
const MAX_ATTEMPTS = 3;
const READY_POLL_MS = 400;
const READY_GIVE_UP_MS = 120_000;

type LayerExperience = {
    id: string;
    worldScripts?: WorldScriptRecord[];
    worldStyle?: WorldStyle;
    info?: { headline?: string };
    exhibitId?: string;
};

const firstLine = (text = "") => text.split("\n")[0].slice(0, 200);

function newId() {
    return Math.random().toString(36).slice(2, 10);
}

export default function WorldScriptLayer({
    experience,
}: {
    experience: LayerExperience | null;
}) {
    if (!WORLD_SCRIPTS_ENABLED || !experience?.id) return null;
    return <Layer key={experience.id} experience={experience} />;
}

function Layer({ experience }: { experience: LayerExperience }) {
    const { user, isAnonymous } = useContext(UserContext);
    const state = useWorldScripts();
    const history = useRef<string[]>([]);

    // Who may change the script, and whether the model is open to them.
    useEffect(() => {
        if (!user?.id || isAnonymous) return;
        let cancelled = false;
        WorldScriptsApi.access({ experienceId: experience.id })
            .then((access: any) => {
                if (cancelled) return;
                setWorldScripts({
                    canEdit: !!access?.canEdit,
                    canAsk: !!access?.allowed,
                    askReason: access?.reason || "",
                    remaining: access?.remaining ?? null,
                });
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [user?.id, isAnonymous, experience.id]);

    useEffect(() => {
        const saved =
            (experience.worldScripts || []).find((script) => script.enabled) ||
            null;
        setWorldScripts({
            experienceId: experience.id,
            script: experience.worldScripts?.[0] || null,
            source: "",
            style: cleanStyle(experience.worldStyle),
        });

        let disposed = false;
        let host: import("./host").WorldScriptHost | null = null;
        let engine: ReturnType<
            typeof import("./engineAdapter").createEngineSink
        > | null = null;
        const toastTimers = new Set<ReturnType<typeof setTimeout>>();

        const ui = {
            hud(key: string, text: string | null, corner: HudCorner) {
                setWorldScripts((current) => {
                    const hud = { ...current.hud };
                    if (text == null) delete hud[key];
                    else if (
                        hud[key] ||
                        Object.keys(hud).length <
                            WORLD_SCRIPT_LIMITS.maxHudLines
                    )
                        hud[key] = { text, corner };
                    return { hud };
                });
            },
            clearHud() {
                setWorldScripts({ hud: {} });
            },
            toast(text: string, seconds: number) {
                const id = Date.now() + Math.random();
                setWorldScripts((current) => ({
                    toasts: [
                        ...current.toasts,
                        { id, text, until: Date.now() + seconds * 1000 },
                    ].slice(-3),
                }));
                const timer = setTimeout(() => {
                    toastTimers.delete(timer);
                    setWorldScripts((current) => ({
                        toasts: current.toasts.filter(
                            (toast) => toast.id !== id
                        ),
                    }));
                }, seconds * 1000);
                toastTimers.add(timer);
            },
            banner(text: string | null, seconds: number) {
                if (text == null) return setWorldScripts({ banner: null });
                const until = Date.now() + seconds * 1000;
                setWorldScripts({ banner: { text, until } });
                const timer = setTimeout(() => {
                    toastTimers.delete(timer);
                    if (getWorldScripts().banner?.until === until)
                        setWorldScripts({ banner: null });
                }, seconds * 1000);
                toastTimers.add(timer);
            },
        };

        async function boot() {
            const startedAt = Date.now();
            // The engine's modules load the engine's own way first: importing
            // them before the world exists evaluates them in another order.
            while (!disposed && !(window as any).scene) {
                if (Date.now() - startedAt > READY_GIVE_UP_MS) return;
                await new Promise((resolve) =>
                    setTimeout(resolve, READY_POLL_MS)
                );
            }
            if (disposed) return;
            const [{ createEngineSink, engineReady }, { WorldScriptHost }] =
                await Promise.all([
                    import("./engineAdapter"),
                    import("./host"),
                ]);
            while (!disposed && !engineReady()) {
                if (process.env.NODE_ENV === "development")
                    (window as any).oncyberWorldScriptsWaiting = Date.now();
                if (Date.now() - startedAt > READY_GIVE_UP_MS) return;
                await new Promise((resolve) =>
                    setTimeout(resolve, READY_POLL_MS)
                );
            }
            if (disposed) return;
            engine = createEngineSink(ui, getWorldScripts().style || undefined);
            const container = document.body;
            host = new WorldScriptHost(container, engine.sink, {
                onStatus: (status) => setWorldScripts({ status }),
                onLog: addLog,
            });
            // A world with no style of its own still hands scripts a palette.
            host.style = getWorldScripts().style || NEUTRAL_STYLE;
            engine.bind({
                frame: (dt) => host?.frame(dt),
                key: (down, key, code) => host?.key(down, key, code),
                click: (hit) => host?.click(hit),
            });
            if (saved?.source) {
                setWorldScripts({ source: saved.source });
                const result = await host.start(saved.source);
                if (!result.ok)
                    say(
                        "error",
                        `The world's script didn't start: ${firstLine(
                            result.reason
                        )}`
                    );
            }
        }

        async function run(source: string, mode: SwapMode = "fresh") {
            if (!host) return false;
            const result = host.running
                ? await host.swap(source, mode)
                : await host.start(source);
            if (result.ok) setWorldScripts({ source });
            return result.ok;
        }

        async function save(patch: Partial<WorldScriptRecord>) {
            const current = getWorldScripts();
            const script: WorldScriptRecord = {
                id: current.script?.id || newId(),
                name: current.script?.name || "World script",
                enabled: true,
                source: current.source,
                ...(current.script || {}),
                ...patch,
            };
            delete (script as any).updatedAt;
            if (byteLength(script.source) > WORLD_SCRIPT_LIMITS.maxSourceBytes)
                return false;
            const result: any = await WorldScriptsApi.save({
                experienceId: experience.id,
                scripts: script.source ? [script] : [],
            }).catch((error) => ({ ok: false, error: error.message }));
            if (!result?.ok) {
                say(
                    "error",
                    `Couldn't save the script: ${result?.error || "try again"}`
                );
                return false;
            }
            setWorldScripts({ script: result.scripts[0] || null });
            return true;
        }

        /** Draws everything in the new style and keeps it with the space. */
        async function setStyle(style: WorldStyle) {
            setWorldScripts({ style });
            if (host) host.style = style;
            engine?.setStyle(style);
            const result: any = await WorldScriptsApi.save({
                experienceId: experience.id,
                style: style as any,
            }).catch((error) => ({ ok: false, error: error.message }));
            if (!result?.ok)
                say(
                    "error",
                    `Couldn't save the style: ${result?.error || "try again"}`
                );
        }

        /**
         * One request from the sidebar. The model writes; the new version
         * runs out of sight; if it fails the model gets the error and tries
         * again; what works is swapped into the running world and saved.
         */
        async function ask(request: string) {
            const current = getWorldScripts();
            request = request.trim();
            if (!request || current.busy) return;
            say("you", request);
            // Said in a word, done without the model.
            const word = request.toLowerCase().replace(/[.!\s]+$/, "");
            if (word === "undo") return undo();
            if (word === "restart" || word === "start")
                return controller.restart();
            if (word === "stop") return controller.stop();
            const refuse = !current.canEdit
                ? "Only this space's admins can change its scripts."
                : !current.canAsk
                ? current.askReason || "AI scripts are invite-only for now."
                : !host
                ? "The world is still loading. Try again in a moment."
                : "";
            if (refuse) {
                say("error", refuse);
                return;
            }
            setWorldScripts({ busy: true });
            const previous = current.source;
            let failure: { source: string; reason: string } | undefined;
            try {
                for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                    const writing = say(
                        "step",
                        attempt > 1
                            ? `Fixing it (try ${attempt} of ${MAX_ATTEMPTS})`
                            : previous
                            ? "Writing the change"
                            : "Writing the script",
                        "running"
                    );
                    const colors = engine?.colors() || {};
                    const answer: any = await WorldScriptsApi.opts({
                        timeout: 70_000,
                    })
                        .generate({
                            experienceId: experience.id,
                            request,
                            currentSource: previous || undefined,
                            style:
                                (getWorldScripts().style as any) || undefined,
                            world: {
                                title: experience.info?.headline?.slice(0, 200),
                                place: experience.exhibitId?.slice(0, 200),
                                ...colors,
                            },
                            failure,
                            artworks: engine?.sink
                                .artworks()
                                .slice(0, 200)
                                .map(({ id, name }) => ({
                                    id: id.slice(0, 200),
                                    name: name.slice(0, 120),
                                })),
                        })
                        .catch((error) => ({
                            ok: false,
                            error: error.message,
                        }));
                    if (!answer?.ok) {
                        updateEntry(writing, { state: "failed" });
                        say(
                            "error",
                            answer?.error || "That didn't work. Try again."
                        );
                        return;
                    }
                    updateEntry(writing, {
                        state: "done",
                        text: `Wrote “${answer.name}” (${
                            answer.source.split("\n").length
                        } lines)`,
                    });
                    if (answer.remaining != null)
                        setWorldScripts({ remaining: answer.remaining });
                    const style = cleanStyle(answer.style);
                    if (style) {
                        say(
                            "step",
                            getWorldScripts().style
                                ? "Changed the world's style"
                                : "Picked a style from this world",
                            "done"
                        );
                        await setStyle(style);
                    }
                    const mode: SwapMode =
                        answer.change === "content" && previous
                            ? "keep"
                            : "fresh";
                    const trying = say(
                        "step",
                        "Trying it out of sight",
                        "running"
                    );
                    const result = host.running
                        ? await host.swap(answer.source, mode)
                        : await host.start(answer.source);
                    if (!result.ok) {
                        updateEntry(trying, {
                            state: "failed",
                            text: `It didn't run: ${firstLine(result.reason)}`,
                        });
                        failure = {
                            source: answer.source,
                            reason: String(result.reason || "").slice(0, 4000),
                        };
                        continue;
                    }
                    updateEntry(trying, {
                        state: "done",
                        text: !previous
                            ? "Started it in the world"
                            : mode === "keep"
                            ? "Swapped it in. The game kept going"
                            : "Swapped it in and rewound to the start",
                    });
                    if (previous)
                        history.current = [...history.current, previous].slice(
                            -10
                        );
                    setWorldScripts({ source: answer.source });
                    say("say", answer.say);
                    await save({
                        source: answer.source,
                        name: answer.name,
                        prompt: request,
                        enabled: true,
                    });
                    return;
                }
                say(
                    "error",
                    `That didn't run after ${MAX_ATTEMPTS} tries, so the world stayed as it was. Try asking in a different way.`
                );
            } finally {
                setWorldScripts({ busy: false });
            }
        }

        async function undo() {
            const previous = history.current.pop();
            if (!previous || !host) {
                say("say", "There's no earlier version to go back to.");
                return;
            }
            const ok = await run(previous, "fresh");
            if (ok) {
                say(
                    "step",
                    "Back to the previous version, from the start",
                    "done"
                );
                await save({ source: previous });
            }
        }

        const controller = {
            ask,
            run,
            save,
            undo,
            setStyle,
            restart: () => {
                const { source } = getWorldScripts();
                if (!host || !source) {
                    say("say", "There's no script to start yet.");
                    return;
                }
                if (host.running) void host.restart();
                else void host.start(source);
                say("step", "Started again from the beginning", "done");
            },
            // Stops it for this visit; the saved script is untouched.
            stop: () => {
                host?.stop();
                say("step", "Stopped the script", "done");
            },
        };
        setWorldScriptsController(controller);
        // For trying scripts from the console while developing.
        if (process.env.NODE_ENV === "development")
            (window as any).oncyberWorldScripts = controller;
        void boot();

        return () => {
            disposed = true;
            setWorldScriptsController(null);
            toastTimers.forEach(clearTimeout);
            host?.dispose();
            engine?.dispose();
            resetWorldScripts();
        };
    }, [experience.id]);

    const corners: HudCorner[] = ["top", "top-left", "top-right", "bottom"];
    const hud = Object.entries(state.hud);
    const sidebar = state.panelOpen && state.canEdit ? <AiSidebar /> : null;
    if (!hud.length && !state.toasts.length && !state.banner) return sidebar;
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
                {state.banner && <Banner>{state.banner.text}</Banner>}
                {state.toasts.length > 0 && (
                    <Toasts>
                        {state.toasts.map((toast) => (
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
