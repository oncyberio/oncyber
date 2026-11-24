/**
 * Runs a space's world script once the native world is showing, draws what
 * the script shows on screen (HUD lines, toasts, a banner), and gives the
 * chat's `/ai` and the studio panel their actions. Renders nothing and runs
 * nothing unless NEXT_PUBLIC_WORLD_SCRIPTS is on.
 */
import { useContext, useEffect, useRef } from "react";
import styled from "styled-components";
import { UserContext } from "@components/context/UserContext";
import WorldScriptsApi from "@api/worldScripts/_api";
import { baseTokens, lobbyTokens } from "@styles/tokens";
import type { HudCorner, WorldScriptRecord } from "./protocol";
import { WORLD_SCRIPT_LIMITS, byteLength } from "./protocol";
import type { SwapMode } from "./host";
import {
    addGameLine,
    addLog,
    getWorldScripts,
    resetWorldScripts,
    setWorldScripts,
    setWorldScriptsController,
    useWorldScripts,
    WORLD_SCRIPTS_ENABLED,
} from "./store";

const READY_POLL_MS = 400;
const READY_GIVE_UP_MS = 120_000;

function newId() {
    return Math.random().toString(36).slice(2, 10);
}

export default function WorldScriptLayer({
    experience,
}: {
    experience: { id: string; worldScripts?: WorldScriptRecord[] } | null;
}) {
    if (!WORLD_SCRIPTS_ENABLED || !experience?.id) return null;
    return <Layer key={experience.id} experience={experience} />;
}

function Layer({
    experience,
}: {
    experience: { id: string; worldScripts?: WorldScriptRecord[] };
}) {
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
            const [{ createEngineSink, engineReady }, { WorldScriptHost }] =
                await Promise.all([
                    import("./engineAdapter"),
                    import("./host"),
                ]);
            const startedAt = Date.now();
            while (!disposed && !engineReady()) {
                if (Date.now() - startedAt > READY_GIVE_UP_MS) return;
                await new Promise((resolve) =>
                    setTimeout(resolve, READY_POLL_MS)
                );
            }
            if (disposed) return;
            engine = createEngineSink(ui);
            const container = document.body;
            host = new WorldScriptHost(container, engine.sink, {
                onStatus: (status) => setWorldScripts({ status }),
                onLog: addLog,
            });
            engine.bind({
                frame: (dt) => host?.frame(dt),
                key: (down, key, code) => host?.key(down, key, code),
                click: (hit) => host?.click(hit),
            });
            if (saved?.source) {
                setWorldScripts({ source: saved.source });
                const result = await host.start(saved.source);
                if (!result.ok)
                    addGameLine(
                        `The world's script didn't start: ${result.reason}`,
                        "error"
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
                addGameLine(
                    `Couldn't save the script: ${result?.error || "try again"}`,
                    "error"
                );
                return false;
            }
            setWorldScripts({ script: result.scripts[0] || null });
            return true;
        }

        async function ask(request: string) {
            const current = getWorldScripts();
            if (!request) {
                addGameLine(
                    "Say what to make after /ai, for example: /ai a coin hunt with a 60 second timer"
                );
                return;
            }
            if (!current.canEdit) {
                addGameLine(
                    "Only this space's owner and editors can change its game."
                );
                return;
            }
            if (!current.canAsk) {
                addGameLine(
                    current.askReason || "AI scripts are invite-only for now."
                );
                return;
            }
            if (current.busy) {
                addGameLine("Still working on the last request.");
                return;
            }
            if (!host) {
                addGameLine(
                    "The world is still loading. Try again in a moment."
                );
                return;
            }
            setWorldScripts({ busy: true });
            addGameLine("Working on it…");
            try {
                const answer: any = await WorldScriptsApi.opts({
                    timeout: 70_000,
                })
                    .generate({
                        experienceId: experience.id,
                        request,
                        currentSource: current.source || undefined,
                        artworks: engine?.sink
                            .artworks()
                            .slice(0, 200)
                            .map(({ id, name }) => ({
                                id: id.slice(0, 200),
                                name: name.slice(0, 120),
                            })),
                    })
                    .catch((error) => ({ ok: false, error: error.message }));
                if (!answer?.ok) {
                    addGameLine(
                        answer?.error || "That didn't work. Try again.",
                        "error"
                    );
                    return;
                }
                if (answer.remaining != null)
                    setWorldScripts({ remaining: answer.remaining });
                const mode: SwapMode =
                    answer.change === "content" && current.source
                        ? "keep"
                        : "fresh";
                const previous = current.source;
                const result = host.running
                    ? await host.swap(answer.source, mode)
                    : await host.start(answer.source);
                if (!result.ok) {
                    addGameLine(
                        `That change didn't run, so the game stayed as it was. (${result.reason
                            .split("\n")[0]
                            .slice(0, 160)})`,
                        "error"
                    );
                    return;
                }
                if (previous)
                    history.current = [...history.current, previous].slice(-10);
                setWorldScripts({ source: answer.source });
                addGameLine(
                    `${answer.say} ${
                        !previous
                            ? ""
                            : mode === "keep"
                            ? "(The game kept going.)"
                            : "(Rewound to the start.)"
                    }`.trim()
                );
                await save({
                    source: answer.source,
                    name: answer.name,
                    prompt: request,
                    enabled: true,
                });
            } finally {
                setWorldScripts({ busy: false });
            }
        }

        async function undo() {
            const previous = history.current.pop();
            if (!previous || !host) {
                addGameLine("There's no earlier version to go back to.");
                return;
            }
            const ok = await run(previous, "fresh");
            if (ok) {
                addGameLine(
                    "Back to the previous version. (Rewound to the start.)"
                );
                await save({ source: previous });
            }
        }

        setWorldScriptsController({
            ask,
            run,
            save,
            undo,
            restart: () => void host?.restart(),
            stop: () => {
                host?.stop();
                setWorldScripts({ source: "" });
            },
        });
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
    if (!hud.length && !state.toasts.length && !state.banner) return null;
    return (
        <Overlay aria-live="polite">
            {corners.map((corner) => {
                const lines = hud.filter(([, line]) => line.corner === corner);
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
