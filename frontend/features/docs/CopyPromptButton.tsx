import { useEffect, useRef, useState } from "react";

/** Coding agents whose marks sit on the button. Decorative only. */
export const AGENT_ICONS = ["claude", "codex", "cursor", "opencode"] as const;
export type AgentIcon = (typeof AGENT_ICONS)[number];

/** Marks drawn in white alone, which a light button has to darken. */
const WHITE_MARKS: readonly AgentIcon[] = ["codex", "cursor", "opencode"];

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

/**
 * The prompt for someone who wants to change Oncyber and send the change
 * back: the same start, then the way a contribution is made.
 */
export function contributePrompt(origin: string) {
    return [
        "I want to contribute to Oncyber, the open-source home for 3D spaces on the web.",
        `Read ${origin}/llms.txt and the docs pages it links to.`,
        "Then clone https://github.com/oncyberio/oncyber and follow AGENTS.md to",
        "set it up and run it locally (`pnpm dev:local` needs no accounts).",
        "Read CONTRIBUTING.md before you change anything. Work on a branch off",
        "main, keep the change focused, add tests beside the code and run the",
        "checks for what you touched. When it works, open a pull request against",
        "main with the template filled in and steps to try it.",
        "",
        "What I want to change:",
        "",
    ].join("\n");
}

export default function CopyPromptButton({
    agents = AGENT_ICONS,
    className,
    prompt = agentPrompt,
}: {
    /** What is copied; the page's address is passed in. */
    prompt?: (origin: string) => string;
    /** Which marks to show; all of them unless the page asks for fewer. */
    agents?: readonly AgentIcon[];
    /** Added to `copy-prompt`, for the page's own button style. */
    className?: string;
} = {}) {
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout>>();
    useEffect(() => () => clearTimeout(timer.current), []);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(prompt(window.location.origin));
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
            className={["copy-prompt", className].filter(Boolean).join(" ")}
            onClick={copy}
            title="Copy a prompt for your AI coding agent"
        >
            <span className="agents" aria-hidden="true">
                {agents.map((name) => (
                    <img
                        key={name}
                        src={`/docs/agents/${name}.svg`}
                        data-white={WHITE_MARKS.includes(name) ? "" : undefined}
                        alt=""
                        width={18}
                        height={18}
                    />
                ))}
            </span>
            <span aria-live="polite">{copied ? "Copied" : "Copy for AI"}</span>
        </button>
    );
}
