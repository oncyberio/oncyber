import { useState } from "react";
import styled from "styled-components";
import { Toggle } from "@features/studio/components/Toggle";
import { createGitHub, NEW_TOKEN_URL } from "./github";
import { providers } from "./assistant";
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

    async function connectGitHub() {
        const token = githubToken.trim();
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
                    <h4>OpenAI</h4>
                    {settings.aiKey && (
                        <button
                            type="button"
                            className="link"
                            onClick={() =>
                                writeContributeSettings({
                                    aiKey: undefined,
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
                        <span>Connected · model</span>
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
                ) : (
                    <>
                        <p className="hint">
                            Paste an API key. A ChatGPT subscription can't be
                            used by other sites, so usage is billed to your
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
                    <h4>Contributor mode</h4>
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
                Your token and key stay in this browser. They go straight to
                GitHub and OpenAI, never to Oncyber. Changes you preview are
                only visible to you.{" "}
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

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 20px;
    color: var(--title-color, #fff);
    font-size: 14px;
    line-height: 1.5;
    p {
        margin: 0;
    }
    .lead,
    .hint,
    .privacy {
        color: var(--content-color, #aaa);
    }
    .hint,
    .privacy {
        font-size: 12px;
    }
    a {
        color: var(--title-color, #fff);
        text-decoration: underline;
    }
    code {
        font-size: 12px;
    }
    h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 500;
    }
    .account {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 16px;
        border: 1px solid var(--border-color, #333);
        border-radius: 12px;
    }
    .account header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .link {
        border: 0;
        padding: 0;
        background: none;
        color: var(--content-color, #aaa);
        font: inherit;
        font-size: 12px;
        text-decoration: underline;
        cursor: pointer;
    }
    .field {
        display: flex;
        gap: 8px;
    }
    input,
    select {
        flex: 1;
        min-width: 0;
        height: 36px;
        padding: 0 10px;
        border: 1px solid var(--field-border-color, #333);
        border-radius: 8px;
        background: var(--field-bg-color, #111);
        color: var(--title-color, #fff);
        font: inherit;
        font-size: 13px;
    }
    .field button {
        height: 36px;
        padding: 0 14px;
        border: 0;
        border-radius: 8px;
        background: var(--btn-color, #fff);
        color: var(--btn-bg-color, #000);
        font: inherit;
        font-size: 13px;
        cursor: pointer;
    }
    .field button:disabled {
        opacity: 0.5;
        cursor: default;
    }
    .connected {
        color: var(--content-color, #aaa);
    }
    .connected strong {
        color: var(--title-color, #fff);
        font-weight: 500;
    }
    .model {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .error {
        color: var(--danger-color, #ff6b6b);
        font-size: 12px;
    }
    .mode {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
    }
`;
