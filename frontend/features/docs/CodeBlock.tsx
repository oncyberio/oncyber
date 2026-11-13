import { useEffect, useRef, useState } from "react";
import Check from "@ui/icons/Check";
import Duplicate from "@ui/icons/Duplicate";

/** A fenced code block with a button that copies its text. */
export default function CodeBlock({
    code,
    lang,
}: {
    code: string;
    lang?: string;
}) {
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout>>();
    useEffect(() => () => clearTimeout(timer.current), []);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div className="code-block">
            <pre data-lang={lang || undefined}>
                <code>{code}</code>
            </pre>
            <button
                type="button"
                className="copy-code"
                onClick={copy}
                aria-label={copied ? "Copied" : "Copy"}
                title={copied ? "Copied" : "Copy"}
            >
                {copied ? (
                    <Check width="16" height="16" strokeColor="currentColor" />
                ) : (
                    <Duplicate
                        width="16"
                        height="16"
                        strokeColor="currentColor"
                    />
                )}
            </button>
        </div>
    );
}
