/**
 * The AI sidebar of a space, for its owner and editors: say what to make,
 * watch each step (writing, trying it out of sight, fixing, swapping in),
 * and see the world change behind it without a reload. Opened from the AI
 * button in the space's dock and from the studio toolbar.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";
import { brandFoundation } from "@styles/brand";
import { baseTokens } from "@styles/tokens";
import {
    setWorldScripts,
    TranscriptEntry,
    useWorldScripts,
    worldScriptsController,
} from "./store";

const IDEAS = [
    "A coin hunt with a 60 second timer",
    "Add three characters who wander around and wave when I get close",
    "Hide a key somewhere; finding it opens a glowing portal",
];

const Mark = ({ entry }: { entry: TranscriptEntry }) => {
    if (entry.kind === "you") return <span className="mark">›</span>;
    if (entry.kind === "error") return <span className="mark">!</span>;
    if (entry.kind === "say") return <span className="mark dot">●</span>;
    if (entry.state === "running") return <span className="mark spin" />;
    return <span className="mark">{entry.state === "failed" ? "×" : "✓"}</span>;
};

export default function AiSidebar() {
    const state = useWorldScripts();
    const [draft, setDraft] = useState("");
    const [view, setView] = useState<"none" | "code" | "style">("none");
    const scroll = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLTextAreaElement>(null);
    const close = () => setWorldScripts({ panelOpen: false });

    useEffect(() => {
        document.exitPointerLock?.();
        input.current?.focus();
    }, []);

    // Follow the conversation as steps arrive.
    useLayoutEffect(() => {
        const element = scroll.current;
        if (element) element.scrollTop = element.scrollHeight;
    }, [state.transcript, view]);

    const send = (text = draft) => {
        const request = text.trim();
        if (!request || state.busy) return;
        setDraft("");
        setView("none");
        void worldScriptsController()?.ask(request);
    };

    const running = state.status.state === "running";
    const hasScript = !!state.source;
    const toggle = (next: "code" | "style") =>
        setView((current) => (current === next ? "none" : next));

    return createPortal(
        <Panel
            role="complementary"
            aria-label="Build with AI"
            onKeyDown={(event) => {
                if (event.key === "Escape") close();
            }}
        >
            <header>
                <h2>Build with AI</h2>
                <span className="state" data-on={running || undefined}>
                    {state.busy
                        ? "Working"
                        : running
                        ? "Live"
                        : hasScript
                        ? "Stopped"
                        : "No script yet"}
                </span>
                <button
                    type="button"
                    className="icon"
                    aria-label="Close"
                    onClick={close}
                >
                    <svg width="16" height="16" viewBox="0 0 16 16">
                        <path
                            d="m3.5 3.5 9 9m0-9-9 9"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                        />
                    </svg>
                </button>
            </header>

            <div className="scroll" ref={scroll}>
                {state.transcript.length === 0 && (
                    <div className="empty">
                        <p>
                            Say what this world should do. The script is written
                            for you, tried out of sight, and swapped into the
                            world while you stand in it.
                        </p>
                        {state.canAsk ? (
                            <ul>
                                {IDEAS.map((idea) => (
                                    <li key={idea}>
                                        <button
                                            type="button"
                                            onClick={() => send(idea)}
                                        >
                                            {idea}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="muted">
                                {state.askReason ||
                                    "AI scripts are invite-only for now."}
                            </p>
                        )}
                    </div>
                )}
                <ol aria-live="polite">
                    {state.transcript.map((entry) => (
                        <li
                            key={entry.id}
                            data-kind={entry.kind}
                            data-state={entry.state}
                        >
                            <Mark entry={entry} />
                            <span className="text">{entry.text}</span>
                        </li>
                    ))}
                </ol>
                {view === "code" && (
                    <section className="detail">
                        <h3>{state.script?.name || "Script"}</h3>
                        <pre>{state.source || "Nothing yet."}</pre>
                        {state.logs.length > 0 && (
                            <>
                                <h3>Console</h3>
                                <pre>
                                    {state.logs
                                        .slice(-30)
                                        .map((log) => log.text)
                                        .join("\n")}
                                </pre>
                            </>
                        )}
                    </section>
                )}
                {view === "style" && (
                    <section className="detail">
                        <h3>World style</h3>
                        {state.style ? (
                            <>
                                <div className="palette">
                                    {state.style.palette.map((color, index) => (
                                        <span
                                            key={index}
                                            title={color}
                                            style={{ background: color }}
                                        />
                                    ))}
                                </div>
                                <p>{state.style.summary}</p>
                                <p className="muted">
                                    {[
                                        state.style.look,
                                        state.style.outline && "outlined",
                                        state.style.wobble > 0.05 && "swaying",
                                    ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    . Everything scripts make here is drawn this
                                    way. To change it, ask: “make the style more
                                    neon”.
                                </p>
                            </>
                        ) : (
                            <p className="muted">
                                This world gets its style with the first script,
                                from its sky, colours and artworks.
                            </p>
                        )}
                    </section>
                )}
            </div>

            <footer>
                <div className="tools">
                    <button
                        type="button"
                        disabled={!hasScript || state.busy}
                        onClick={() => worldScriptsController()?.restart()}
                    >
                        {running ? "Restart" : "Start"}
                    </button>
                    <button
                        type="button"
                        disabled={!running || state.busy}
                        onClick={() => worldScriptsController()?.stop()}
                    >
                        Stop
                    </button>
                    <button
                        type="button"
                        disabled={!hasScript || state.busy}
                        onClick={() => void worldScriptsController()?.undo()}
                    >
                        Undo
                    </button>
                    <span className="gap" />
                    <button
                        type="button"
                        aria-pressed={view === "style"}
                        onClick={() => toggle("style")}
                    >
                        Style
                    </button>
                    <button
                        type="button"
                        aria-pressed={view === "code"}
                        onClick={() => toggle("code")}
                    >
                        Code
                    </button>
                </div>
                <div className="composer">
                    <textarea
                        ref={input}
                        rows={2}
                        maxLength={1200}
                        value={draft}
                        placeholder={
                            hasScript
                                ? "Change something: add more characters, make it harder…"
                                : "What should happen in this world?"
                        }
                        aria-label="Ask for a change"
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (
                                event.key === "Enter" &&
                                !event.shiftKey &&
                                !event.nativeEvent.isComposing
                            ) {
                                event.preventDefault();
                                send();
                            }
                        }}
                    />
                    <button
                        type="button"
                        className="send"
                        aria-label="Send"
                        disabled={!draft.trim() || state.busy}
                        onClick={() => send()}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <path
                                d="M8 13V3m0 0L3.5 7.5M8 3l4.5 4.5"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                </div>
                <p className="hint">
                    Enter to send
                    {state.remaining != null &&
                        ` · ${state.remaining} left today`}
                </p>
            </footer>
        </Panel>,
        document.body
    );
}

const slideIn = keyframes`
    from { transform: translateX(16px); opacity: 0; }
`;
const turn = keyframes`
    to { transform: rotate(360deg); }
`;

const Panel = styled.aside`
    ${brandFoundation}
    position: fixed;
    z-index: 1200;
    top: 16px;
    right: 16px;
    bottom: 16px;
    width: 380px;
    max-width: calc(100vw - 32px);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    border: 1px solid var(--oc-line-strong);
    border-radius: ${baseTokens.radius.panel}px;
    background: var(--oc-panel);
    color: var(--oc-ink);
    box-shadow: -8px 12px 40px #0003;
    overflow: hidden;
    animation: ${slideIn} var(--oc-enter) var(--oc-ease) both;
    &,
    * {
        box-sizing: border-box;
    }
    button {
        font: inherit;
        cursor: pointer;
    }
    button:disabled {
        cursor: default;
        opacity: 0.4;
    }
    button:focus-visible,
    textarea:focus-visible {
        outline: 2px solid var(--oc-accent);
        outline-offset: -2px;
    }
    header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 16px 12px 20px;
    }
    h2 {
        flex: 1;
        margin: 0;
        font-size: 16px;
        font-weight: 500;
    }
    .state {
        font: 400 10px/1.5 var(--oc-mono);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--oc-muted);
    }
    .state[data-on] {
        color: var(--oc-ink);
    }
    .icon {
        width: 32px;
        height: 32px;
        display: grid;
        place-items: center;
        border: 1px solid var(--oc-line);
        border-radius: var(--oc-radius-control);
        background: transparent;
        color: var(--oc-secondary);
    }
    .icon:hover {
        background: var(--oc-hover);
        color: var(--oc-ink);
    }
    .scroll {
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 4px 20px 16px;
        scrollbar-width: thin;
        scrollbar-color: var(--oc-line-strong) transparent;
    }
    .empty p,
    .detail p {
        margin: 0 0 12px;
        font-size: 13px;
        line-height: 1.6;
        color: var(--oc-secondary);
    }
    .muted,
    .detail p.muted {
        color: var(--oc-muted);
    }
    .empty ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 6px;
    }
    .empty li button {
        width: 100%;
        padding: 10px 12px;
        text-align: left;
        font-size: 13px;
        line-height: 1.4;
        color: var(--oc-ink);
        background: var(--oc-surface);
        border: 1px solid var(--oc-line);
        border-radius: var(--oc-radius-control);
    }
    .empty li button:hover {
        background: var(--oc-hover);
    }
    ol {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 8px;
    }
    ol li {
        display: grid;
        grid-template-columns: 16px minmax(0, 1fr);
        gap: 8px;
        font-size: 13px;
        line-height: 1.5;
        overflow-wrap: anywhere;
    }
    .mark {
        font: 400 12px/1.6 var(--oc-mono);
        text-align: center;
        color: var(--oc-muted);
    }
    .mark.dot {
        font-size: 9px;
        line-height: 2.2;
        color: var(--oc-ink);
    }
    .mark.spin {
        width: 10px;
        height: 10px;
        margin: 5px 3px;
        border: 1.5px solid var(--oc-line-strong);
        border-top-color: var(--oc-ink);
        border-radius: 50%;
        animation: ${turn} 0.8s linear infinite;
    }
    li[data-kind="you"] {
        margin-top: 12px;
        padding: 8px 10px 8px 6px;
        background: var(--oc-surface);
        border-radius: var(--oc-radius-control);
    }
    li[data-kind="you"]:first-child {
        margin-top: 0;
    }
    li[data-kind="step"] {
        font: 400 12px/1.6 var(--oc-mono);
        color: var(--oc-secondary);
    }
    li[data-kind="step"][data-state="failed"] .mark,
    li[data-kind="error"] .mark {
        color: #ff6b5e;
    }
    li[data-kind="error"] {
        color: var(--oc-secondary);
    }
    .detail {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--oc-line);
    }
    h3 {
        font: 400 10px/1.5 var(--oc-mono);
        color: var(--oc-muted);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin: 0 0 10px;
    }
    pre {
        margin: 0 0 16px;
        padding: 12px;
        max-height: 320px;
        overflow: auto;
        font: 400 11px/1.6 var(--oc-mono);
        color: var(--oc-secondary);
        background: var(--oc-surface);
        border-radius: var(--oc-radius-inset);
        white-space: pre;
        scrollbar-width: thin;
    }
    .palette {
        display: flex;
        gap: 6px;
        margin-bottom: 12px;
    }
    .palette span {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 1px solid var(--oc-line-strong);
    }
    footer {
        padding: 12px 16px 12px;
        border-top: 1px solid var(--oc-line);
    }
    .tools {
        display: flex;
        gap: 4px;
        margin-bottom: 10px;
    }
    .tools .gap {
        flex: 1;
    }
    .tools button {
        padding: 4px 8px;
        font: 400 11px/1.5 var(--oc-mono);
        color: var(--oc-secondary);
        background: transparent;
        border: 1px solid var(--oc-line);
        border-radius: var(--oc-radius-inset);
    }
    .tools button:hover:not(:disabled),
    .tools button[aria-pressed="true"] {
        color: var(--oc-ink);
        background: var(--oc-hover);
    }
    .composer {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: end;
        gap: 8px;
        padding: 8px 8px 8px 12px;
        background: var(--oc-surface);
        border: 1px solid var(--oc-line-strong);
        border-radius: var(--oc-radius-control);
    }
    .composer:focus-within {
        border-color: var(--oc-secondary);
    }
    textarea {
        min-height: 40px;
        max-height: 160px;
        padding: 2px 0;
        resize: none;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--oc-ink);
        font: 400 13px/1.5 var(--oc-font);
    }
    textarea:focus-visible {
        outline: 0;
    }
    textarea::placeholder {
        color: var(--oc-muted);
    }
    .send {
        width: 32px;
        height: 32px;
        display: grid;
        place-items: center;
        border: 0;
        border-radius: var(--oc-radius-inset);
        background: var(--oc-ink);
        color: var(--oc-panel);
    }
    .hint {
        margin: 6px 2px 0;
        font: 400 10px/1.5 var(--oc-mono);
        color: var(--oc-muted);
    }
    @media (max-width: ${baseTokens.breakpoint.phone}px) {
        top: auto;
        left: 8px;
        right: 8px;
        bottom: 8px;
        width: auto;
        max-width: none;
        height: min(70dvh, 560px);
    }
`;
