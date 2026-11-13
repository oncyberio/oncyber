import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { brandFoundation } from "@styles/brand";
import {
    AssistantTurn,
    ChatMessage,
    PageContext,
    Proposal,
    providers,
    runAssistant,
} from "./assistant";
import { changedPaths, emptyChangeset, lineDiff } from "./edits";
import { branchName, createGitHub } from "./github";
import {
    applyLivePatches,
    CONTRIBUTOR_ROOT,
    describeElement,
} from "./livePatch";
import { ContributeSettings, writeContributeSettings } from "./store";

type Entry =
    | { kind: "user"; text: string }
    | { kind: "reply"; text: string }
    | { kind: "error"; text: string }
    | {
          kind: "proposal";
          proposal: Proposal;
          state: "preview" | "kept" | "undone";
      }
    | { kind: "pr"; url: string; number: number };

type Picked = PageContext["picked"];

/** Contributor mode: describe a change, see it live, open a pull request. */
export default function ContributorSidebar({
    settings,
}: {
    settings: ContributeSettings;
}) {
    const [open, setOpen] = useState(true);
    const [side, setSide] = useState<"left" | "right">("right");
    const [entries, setEntries] = useState<Entry[]>([]);
    const [draft, setDraft] = useState("");
    const [step, setStep] = useState("");
    const [picking, setPicking] = useState(false);
    const [picked, setPicked] = useState<Picked>();
    const [prTitle, setPrTitle] = useState("");
    const [prStep, setPrStep] = useState("");
    const history = useRef<ChatMessage[]>([]);
    const changeset = useRef(emptyChangeset());
    const abort = useRef<AbortController>();
    const log = useRef<HTMLDivElement>(null);

    const github = useMemo(
        () => createGitHub(settings.githubToken),
        [settings.githubToken]
    );
    const provider = providers[settings.aiProvider || "openai"];

    // Previews: every kept change plus the one being looked at.
    const live = entries
        .filter(
            (entry): entry is Extract<Entry, { kind: "proposal" }> =>
                entry.kind === "proposal" && entry.state !== "undone"
        )
        .map((entry) => entry.proposal.live);
    const liveKey = JSON.stringify(live);
    useEffect(() => applyLivePatches(live), [liveKey]);

    const pending = entries.find(
        (entry) => entry.kind === "proposal" && entry.state === "preview"
    );
    const kept = entries.filter(
        (entry): entry is Extract<Entry, { kind: "proposal" }> =>
            entry.kind === "proposal" && entry.state === "kept"
    );
    const files = changedPaths(changeset.current);

    // The sidebar renders into its own host so React still sees its events
    // there, while keys and wheel typed here stop before the page's own
    // listeners (avatar movement, shortcuts).
    const [host] = useState(() => {
        const element = document.createElement("div");
        element.setAttribute(CONTRIBUTOR_ROOT, "host");
        return element;
    });
    useEffect(() => {
        const stop = (event: Event) => event.stopPropagation();
        const types = ["keydown", "keyup", "keypress", "wheel"];
        document.body.appendChild(host);
        types.forEach((type) => host.addEventListener(type, stop));
        return () => {
            types.forEach((type) => host.removeEventListener(type, stop));
            host.remove();
        };
    }, [host]);

    useEffect(() => {
        log.current?.scrollTo({ top: log.current.scrollHeight });
    }, [entries.length, step]);

    // Point at something on the page.
    useEffect(() => {
        if (!picking) return;
        document.exitPointerLock?.();
        const box = document.createElement("div");
        box.setAttribute(CONTRIBUTOR_ROOT, "highlight");
        Object.assign(box.style, {
            position: "fixed",
            pointerEvents: "none",
            zIndex: "2147483646",
            border: "2px solid #4d7cff",
            background: "#4d7cff22",
            borderRadius: "4px",
            display: "none",
        });
        document.body.appendChild(box);
        const target = (event: Event) => {
            const element = event.target as Element;
            return element?.closest?.(`[${CONTRIBUTOR_ROOT}]`) ? null : element;
        };
        const move = (event: MouseEvent) => {
            const element = target(event);
            if (!element) return (box.style.display = "none");
            const rect = element.getBoundingClientRect();
            Object.assign(box.style, {
                display: "block",
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
            });
        };
        const swallow = (event: Event) => {
            if (!target(event)) return;
            event.preventDefault();
            event.stopPropagation();
        };
        const click = (event: MouseEvent) => {
            const element = target(event);
            if (!element) return;
            event.preventDefault();
            event.stopPropagation();
            setPicked(describeElement(element));
            setPicking(false);
        };
        const key = (event: KeyboardEvent) => {
            if (event.key === "Escape") setPicking(false);
        };
        document.addEventListener("mousemove", move, true);
        document.addEventListener("pointerdown", swallow, true);
        document.addEventListener("mousedown", swallow, true);
        document.addEventListener("mouseup", swallow, true);
        document.addEventListener("click", click, true);
        document.addEventListener("keydown", key, true);
        return () => {
            box.remove();
            document.removeEventListener("mousemove", move, true);
            document.removeEventListener("pointerdown", swallow, true);
            document.removeEventListener("mousedown", swallow, true);
            document.removeEventListener("mouseup", swallow, true);
            document.removeEventListener("click", click, true);
            document.removeEventListener("keydown", key, true);
        };
    }, [picking]);

    const resolvePending = (state: "kept" | "undone") => {
        // Record kept files now: a pull request may be opened in the same
        // click, before React applies the state update.
        if (state === "kept" && pending?.kind === "proposal")
            Object.assign(changeset.current.files, pending.proposal.files);
        setEntries((list) =>
            list.map((entry) =>
                entry.kind === "proposal" && entry.state === "preview"
                    ? { ...entry, state }
                    : entry
            )
        );
    };

    async function send() {
        const request = draft.trim();
        if (!request || step) return;
        // A new request accepts the change on screen, as the visitor saw it.
        if (pending) resolvePending("kept");
        setDraft("");
        setEntries((list) => [...list, { kind: "user", text: request }]);
        abort.current = new AbortController();
        setStep("Thinking");
        let turn: AssistantTurn;
        try {
            turn = await runAssistant({
                provider,
                key: settings.aiKey,
                model: settings.aiModel || "gpt-5",
                github,
                changeset: changeset.current,
                history: history.current,
                request,
                page: {
                    path: window.location.pathname + window.location.search,
                    title: document.title,
                    picked,
                },
                onStep: setStep,
                signal: abort.current.signal,
            });
        } catch (error) {
            setStep("");
            if (error.name === "AbortError") return;
            setEntries((list) => [
                ...list,
                {
                    kind: "error",
                    text: error.message || "Something went wrong.",
                },
            ]);
            return;
        }
        setStep("");
        setPicked(undefined);
        if (turn.kind === "reply")
            setEntries((list) => [...list, { kind: "reply", text: turn.text }]);
        else {
            if (!prTitle) setPrTitle(turn.proposal.title);
            setEntries((list) => [
                ...list,
                { kind: "proposal", proposal: turn.proposal, state: "preview" },
            ]);
        }
    }

    async function openPullRequest() {
        if (pending) resolvePending("kept");
        const paths = changedPaths(changeset.current);
        if (!paths.length) return;
        const title = prTitle.trim() || "Update the site";
        const summaries = entries
            .filter(
                (entry): entry is Extract<Entry, { kind: "proposal" }> =>
                    entry.kind === "proposal" && entry.state !== "undone"
            )
            .map((entry) => `- ${entry.proposal.summary}`);
        const body = [
            "## What changed",
            "",
            ...summaries,
            "",
            "## How it was checked",
            "",
            `Previewed live on ${window.location.origin}${window.location.pathname} in contributor mode, then opened from the contributor's fork.`,
        ].join("\n");
        try {
            const pull = await github.openPullRequest({
                baseSha: changeset.current.baseSha,
                files: Object.fromEntries(
                    paths.map((path) => [path, changeset.current.files[path]])
                ),
                title,
                body,
                branch: branchName(title),
                onStep: setPrStep,
            });
            setEntries((list) => [...list, { kind: "pr", ...pull }]);
        } catch (error) {
            setEntries((list) => [
                ...list,
                {
                    kind: "error",
                    text: `Couldn't open the pull request: ${error.message}`,
                },
            ]);
        } finally {
            setPrStep("");
        }
    }

    function startOver() {
        abort.current?.abort();
        history.current = [];
        changeset.current = emptyChangeset();
        setEntries([]);
        setPrTitle("");
        setPicked(undefined);
        setStep("");
    }

    const hasPr = entries.some((entry) => entry.kind === "pr");

    return createPortal(
        <Surface
            {...{ [CONTRIBUTOR_ROOT]: "sidebar" }}
            data-open={open || undefined}
            data-picking={picking || undefined}
            data-side={side}
        >
            {!open ? (
                <button
                    type="button"
                    className="tab"
                    onClick={() => setOpen(true)}
                    aria-label="Open contributor sidebar"
                >
                    Contribute
                    {files.length > 0 && (
                        <span className="count">{files.length}</span>
                    )}
                </button>
            ) : (
                <>
                    {picking && (
                        <div className="pick-hint" role="status">
                            Click anything on the page
                            <button
                                type="button"
                                className="quiet"
                                onClick={() => setPicking(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                    <aside aria-label="Contributor mode">
                        <header>
                            <div>
                                <h2>Contributor mode</h2>
                                <small>@{settings.githubLogin}</small>
                            </div>
                            <div className="header-actions">
                                <button
                                    type="button"
                                    className="quiet"
                                    onClick={() =>
                                        setSide(
                                            side === "right" ? "left" : "right"
                                        )
                                    }
                                    aria-label="Move to the other side"
                                    title="Move to the other side"
                                >
                                    ⇆
                                </button>
                                <button
                                    type="button"
                                    className="quiet"
                                    onClick={() => setOpen(false)}
                                    aria-label="Hide sidebar"
                                >
                                    Hide
                                </button>
                                <button
                                    type="button"
                                    className="quiet"
                                    onClick={() =>
                                        writeContributeSettings({
                                            enabled: false,
                                        })
                                    }
                                >
                                    Turn off
                                </button>
                            </div>
                        </header>

                        <div className="log" ref={log}>
                            {!entries.length && (
                                <div className="empty">
                                    <p>
                                        Point at something on the page and say
                                        how it should change. You'll see it here
                                        first; nobody else does.
                                    </p>
                                    <p className="examples">
                                        “Make this title bigger” · “Rename this
                                        button to Explore” · “Hide the search on
                                        phones”
                                    </p>
                                </div>
                            )}
                            {entries.map((entry, index) => (
                                <EntryView
                                    key={index}
                                    entry={entry}
                                    original={changeset.current.original}
                                    onKeep={() => resolvePending("kept")}
                                    onUndo={() => resolvePending("undone")}
                                />
                            ))}
                            {step && <p className="step">{step}…</p>}
                        </div>

                        <footer>
                            {(kept.length > 0 || pending) && !hasPr && (
                                <div className="pr">
                                    <input
                                        value={prTitle}
                                        onChange={(event) =>
                                            setPrTitle(event.target.value)
                                        }
                                        aria-label="Pull request title"
                                        placeholder="Pull request title"
                                    />
                                    <button
                                        type="button"
                                        className="primary"
                                        disabled={!!prStep || !!step}
                                        onClick={openPullRequest}
                                    >
                                        {prStep
                                            ? `${prStep}…`
                                            : "Open pull request"}
                                    </button>
                                </div>
                            )}
                            {picked && (
                                <div className="picked">
                                    <span>
                                        Pointing at{" "}
                                        <code>
                                            {picked.selector.split(" > ").pop()}
                                        </code>
                                    </span>
                                    <button
                                        type="button"
                                        className="quiet"
                                        onClick={() => setPicked(undefined)}
                                    >
                                        Clear
                                    </button>
                                </div>
                            )}
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    void send();
                                }}
                            >
                                <textarea
                                    value={draft}
                                    rows={3}
                                    placeholder="Describe a change"
                                    aria-label="Describe a change"
                                    onChange={(event) =>
                                        setDraft(event.target.value)
                                    }
                                    onKeyDown={(event) => {
                                        if (
                                            event.key === "Enter" &&
                                            !event.shiftKey &&
                                            !event.nativeEvent.isComposing
                                        ) {
                                            event.preventDefault();
                                            void send();
                                        }
                                    }}
                                />
                                <div className="actions">
                                    <button
                                        type="button"
                                        className="quiet"
                                        aria-pressed={picking}
                                        onClick={() => setPicking(!picking)}
                                    >
                                        {picking
                                            ? "Click an element…"
                                            : "Point at something"}
                                    </button>
                                    {entries.length > 0 && (
                                        <button
                                            type="button"
                                            className="quiet"
                                            onClick={startOver}
                                        >
                                            Start over
                                        </button>
                                    )}
                                    {step ? (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                abort.current?.abort()
                                            }
                                        >
                                            Stop
                                        </button>
                                    ) : (
                                        <button
                                            type="submit"
                                            className="primary"
                                            disabled={!draft.trim()}
                                        >
                                            Send
                                        </button>
                                    )}
                                </div>
                            </form>
                        </footer>
                    </aside>
                </>
            )}
        </Surface>,
        host
    );
}

function EntryView({
    entry,
    original,
    onKeep,
    onUndo,
}: {
    entry: Entry;
    original: Record<string, string | null>;
    onKeep(): void;
    onUndo(): void;
}) {
    if (entry.kind === "user") return <p className="user">{entry.text}</p>;
    if (entry.kind === "reply") return <p className="reply">{entry.text}</p>;
    if (entry.kind === "error") return <p className="error">{entry.text}</p>;
    if (entry.kind === "pr")
        return (
            <p className="reply">
                Pull request{" "}
                <a href={entry.url} target="_blank" rel="noreferrer">
                    #{entry.number}
                </a>{" "}
                is open on oncyberio/oncyber. Thanks for contributing.
            </p>
        );
    const { proposal, state } = entry;
    return (
        <div className="proposal" data-state={state}>
            <p>{proposal.summary}</p>
            <details>
                <summary>
                    {Object.keys(proposal.files).length} file
                    {Object.keys(proposal.files).length === 1 ? "" : "s"}
                </summary>
                {Object.entries(proposal.files).map(([path, content]) => (
                    <div key={path} className="file">
                        <code className="path">{path}</code>
                        <pre>{lineDiff(original[path] ?? null, content)}</pre>
                    </div>
                ))}
            </details>
            {state === "preview" ? (
                <div className="actions">
                    <button type="button" className="quiet" onClick={onUndo}>
                        Undo
                    </button>
                    <button type="button" className="primary" onClick={onKeep}>
                        Keep
                    </button>
                </div>
            ) : (
                <small>{state === "kept" ? "Kept" : "Undone"}</small>
            )}
        </div>
    );
}

const Surface = styled.div`
    ${brandFoundation}
    position: fixed;
    top: 16px;
    right: 16px;
    bottom: 16px;
    z-index: 2147483600;
    display: flex;
    pointer-events: none;
    color: var(--oc-ink);
    font-size: 14px;
    line-height: 1.5;
    &:not([data-open]) {
        top: auto;
    }
    &[data-side="left"] {
        right: auto;
        left: 16px;
    }
    /* The page stays clickable while the visitor points at something. */
    &[data-picking] {
        top: auto;
        left: 50%;
        right: auto;
        transform: translateX(-50%);
    }
    &[data-picking] aside {
        display: none;
    }
    .pick-hint {
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 8px 8px 16px;
        border: 1px solid var(--oc-line-strong);
        border-radius: 12px;
        background: var(--oc-panel);
        box-shadow: 0 8px 30px #0005;
        white-space: nowrap;
    }
    *,
    & {
        box-sizing: border-box;
    }
    aside,
    .tab {
        pointer-events: auto;
    }
    aside {
        width: 380px;
        max-width: calc(100vw - 32px);
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        border: 1px solid var(--oc-line-strong);
        border-radius: 16px;
        background: var(--oc-panel);
        box-shadow: -8px 12px 40px #0004;
        overflow: hidden;
    }
    button {
        font: inherit;
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
    .tab,
    button.primary,
    button.quiet,
    form button {
        height: 32px;
        padding: 0 12px;
        border-radius: 8px;
        font-size: 13px;
    }
    .tab {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 40px;
        border: 1px solid var(--oc-line-strong);
        background: var(--oc-panel);
        color: var(--oc-ink);
    }
    .count {
        min-width: 20px;
        height: 20px;
        border-radius: 10px;
        background: var(--oc-accent, #4d7cff);
        color: #fff;
        font-size: 11px;
        display: grid;
        place-items: center;
    }
    button.primary,
    form button[type="submit"] {
        border: 0;
        background: var(--oc-ink);
        color: var(--oc-panel);
    }
    button.quiet,
    form button {
        border: 1px solid var(--oc-line);
        background: transparent;
        color: var(--oc-secondary);
    }
    button.quiet:hover {
        background: var(--oc-hover);
        color: var(--oc-ink);
    }
    button[aria-pressed="true"] {
        border-color: var(--oc-accent, #4d7cff);
        color: var(--oc-ink);
    }
    header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 16px 16px 12px 20px;
        border-bottom: 1px solid var(--oc-line);
    }
    h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 500;
    }
    header small {
        color: var(--oc-muted);
        font: 11px/1.5 var(--oc-mono);
    }
    .header-actions,
    .actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
    }
    .log {
        overflow-y: auto;
        padding: 16px 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        scrollbar-width: thin;
    }
    .log p {
        margin: 0;
        overflow-wrap: anywhere;
    }
    .empty {
        color: var(--oc-secondary);
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .examples {
        color: var(--oc-muted);
        font-size: 12px;
    }
    .user {
        align-self: flex-end;
        max-width: 85%;
        padding: 8px 12px;
        border-radius: 12px;
        background: var(--oc-surface);
        white-space: pre-wrap;
    }
    .reply {
        color: var(--oc-secondary);
        white-space: pre-wrap;
    }
    .reply a {
        color: var(--oc-ink);
    }
    .error {
        color: #ff7a7a;
    }
    .step {
        color: var(--oc-muted);
        font-size: 12px;
    }
    .proposal {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        border: 1px solid var(--oc-line);
        border-radius: 12px;
    }
    .proposal[data-state="undone"] {
        opacity: 0.5;
    }
    .proposal small {
        color: var(--oc-muted);
        font-size: 12px;
    }
    details summary {
        cursor: pointer;
        color: var(--oc-muted);
        font-size: 12px;
    }
    .file {
        margin-top: 8px;
    }
    .path {
        font: 11px/1.5 var(--oc-mono);
        color: var(--oc-secondary);
        overflow-wrap: anywhere;
    }
    pre {
        margin: 4px 0 0;
        padding: 8px;
        max-height: 220px;
        overflow: auto;
        border-radius: 8px;
        background: #0006;
        font: 11px/1.5 var(--oc-mono);
        white-space: pre;
    }
    footer {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px 16px 16px;
        border-top: 1px solid var(--oc-line);
    }
    .pr {
        display: flex;
        gap: 8px;
    }
    .pr input {
        flex: 1;
        min-width: 0;
    }
    input,
    textarea {
        padding: 8px 10px;
        border: 1px solid var(--oc-line);
        border-radius: 8px;
        background: var(--oc-surface);
        color: var(--oc-ink);
        font: inherit;
        font-size: 13px;
    }
    textarea {
        width: 100%;
        resize: none;
    }
    .picked {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--oc-secondary);
    }
    .picked code {
        font: 11px/1.5 var(--oc-mono);
        color: var(--oc-ink);
    }
    form {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    form .actions button:first-child {
        margin-right: auto;
    }
    @media (max-width: 600px) {
        top: auto;
        left: 8px;
        right: 8px;
        bottom: 8px;
        aside {
            width: 100%;
            max-width: none;
            max-height: 70dvh;
        }
    }
`;
