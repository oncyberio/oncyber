import { useEffect, useRef, useState } from "react";

/** Coding agents whose marks sit on the button. Decorative only. */
const AGENT_ICONS = ["claude", "codex", "cursor", "opencode"];

/**
 * The prompt a visitor pastes into a coding agent to start working on
 * Oncyber. It points the agent at the plain-text docs index.
 */
export function agentPrompt(origin: string) {
    return [
        "I want to work on Oncyber, the open-source home for 3D spaces on the web.",
        `Read ${origin}/llms.txt and the docs pages it links to.`,
        "Then clone https://github.com/oncyberio/oncyber, follow AGENTS.md to",
        "set it up and run it locally, and help me with:",
        "",
    ].join("\n");
}

export default function CopyPromptButton() {
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout>>();
    useEffect(() => () => clearTimeout(timer.current), []);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(
                agentPrompt(window.location.origin)
            );
            setCopied(true);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    return (
        <button
            type="button"
            className="copy-prompt"
            onClick={copy}
            title="Copy a prompt for your coding agent"
        >
            <span className="agents" aria-hidden="true">
                {AGENT_ICONS.map((name) => (
                    <img
                        key={name}
                        src={`/docs/agents/${name}.svg`}
                        alt=""
                        width={18}
                        height={18}
                    />
                ))}
            </span>
            <span aria-live="polite">{copied ? "Copied" : "Copy prompt"}</span>
        </button>
    );
}
