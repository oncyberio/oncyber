/**
 * The studio's Scripts panel: ask the AI for a change, read and edit the
 * script, and run, rewind, undo or save it. Every change lands live in the
 * world on show (WorldScriptLayer), with no reload.
 */
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { studioTokens as studio } from "@styles/tokens";
import {
    studioAction,
    studioField,
    studioHeading,
    studioPanel,
} from "@features/studio/styles/primitives";
import { NButton } from "@features/studio/components/StudioButton";
import { useWorldScripts, worldScriptsController } from "./store";

export default function ScriptsPanel({ onClose }: { onClose?: () => void }) {
    const state = useWorldScripts();
    const [request, setRequest] = useState("");
    const [draft, setDraft] = useState(state.source);
    const edited = draft !== state.source;
    const logEnd = useRef<HTMLDivElement>(null);
    const controller = worldScriptsController();

    // A change from the AI (or /ai in the chat) replaces the draft unless
    // the creator is editing it by hand.
    const lastSource = useRef(state.source);
    useEffect(() => {
        if (draft === lastSource.current) setDraft(state.source);
        lastSource.current = state.source;
    }, [state.source]);

    useEffect(() => {
        logEnd.current?.scrollIntoView({ block: "nearest" });
    }, [state.lines.length, state.logs.length]);

    const running = state.status.state === "running";
    const ask = async () => {
        const text = request.trim();
        if (!text || !controller) return;
        setRequest("");
        await controller.ask(text);
    };

    const recent = [
        ...state.lines.map((line) => ({
            at: line.sentAt,
            level: line.tone === "error" ? "error" : "game",
            text: line.text,
        })),
        ...state.logs.map((log) => ({
            at: log.at,
            level: log.level,
            text: log.text,
        })),
    ]
        .sort((a, b) => a.at - b.at)
        .slice(-40);

    return (
        <Panel
            role="dialog"
            aria-label="World scripts"
            onKeyDown={(event) => event.stopPropagation()}
            onKeyUp={(event) => event.stopPropagation()}
        >
            <Header>
                <h2>Scripts</h2>
                <Status data-state={state.status.state}>
                    {running
                        ? "Running"
                        : state.status.state === "starting"
                        ? "Starting"
                        : state.status.state === "stopped"
                        ? "Stopped"
                        : "Not running"}
                </Status>
                {onClose && (
                    <Close type="button" aria-label="Close" onClick={onClose}>
                        ×
                    </Close>
                )}
            </Header>

            {!state.canEdit ? (
                <Note>
                    Only this world's owner and editors can change its scripts.
                </Note>
            ) : (
                <>
                    <Ask
                        onSubmit={(event) => {
                            event.preventDefault();
                            void ask();
                        }}
                    >
                        <label htmlFor="world-script-request">
                            Describe a game or a change
                        </label>
                        <textarea
                            id="world-script-request"
                            rows={3}
                            maxLength={1200}
                            value={request}
                            disabled={!state.canAsk || state.busy}
                            placeholder={
                                state.canAsk
                                    ? state.source
                                        ? "Add three more NPCs that chase me"
                                        : "A coin hunt around the room with a 60 second timer"
                                    : state.askReason ||
                                      "AI scripts are invite-only for now."
                            }
                            onChange={(event) => setRequest(event.target.value)}
                            onKeyDown={(event) => {
                                if (
                                    event.key === "Enter" &&
                                    (event.metaKey || event.ctrlKey)
                                ) {
                                    event.preventDefault();
                                    void ask();
                                }
                            }}
                        />
                        <Row>
                            <Hint>
                                {state.busy
                                    ? "Writing the script…"
                                    : state.remaining != null
                                    ? `${state.remaining} requests left today`
                                    : "Also works as /ai in the world's chat"}
                            </Hint>
                            <NButton
                                disabled={
                                    !state.canAsk ||
                                    state.busy ||
                                    !request.trim()
                                }
                                onClick={() => void ask()}
                            >
                                {state.busy ? "Working…" : "Ask AI"}
                            </NButton>
                        </Row>
                    </Ask>

                    <Code
                        aria-label="Script source"
                        spellCheck={false}
                        value={draft}
                        placeholder="// The script appears here. You can edit it too."
                        onChange={(event) => setDraft(event.target.value)}
                    />
                    <Row>
                        <Actions>
                            <Action
                                type="button"
                                disabled={!draft.trim()}
                                onClick={() =>
                                    void controller?.run(draft, "keep")
                                }
                                title="Apply your edit and keep the game going"
                            >
                                {edited ? "Apply" : running ? "Apply" : "Run"}
                            </Action>
                            <Action
                                type="button"
                                disabled={!running}
                                onClick={() => controller?.restart()}
                                title="Rewind to the start"
                            >
                                Restart
                            </Action>
                            <Action
                                type="button"
                                onClick={() => void controller?.undo()}
                            >
                                Undo
                            </Action>
                            <Action
                                type="button"
                                disabled={!running}
                                onClick={() => controller?.stop()}
                            >
                                Stop
                            </Action>
                        </Actions>
                        <NButton
                            outline
                            disabled={
                                !draft.trim() || draft === state.script?.source
                            }
                            onClick={async () => {
                                if (!controller) return;
                                if (
                                    edited &&
                                    !(await controller.run(draft, "keep"))
                                )
                                    return;
                                await controller.save({
                                    source: draft,
                                    enabled: true,
                                });
                            }}
                        >
                            {draft && draft === state.script?.source
                                ? "Saved"
                                : "Save"}
                        </NButton>
                    </Row>
                </>
            )}

            {recent.length > 0 && (
                <Log aria-live="polite">
                    {recent.map((entry, index) => (
                        <p key={index} data-level={entry.level}>
                            {entry.text}
                        </p>
                    ))}
                    <div ref={logEnd} />
                </Log>
            )}
        </Panel>
    );
}

