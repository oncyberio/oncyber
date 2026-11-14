import { useState } from "react";
import styled from "styled-components";
import { Toggle } from "@features/studio/components/Toggle";
import {
    actionButton,
    brandFoundation,
    outlineAction,
    whiteAction,
} from "@styles/brand";
import { actionTokens as action } from "@styles/tokens/action";
import { baseTokens as base } from "@styles/tokens/base";
import { createGitHub, NEW_TOKEN_URL } from "./github";
import { providers } from "./assistant";
import { CHATGPT_CLIENT_ID, signInWithChatGPT } from "./chatgpt";
import {
    clearContributeSettings,
    useContributeSettings,
    writeContributeSettings,
} from "./store";

const OPENAI_KEYS_URL = "https://platform.openai.com/api-keys";

/** The Contribute section of account settings. */
export default function ContributeSettings() {
    const settings = useContributeSettings();
    const [githubToken, setGithubToken] = useState("");
    const [aiKey, setAiKey] = useState("");
    const [busy, setBusy] = useState<"" | "github" | "ai">("");
    const [error, setError] = useState<{ github?: string; ai?: string }>({});
    const [models, setModels] = useState<string[]>([]);
    const [warning, setWarning] = useState("");
    const [manual, setManual] = useState({ github: false, ai: false });

    async function signInGitHub() {
        setBusy("github");
        setError({});
        try {
            // Firebase Auth loads only when someone signs in here.
            const { signInWithGitHub } = await import("./githubSignIn");
            await connectGitHub(await signInWithGitHub());
        } catch (cause) {
            setError({ github: cause.message || "GitHub sign-in failed." });
            setBusy("");
        }
    }

    async function signInChatGPT() {
        setBusy("ai");
        setError({});
        try {
            const tokens = await signInWithChatGPT();
            const available = await providers.chatgpt
                .verify(tokens.accessToken)
                .catch(() => []);
            setModels(available);
            writeContributeSettings({
                aiProvider: "chatgpt",
                aiKey: tokens.accessToken,
                aiRefreshToken: tokens.refreshToken,
                aiExpiresAt: tokens.expiresAt,
                aiModel: available[0] || "gpt-5",
            });
        } catch (cause) {
            setError({ ai: cause.message || "ChatGPT sign-in failed." });
        } finally {
            setBusy("");
        }
    }

    async function connectGitHub(token = githubToken.trim()) {
        if (!token) return;
        setBusy("github");
        setError({});
        setWarning("");
        try {
            const me = await createGitHub(token).me();
            if (
                me.scopes &&
                !me.scopes.includes("public_repo") &&
                !me.scopes.includes("repo")
            )
                setWarning(
                    "This token can't fork or open pull requests. Create one with the public_repo scope."
                );
            writeContributeSettings({
                githubToken: token,
                githubLogin: me.login,
            });
            setGithubToken("");
        } catch (cause) {
            setError({ github: cause.message || "GitHub refused this token." });
        } finally {
            setBusy("");
        }
    }

    async function connectAi() {
        const key = aiKey.trim();
        if (!key) return;
        setBusy("ai");
        setError({});
        try {
            const available = await providers.openai.verify(key);
            setModels(available);
            writeContributeSettings({
                aiProvider: "openai",
                aiKey: key,
                aiRefreshToken: undefined,
                aiExpiresAt: undefined,
                aiModel: available[0],
            });
            setAiKey("");
        } catch (cause) {
            setError({ ai: cause.message || "OpenAI refused this key." });
        } finally {
            setBusy("");
        }
    }

    const ready = !!(settings.githubToken && settings.aiKey);
    const modelChoices = models.length
        ? models
        : settings.aiModel
        ? [settings.aiModel]
        : [];

    return (
        <Container>
            <p className="lead">
                Change Oncyber while you use it. Describe a change in the
                sidebar, see it on the page right away, and send it as a pull
                request from your own GitHub fork.
            </p>

            <section className="account">
                <header>
                    <h4>GitHub</h4>
                    {settings.githubLogin && (
                        <button
                            type="button"
                            className="link"
                            onClick={() =>
                                writeContributeSettings({
                                    githubToken: undefined,
                                    githubLogin: undefined,
                                })
                            }
                        >
                            Disconnect
                        </button>
                    )}
                </header>
                {settings.githubLogin ? (
                    <p className="connected">
                        Signed in as <strong>@{settings.githubLogin}</strong>
                    </p>
                ) : !manual.github ? (
                    <div className="sign-in">
                        <button
                            type="button"
                            className="primary"
                            disabled={busy === "github"}
                            onClick={signInGitHub}
                        >
                            {busy === "github"
                                ? "Signing in…"
                                : "Sign in with GitHub"}
                        </button>
                        <button
                            type="button"
                            className="link"
                            onClick={() =>
                                setManual({ ...manual, github: true })
                            }
                        >
                            Use a token instead
                        </button>
                    </div>
                ) : (
                    <>
                        <p className="hint">
                            Paste a token with the <code>public_repo</code>{" "}
                            scope.{" "}
                            <a
                                href={NEW_TOKEN_URL}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Create one on GitHub
                            </a>
                        </p>
                        <form
                            className="field"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void connectGitHub();
                            }}
                        >
                            <input
                                type="password"
                                autoComplete="off"
                                spellCheck={false}
                                placeholder="ghp_…"
                                aria-label="GitHub token"
                                value={githubToken}
                                onChange={(event) =>
                                    setGithubToken(event.target.value)
                                }
                            />
                            <button
                                type="submit"
                                disabled={
                                    !githubToken.trim() || busy === "github"
                                }
                            >
                                {busy === "github" ? "Checking…" : "Connect"}
                            </button>
                        </form>
                    </>
                )}
                {error.github && <p className="error">{error.github}</p>}
                {warning && <p className="error">{warning}</p>}
            </section>

            <section className="account">
                <header>
                    <h4>
                        {settings.aiProvider === "chatgpt"
                            ? "ChatGPT"
                            : "OpenAI"}
                    </h4>
                    {settings.aiKey && (
                        <button
                            type="button"
                            className="link"
                            onClick={() =>
                                writeContributeSettings({
                                    aiProvider: undefined,
                                    aiKey: undefined,
                                    aiRefreshToken: undefined,
                                    aiExpiresAt: undefined,
                                    aiModel: undefined,
                                })
                            }
                        >
                            Disconnect
                        </button>
                    )}
                </header>
                {settings.aiKey ? (
                    <label className="connected model">
                        <span>
                            {settings.aiProvider === "chatgpt"
                                ? "Your ChatGPT plan · model"
                                : "API key · model"}
                        </span>
                        <select
                            value={settings.aiModel}
                            onChange={(event) =>
                                writeContributeSettings({
                                    aiModel: event.target.value,
                                })
                            }
                        >
                            {modelChoices.map((model) => (
                                <option key={model}>{model}</option>
                            ))}
                        </select>
                    </label>
                ) : !manual.ai ? (
                    <>
                        <div className="sign-in">
                            <button
                                type="button"
                                className="primary"
                                disabled={!CHATGPT_CLIENT_ID || busy === "ai"}
                                onClick={signInChatGPT}
                            >
                                {busy === "ai"
                                    ? "Signing in…"
                                    : "Sign in with ChatGPT"}
                            </button>
                            <button
                                type="button"
                                className="link"
                                onClick={() =>
                                    setManual({ ...manual, ai: true })
                                }
                            >
                                Use an API key instead
                            </button>
                        </div>
                        <p className="hint">
                            {CHATGPT_CLIENT_ID
                                ? "Runs on your ChatGPT plan. You choose how much of it Oncyber can use."
                                : "Sign in with ChatGPT is coming soon. For now, use an OpenAI API key."}
                        </p>
                    </>
                ) : (
                    <>
                        <p className="hint">
                            Paste an OpenAI API key. Usage is billed to your
                            OpenAI account.{" "}
                            <a
                                href={OPENAI_KEYS_URL}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Create a key
                            </a>
                        </p>
                        <form
                            className="field"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void connectAi();
                            }}
                        >
                            <input
                                type="password"
                                autoComplete="off"
                                spellCheck={false}
                                placeholder="sk-…"
                                aria-label="OpenAI API key"
                                value={aiKey}
                                onChange={(event) =>
                                    setAiKey(event.target.value)
                                }
                            />
                            <button
                                type="submit"
                                disabled={!aiKey.trim() || busy === "ai"}
                            >
                                {busy === "ai" ? "Checking…" : "Connect"}
                            </button>
                        </form>
                    </>
                )}
                {error.ai && <p className="error">{error.ai}</p>}
            </section>

            <section className="mode">
                <div>
                    <strong>Contributor mode</strong>
                    <p className="hint">
                        {ready
                            ? "Opens the contributor sidebar on every page."
                            : "Connect both accounts to turn it on."}
                    </p>
                </div>
                <Toggle
                    label="Contributor mode"
                    disabled={!ready}
                    value={!!settings.enabled}
                    onChange={(enabled) => writeContributeSettings({ enabled })}
                />
            </section>

            <p className="privacy">
                Your GitHub and ChatGPT access stays in this browser and is used
                only to talk to GitHub and OpenAI. Changes you preview are only
                visible to you.{" "}
                {(settings.githubToken || settings.aiKey) && (
                    <button
                        type="button"
                        className="link"
                        onClick={clearContributeSettings}
                    >
                        Forget everything
                    </button>
                )}
            </p>
        </Container>
    );
}

