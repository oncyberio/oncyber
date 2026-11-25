/**
 * The AI sidebar of a space, for its owner and editors: a conversation and
 * a composer, nothing else. Say what to make; the steps of each request
 * (writing, trying it out of sight, fixing, swapping in) tick off in one
 * list while the world changes behind it. "undo", "restart" and "stop" are
 * understood as typed. Opened from the AI button in the space's dock and
 * from the studio toolbar.
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

/** Consecutive steps are shown as one list. */
type Block = TranscriptEntry | { id: number; steps: TranscriptEntry[] };

function blocks(transcript: TranscriptEntry[]) {
    const out: Block[] = [];
    for (const entry of transcript) {
        const last = out[out.length - 1];
        if (entry.kind !== "step") out.push(entry);
        else if (last && "steps" in last) last.steps.push(entry);
        else out.push({ id: entry.id, steps: [entry] });
    }
    return out;
}

export default function AiSidebar() {
    const state = useWorldScripts();
    const [draft, setDraft] = useState("");
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
    }, [state.transcript]);

    const send = () => {
        const request = draft.trim();
        if (!request || state.busy) return;
        setDraft("");
        void worldScriptsController()?.ask(request);
    };

    return createPortal(
        <Panel
            role="complementary"
            aria-label="Build with AI"
            onKeyDown={(event) => {
                if (event.key === "Escape") close();
            }}
        >
            <button
                type="button"
                className="close"
                aria-label="Close"
                onClick={close}
            >
                <svg width="14" height="14" viewBox="0 0 16 16">
                    <path
                        d="m3.5 3.5 9 9m0-9-9 9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                </svg>
            </button>
            <div className="scroll" ref={scroll} aria-live="polite">
                {state.transcript.length === 0 && (
                    <p className="quiet">
                        {state.canAsk
                            ? "Say what this world should do. It changes while you stand in it."
                            : state.askReason ||
                              "AI scripts are in early access for now."}
                    </p>
                )}
                {blocks(state.transcript).map((block) =>
                    "steps" in block ? (
                        <ul key={`steps-${block.id}`}>
                            {block.steps.map((step) => (
                                <li key={step.id} data-state={step.state}>
                                    <span className="mark" />
                                    {step.text}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p key={block.id} data-kind={block.kind}>
                            {block.text}
                        </p>
                    )
                )}
            </div>
            <div className="composer">
                <textarea
                    ref={input}
                    rows={2}
                    maxLength={1200}
                    value={draft}
                    placeholder="Ask for a game, characters, a change…"
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
                    onClick={send}
                >
                    <svg width="16" height="16" viewBox="0 0 16 16">
                        <path
                            d="M13 3v4.5a2 2 0 0 1-2 2H3.5m0 0L6.5 6.5m-3 3 3 3"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </button>
            </div>
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
    width: 360px;
    max-width: calc(100vw - 32px);
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    border: 1px solid var(--oc-line-strong);
    border-radius: ${baseTokens.radius.panel}px;
    background: var(--oc-panel);
    color: var(--oc-ink);
    box-shadow: var(--oc-shadow);
    overflow: hidden;
    animation: ${slideIn} var(--oc-enter) var(--oc-ease) both;
    &,
    * {
        box-sizing: border-box;
    }
    button {
        cursor: pointer;
    }
    button:focus-visible {
        outline: 2px solid var(--oc-accent);
        outline-offset: 2px;
    }
    .close {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 1;
        width: 28px;
        height: 28px;
        display: grid;
        place-items: center;
        border: 0;
        border-radius: var(--oc-radius-inset);
        background: var(--oc-panel);
        color: var(--oc-muted);
    }
    .close:hover {
        background: var(--oc-hover);
        color: var(--oc-ink);
    }
    .scroll {
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 20px 20px 8px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        scrollbar-width: thin;
        scrollbar-color: var(--oc-line-strong) transparent;
    }
    p {
        margin: 0;
        font-size: 14px;
        line-height: 1.55;
        overflow-wrap: anywhere;
    }
    p.quiet,
    p[data-kind="error"] {
        color: var(--oc-secondary);
    }
    p.quiet {
        padding-right: 28px;
    }
    p[data-kind="you"] {
        align-self: flex-end;
        max-width: 85%;
        margin-top: 6px;
        padding: 8px 12px;
        background: var(--oc-surface);
        border-radius: var(--oc-radius-control);
    }
    p[data-kind="you"]:first-child {
        margin-right: 28px;
    }
    ul {
        list-style: none;
        margin: 0;
        padding: 12px 14px;
        display: grid;
        gap: 8px;
        border: 1px solid var(--oc-line);
        border-radius: var(--oc-radius-control);
    }
    li {
        display: grid;
        grid-template-columns: 14px minmax(0, 1fr);
        gap: 10px;
        font-size: 13px;
        line-height: 1.45;
        color: var(--oc-secondary);
        overflow-wrap: anywhere;
    }
    .mark {
        width: 12px;
        height: 12px;
        margin-top: 3px;
        border-radius: 50%;
    }
    li[data-state="running"] {
        color: var(--oc-ink);
    }
    li[data-state="running"] .mark {
        border: 1.5px solid var(--oc-line-strong);
        border-top-color: var(--oc-ink);
        animation: ${turn} 0.8s linear infinite;
    }
    li[data-state="done"] .mark::before,
    li[data-state="failed"] .mark::before {
        content: "✓";
        display: block;
        font-size: 11px;
        line-height: 12px;
        text-align: center;
        color: var(--oc-muted);
    }
    li[data-state="failed"] .mark::before {
        content: "×";
    }
    .composer {
        margin: 8px 12px 12px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: end;
        gap: 8px;
        padding: 10px 10px 10px 14px;
        border: 1px solid var(--oc-line-strong);
        border-radius: 16px;
    }
    .composer:focus-within {
        border-color: var(--oc-secondary);
    }
    textarea {
        min-height: 42px;
        max-height: 160px;
        padding: 0;
        resize: none;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--oc-ink);
        font: 400 14px/1.5 var(--oc-font);
    }
    textarea::placeholder {
        color: var(--oc-muted);
    }
    .send {
        width: 28px;
        height: 28px;
        display: grid;
        place-items: center;
        border: 0;
        background: transparent;
        color: var(--oc-ink);
    }
    .send:disabled {
        cursor: default;
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