const Panel = styled.div`
    ${studioPanel}
    width: min(460px, calc(100vw - 24px));
    max-height: min(720px, calc(100vh - 96px));
    overflow: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    h2 {
        ${studioHeading}
        flex: 1;
    }
`;

const Status = styled.span`
    font: ${studio.font.body} var(--studio-font, ${studio.font.sans});
    color: var(--studio-muted, ${studio.color.muted});
    &[data-state="running"] {
        color: var(--studio-ink, ${studio.color.ink});
    }
    &[data-state="running"]::before {
        content: "";
        display: inline-block;
        width: 6px;
        height: 6px;
        margin-right: 6px;
        border-radius: 50%;
        background: #34c759;
        vertical-align: middle;
    }
`;

const Close = styled.button`
    ${studioAction}
    min-width: 32px;
    padding: 0;
    font-size: 18px;
`;

const Note = styled.p`
    margin: 0;
    color: var(--studio-muted, ${studio.color.muted});
    font: ${studio.font.body} var(--studio-font, ${studio.font.sans});
`;

const Ask = styled.form`
    display: flex;
    flex-direction: column;
    gap: 8px;
    label {
        font: ${studio.font.body} var(--studio-font, ${studio.font.sans});
        color: var(--studio-muted, ${studio.color.muted});
    }
    textarea {
        ${studioField}
        resize: vertical;
    }
`;

const Row = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
`;

const Hint = styled.span`
    color: var(--studio-muted, ${studio.color.muted});
    font: ${studio.font.body} var(--studio-font, ${studio.font.sans});
`;

const Code = styled.textarea`
    ${studioField}
    min-height: 220px;
    resize: vertical;
    font-family: "SFMono-Regular", Menlo, monospace;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre;
    tab-size: 4;
`;

const Actions = styled.div`
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
`;

const Action = styled.button`
    ${studioAction}
    border-color: var(--studio-line, ${studio.color.line});
`;

const Log = styled.div`
    border-top: 1px solid var(--studio-line, ${studio.color.line});
    padding-top: 8px;
    max-height: 160px;
    overflow: auto;
    p {
        margin: 0 0 4px;
        font: ${studio.font.body} var(--studio-font, ${studio.font.sans});
        color: var(--studio-ink, ${studio.color.ink});
        white-space: pre-wrap;
        word-break: break-word;
    }
    p[data-level="error"] {
        color: #ff8a80;
    }
    p[data-level="warn"] {
        color: #ffd27a;
    }
    p[data-level="log"] {
        color: var(--studio-muted, ${studio.color.muted});
        font-family: "SFMono-Regular", Menlo, monospace;
        font-size: 12px;
    }
`;