// Account dialog surface: dark panel, brand type, shared actions and fields.
const Container = styled.div`
    ${brandFoundation}
    display: flex;
    flex-direction: column;
    gap: 24px;
    color: var(--oc-ink);
    p {
        margin: 0;
    }
    .lead {
        color: var(--oc-secondary);
    }
    .hint,
    .privacy,
    .connected {
        color: var(--oc-muted);
        font-size: 12px;
        line-height: 1.5;
    }
    .connected strong {
        color: var(--oc-ink);
        font-weight: 500;
    }
    a,
    .link {
        color: var(--oc-secondary);
        text-decoration: underline;
        text-underline-offset: 2px;
    }
    a:hover,
    .link:hover {
        color: var(--oc-ink);
    }
    .link {
        padding: 0;
        border: 0;
        background: none;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
    }
    code {
        font: 11px/1.5 var(--oc-mono);
    }
    .account,
    .mode {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding-top: 20px;
        border-top: 1px solid var(--oc-line);
    }
    .account header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    /* Section label: Space Mono, small, muted. */
    h4 {
        margin: 0;
        font: 400 10px/1.5 var(--oc-mono);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--oc-muted);
    }
    .sign-in {
        display: flex;
        align-items: center;
        gap: 16px;
    }
    .primary {
        ${actionButton}
        ${whiteAction}
    }
    .field {
        display: flex;
        gap: 8px;
    }
    .field button {
        ${actionButton}
        ${outlineAction}
    }
    input,
    select {
        flex: 1;
        min-width: 0;
        min-height: ${action.size.minHeight}px;
        padding: 0 12px;
        border: 1px solid ${base.color.line.hover};
        border-radius: var(--oc-radius-control);
        background: var(--oc-canvas);
        color: var(--oc-ink);
        font: 400 14px/1.5 var(--oc-font);
    }
    input::placeholder {
        color: var(--oc-muted);
    }
    input:focus-visible,
    select:focus-visible,
    .link:focus-visible,
    a:focus-visible {
        outline: ${action.state.focusWidth}px solid ${action.state.focusRing};
        outline-offset: 2px;
    }
    .model {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .error {
        color: #ff8f80;
        font-size: 12px;
    }
    .mode {
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
    }
    .mode div {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .mode strong {
        font-size: 14px;
        font-weight: 500;
    }
`;
